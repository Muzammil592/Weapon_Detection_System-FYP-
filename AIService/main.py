from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
import cv2
import requests
import time
from datetime import datetime
import os
import threading

# ── Component imports ─────────────────────────────────────────────────────────
from components.weapon_detection import (
    load_model,
    detect_weapons,
    DUPLICATE_TIME_WINDOW,
)
from components.face_detection import (
    load_face_model,
    detect_faces,
    _select_face_near_weapon,
    _scale_bbox,
    _scale_landmarks,
    _bbox_from_face_candidate,
    _is_face_full_enough,
    _face_sharpness,
    _crop_face_to_data_url,
    _face_snapshot_quality,
    _bbox_min_side,
    _frame_to_data_url,
    FACE_WINDOW_DURATION,
    FACE_RECOG_MIN_BOX_SIZE,
    FACE_REQUIRE_FULL_FACE_FOR_ALERT,
    FACE_REQUIRE_FULL_FACE_FOR_RECOG,
    FACE_REFINEMENT_ON_FULL_RES,
)
import components.face_detection as _face_detection_module
from components.face_recognition import (
    load_face_embedder,
    load_face_dataset,
    match_face_identity,
    _record_person_vote,
    _resolve_person_from_votes,
    FACE_RECOG_SAMPLE_INTERVAL,
    FACE_RECOG_MAX_FACE_SAMPLES,
    FACE_RECOG_MIN_MATCHES,
    FACE_RECOG_MIN_FACE_SCORE,
    FACE_RECOG_REQUIRE_VOTE,
    FACE_RECOG_MIN_SHARPNESS,
    FACE_RECOG_MIN_SHARPNESS_FLOOR,
    FACE_RECOG_LOW_SHARPNESS_THRESHOLD_BOOST,
)
import components.face_recognition as _face_recog_module
from components.behavior_analysis import (
    load_behavior_model,
    run_behavior_inference,
    _submit_behavior_future,
    _resolve_behavior_result,
    _default_non_suspicious_behavior_result,
    frame_buffer,
    frame_buffer_lock,
    BEHAVIOR_TARGET_FPS,
)

app = FastAPI(title="Weapon & Face Detection AI Service")

# ── Backend URLs and behavior-only pipeline settings ─────────────────────────
BACKEND_URL = os.environ.get(
    'BACKEND_URL',
    "http://127.0.0.1:5000/api/detections/receive"
)
BEHAVIOR_ONLY_BACKEND_URL = os.environ.get(
    'BEHAVIOR_ONLY_BACKEND_URL',
    "http://127.0.0.1:5000/api/detections/receive-behavior"
)
BEHAVIOR_ONLY_INTERVAL = float(os.environ.get("BEHAVIOR_ONLY_INTERVAL", "2.0"))
BEHAVIOR_ONLY_DUPLICATE_WINDOW = float(os.environ.get("BEHAVIOR_ONLY_DUPLICATE_WINDOW", "30.0"))


class DetectionRequest(BaseModel):
    rtsp_url: str
    location: str
    user_id: str = None


# ── Pipeline state ────────────────────────────────────────────────────────────
detection_active = False
detection_mode = "weapon"   # "weapon" or "face"
pending_weapon = None
face_window_end = 0.0

latest_frame = None
latest_frame_ts = 0.0
frame_lock = threading.Lock()

last_behavior_sample_time = 0.0
behavior_only_last_alert_time = 0.0
last_detections = {}


# ── Backend communication ─────────────────────────────────────────────────────

def send_detection_to_backend(
    weapon_type,
    location,
    confidence,
    user_id=None,
    image_url=None,
    person_match=None,
    behavior_result=None,
):
    payload = {
        "weaponType": weapon_type,
        "location": location,
        "confidence": confidence,
        "userId": user_id
    }

    if image_url:
        payload["imageUrl"] = image_url

    if person_match:
        payload["personName"] = person_match.get("name")
        payload["personScore"] = person_match.get("score")
        payload["personInfo"] = person_match.get("info")

    if behavior_result:
        payload["activityLabel"] = behavior_result.get("label")
        payload["activityScore"] = behavior_result.get("score")
        payload["isSuspiciousActivity"] = behavior_result.get("is_suspicious")
        payload["suspiciousScore"] = behavior_result.get("suspicious_score")
        payload["activityProbabilities"] = behavior_result.get("probabilities")

    try:
        response = requests.post(BACKEND_URL, json=payload, timeout=5)
        if response.status_code == 200:
            print(f"  ✅ Alert sent to backend successfully")
        else:
            print(f"  ❌ Backend error: {response.text}")
    except Exception as e:
        print("❌ Request failed:", e)


def send_behavior_only_to_backend(location, user_id, behavior_result, image_url=None):
    payload = {
        "location": location,
        "userId": user_id,
        "activityLabel": behavior_result.get("label"),
        "activityScore": behavior_result.get("score"),
        "isSuspiciousActivity": behavior_result.get("is_suspicious"),
        "suspiciousScore": behavior_result.get("suspicious_score"),
        "activityProbabilities": behavior_result.get("probabilities"),
    }
    if image_url:
        payload["imageUrl"] = image_url
    try:
        response = requests.post(BEHAVIOR_ONLY_BACKEND_URL, json=payload, timeout=5)
        if response.status_code == 200:
            print(f"   ✅ Behavior alert sent to backend")
        else:
            print(f"   ❌ Backend error: {response.text}")
    except Exception as e:
        print("❌ Request failed (behavior-only):", e)


# ── Behavior-only parallel pipeline ──────────────────────────────────────────

def behavior_only_pipeline(location, user_id):
    """Parallel pipeline: runs every BEHAVIOR_ONLY_INTERVAL seconds and detects
    suspicious activity from the shared frame buffer WITHOUT requiring a weapon
    trigger first. Automatically pauses while the weapon pipeline is in FACE phase
    (detection_mode == 'face') to avoid resource contention and double-counting.
    Resumes automatically once the weapon pipeline finishes and returns to WEAPON phase.
    """
    global detection_active, detection_mode, behavior_only_last_alert_time

    print("🧠 Behavior-only pipeline started")

    while detection_active:
        if detection_mode == "face":
            time.sleep(0.5)
            continue

        now = time.time()

        with frame_buffer_lock:
            buffered_entries = list(frame_buffer)

        if len(buffered_entries) < 4:
            time.sleep(BEHAVIOR_ONLY_INTERVAL)
            continue

        frames_snapshot = []
        first_frame = None
        for entry in buffered_entries:
            if isinstance(entry, tuple) and len(entry) == 2:
                ts, buffered_frame = entry
            else:
                ts, buffered_frame = None, entry
            if buffered_frame is None:
                continue
            frame_copy = buffered_frame.copy() if hasattr(buffered_frame, "copy") else buffered_frame
            frames_snapshot.append(frame_copy)
            if first_frame is None:
                first_frame = frame_copy

        if not frames_snapshot:
            time.sleep(BEHAVIOR_ONLY_INTERVAL)
            continue

        try:
            result = run_behavior_inference(frames_snapshot)
        except Exception as e:
            print(f"❌ Behavior-only inference error: {e}")
            time.sleep(BEHAVIOR_ONLY_INTERVAL)
            continue

        if result is None:
            time.sleep(BEHAVIOR_ONLY_INTERVAL)
            continue

        is_suspicious = result.get("is_suspicious", False)
        label = result.get("label", "unknown")
        suspicious_score = result.get("suspicious_score", 0.0)

        if is_suspicious:
            if (now - behavior_only_last_alert_time) >= BEHAVIOR_ONLY_DUPLICATE_WINDOW:
                behavior_only_last_alert_time = now
                print(f"\n{'─'*62}")
                print(f"🚨 BEHAVIOR-ONLY ALERT  →  {label.upper()}  ({suspicious_score:.0%} confidence)")
                print(f"   Sending alert to backend...")
                print(f"{'─'*62}")
                image_url = _frame_to_data_url(first_frame)
                send_behavior_only_to_backend(location, user_id, result, image_url=image_url)
            else:
                remaining = BEHAVIOR_ONLY_DUPLICATE_WINDOW - (now - behavior_only_last_alert_time)
                print(f"⏳ Behavior-only: alert suppressed  (cooldown {remaining:.0f}s remaining)")
        # Non-suspicious: completely ignored — no storage, no notification

        time.sleep(BEHAVIOR_ONLY_INTERVAL)

    print("🧠 Behavior-only pipeline stopped")


# ── Frame grabber ─────────────────────────────────────────────────────────────

def frame_grabber(rtsp_url):
    global latest_frame, latest_frame_ts, detection_active, last_behavior_sample_time

    cap = cv2.VideoCapture(rtsp_url)
    if not cap.isOpened():
        print("❌ Unable to open RTSP stream")
        detection_active = False
        return

    print("📥 Frame grabber started")
    sample_interval = 1.0 / max(BEHAVIOR_TARGET_FPS, 0.1)
    last_behavior_sample_time = 0.0

    while detection_active:
        ret, frame = cap.read()
        if not ret:
            continue

        now = time.time()

        with frame_lock:
            latest_frame = frame
            latest_frame_ts = now

        if (now - last_behavior_sample_time) >= sample_interval:
            with frame_buffer_lock:
                frame_buffer.append((now, frame.copy()))
            last_behavior_sample_time = now

    cap.release()
    print("📥 Frame grabber stopped")


# ── Main detection pipeline ───────────────────────────────────────────────────

def process_stream(rtsp_url, location, user_id=None):
    """Detection loop with 2 phases:

    1) WEAPON phase (default):
       - Only YOLO weapon detection runs on each latest frame.
       - On a new weapon detection, switch to FACE phase for FACE_WINDOW_DURATION.

    2) FACE phase (triggered by a weapon):
       - YOLO is paused, but the frame grabber keeps updating latest_frame.
       - RetinaFace runs on latest frames and collects multiple face samples.
       - Keeps the best full-face square snapshot for alert evidence.
       - Resolves identity using vote consensus (or sample cap / timeout fallback).
       - Final suspicious decision uses behavior model output from the same event clip.
    """
    global detection_active, last_detections, latest_frame, latest_frame_ts, detection_mode, pending_weapon, face_window_end

    print("🎥 Detection started (weapon→face window mode)")

    grabber_thread = threading.Thread(
        target=frame_grabber,
        args=(rtsp_url,),
        daemon=True
    )
    grabber_thread.start()

    behavior_only_thread = threading.Thread(
        target=behavior_only_pipeline,
        args=(location, user_id),
        daemon=True
    )
    behavior_only_thread.start()

    while detection_active:
        with frame_lock:
            if latest_frame is not None:
                frame = latest_frame.copy()
                frame_ts = float(latest_frame_ts)
            else:
                frame = None
                frame_ts = 0.0

        if frame is None:
            time.sleep(0.01)
            continue

        current_time = time.time()

        if detection_mode == "weapon":
            detections = detect_weapons(frame)

            if not detections:
                continue

            for det in detections:
                weapon_type = det["weapon_type"]
                confidence = det["confidence"]
                weapon_bbox = det.get("bbox")

                if weapon_type in last_detections:
                    if current_time - last_detections[weapon_type] < DUPLICATE_TIME_WINDOW:
                        continue

                last_detections[weapon_type] = current_time
                trigger_ts = frame_ts if frame_ts > 0.0 else current_time

                print(f"\n{'═'*62}")
                print(f"  🔫  STEP 1 │ WEAPON DETECTED")
                print(f"{'─'*62}")
                print(f"  Type       : {weapon_type.upper()}")
                print(f"  Confidence : {confidence:.1%}")
                print(f"  Location   : {location}")
                print(f"  → Face window opened for {FACE_WINDOW_DURATION}s")
                print(f"{'═'*62}")

                pending_weapon = {
                    "weapon_type": weapon_type,
                    "confidence": confidence,
                    "location": location,
                    "user_id": user_id,
                    "weapon_bbox": weapon_bbox,
                    "image_url": None,
                    "person_match": None,
                    "face_track_bbox": None,
                    "behavior_futures": [],
                    "behavior_result": None,
                    "last_behavior_sample_ts": 0.0,
                    "behavior_trigger_ts": float(trigger_ts),
                    "behavior_trigger_frame": frame.copy(),
                    "behavior_future_submitted": False,
                    "person_votes": {},
                    "person_vote_samples": 0,
                    "face_recog_attempts": 0,
                    "last_face_sample_ts": 0.0,
                    "best_snapshot_quality": -1.0,
                }

                behavior_submitted = _submit_behavior_future(
                    pending_weapon,
                    current_time=current_time,
                    force=True,
                    include_frame=pending_weapon.get("behavior_trigger_frame"),
                    include_frame_ts=trigger_ts,
                    trigger_ts=float(trigger_ts),
                    require_centered_window=True,
                )
                pending_weapon["behavior_future_submitted"] = bool(behavior_submitted)

                face_window_end = current_time + FACE_WINDOW_DURATION
                detection_mode = "face"
                break

        elif detection_mode == "face":
            should_finalize = False
            finalize_reason = None

            if pending_weapon is not None and not pending_weapon.get("behavior_future_submitted", False):
                behavior_submitted = _submit_behavior_future(
                    pending_weapon,
                    current_time=current_time,
                    force=True,
                    include_frame=pending_weapon.get("behavior_trigger_frame"),
                    include_frame_ts=pending_weapon.get("behavior_trigger_ts"),
                    trigger_ts=pending_weapon.get("behavior_trigger_ts"),
                    require_centered_window=True,
                )
                pending_weapon["behavior_future_submitted"] = bool(behavior_submitted)

            if current_time >= face_window_end:
                should_finalize = True
                finalize_reason = "timeout"

            if not should_finalize and _face_detection_module.face_model is not None and pending_weapon is not None:
                h, w = frame.shape[:2]
                target_size = 640
                scale_factor = target_size / max(h, w)
                face_frame = cv2.resize(frame, (int(w * scale_factor), int(h * scale_factor))) if scale_factor < 1.0 else frame
                weapon_bbox = _scale_bbox(pending_weapon.get("weapon_bbox"), scale_factor) if scale_factor < 1.0 else pending_weapon.get("weapon_bbox")
                track_bbox = pending_weapon.get("face_track_bbox")
                if scale_factor < 1.0 and track_bbox is not None:
                    track_bbox = _scale_bbox(track_bbox, scale_factor)
                faces = detect_faces(face_frame)
                if faces:
                    selected = _select_face_near_weapon(
                        faces,
                        weapon_bbox,
                        face_frame.shape,
                        track_bbox=track_bbox,
                    )
                    if selected:
                        sample_interval = max(0.0, float(FACE_RECOG_SAMPLE_INTERVAL))
                        last_face_sample_ts = float(pending_weapon.get("last_face_sample_ts", 0.0))
                        if sample_interval > 0.0 and (current_time - last_face_sample_ts) < sample_interval:
                            continue

                        pending_weapon["last_face_sample_ts"] = float(current_time)
                        pending_weapon["face_recog_attempts"] = int(pending_weapon.get("face_recog_attempts", 0)) + 1

                        bbox = _bbox_from_face_candidate(selected, face_frame.shape)
                        face_score = float(selected.get("score", 0.0))
                        print(f"\n  👤  STEP 2 │ FACE DETECTED")
                        print(f"  Score: {face_score:.3f}  │  Attempt: {pending_weapon['face_recog_attempts']}/{FACE_RECOG_MAX_FACE_SAMPLES}")
                        selected_landmarks = selected.get("landmarks") if isinstance(selected, dict) else None

                        if scale_factor < 1.0:
                            bbox_for_recog = _scale_bbox(bbox, 1.0 / scale_factor) if bbox else None
                            landmarks_for_recog = _scale_landmarks(selected_landmarks, 1.0 / scale_factor)
                        else:
                            bbox_for_recog = bbox
                            landmarks_for_recog = selected_landmarks

                        if bbox_for_recog is None and selected.get("bbox"):
                            if scale_factor < 1.0:
                                bbox_for_recog = _scale_bbox(selected.get("bbox"), 1.0 / scale_factor)
                            else:
                                bbox_for_recog = selected.get("bbox")

                        if FACE_REFINEMENT_ON_FULL_RES and scale_factor < 1.0 and bbox_for_recog:
                            refined_faces = detect_faces(frame)
                            if refined_faces:
                                refined_selected = _select_face_near_weapon(
                                    refined_faces,
                                    pending_weapon.get("weapon_bbox"),
                                    frame.shape,
                                    track_bbox=bbox_for_recog,
                                )
                                if refined_selected:
                                    refined_bbox = _bbox_from_face_candidate(refined_selected, frame.shape)
                                    if refined_bbox:
                                        bbox_for_recog = refined_bbox
                                        face_score = float(refined_selected.get("score", face_score))
                                        landmarks_for_recog = refined_selected.get("landmarks") if isinstance(refined_selected, dict) else landmarks_for_recog

                        if bbox_for_recog and _bbox_min_side(bbox_for_recog) < float(FACE_RECOG_MIN_BOX_SIZE):
                            print(
                                f"ℹ️ Face skipped for recognition: small face box min_side={_bbox_min_side(bbox_for_recog):.1f} min={float(FACE_RECOG_MIN_BOX_SIZE):.1f}"
                            )
                            bbox_for_recog = None

                        if bbox_for_recog and FACE_REQUIRE_FULL_FACE_FOR_RECOG:
                            is_full_face, full_face_reason = _is_face_full_enough(
                                bbox_for_recog,
                                frame.shape,
                                landmarks=landmarks_for_recog,
                            )
                            if not is_full_face:
                                print(f"ℹ️ Face skipped for recognition: incomplete face ({full_face_reason})")
                                bbox_for_recog = None

                        if bbox_for_recog:
                            pending_weapon["face_track_bbox"] = bbox_for_recog

                        sharpness = _face_sharpness(frame, bbox_for_recog) if bbox_for_recog else 0.0
                        print(f"  Sharpness: {sharpness:.0f}  │  Min: {FACE_RECOG_MIN_SHARPNESS_FLOOR:.0f}")

                        snapshot = _crop_face_to_data_url(
                            frame,
                            bbox_for_recog,
                            landmarks=landmarks_for_recog,
                            require_full_face=FACE_REQUIRE_FULL_FACE_FOR_ALERT,
                        )
                        if snapshot:
                            snapshot_quality = _face_snapshot_quality(face_score, sharpness, bbox_for_recog)
                            if snapshot_quality >= float(pending_weapon.get("best_snapshot_quality", -1.0)):
                                pending_weapon["image_url"] = snapshot
                                pending_weapon["face_track_bbox"] = bbox_for_recog
                                pending_weapon["best_snapshot_quality"] = float(snapshot_quality)
                        else:
                            print("ℹ️ Face detected but no usable full-face alert snapshot yet.")

                        if bbox_for_recog and face_score >= FACE_RECOG_MIN_FACE_SCORE:
                            if sharpness < FACE_RECOG_MIN_SHARPNESS_FLOOR:
                                print(
                                    f"ℹ️ Face skipped for recognition: very low sharpness={sharpness:.1f} floor={FACE_RECOG_MIN_SHARPNESS_FLOOR:.1f}"
                                )
                            else:
                                threshold_boost = (
                                    FACE_RECOG_LOW_SHARPNESS_THRESHOLD_BOOST
                                    if sharpness < FACE_RECOG_MIN_SHARPNESS
                                    else 0.0
                                )
                                match = match_face_identity(
                                    frame,
                                    bbox_for_recog,
                                    landmarks=landmarks_for_recog,
                                    threshold_boost=threshold_boost,
                                )
                                if match:
                                    print(f"  ✅ STEP 3 │ FACE MATCHED  →  {match.get('name', 'Unknown').upper()}  (score={match.get('score', 0):.3f})")
                                    _record_person_vote(pending_weapon, match)

                                    if FACE_RECOG_REQUIRE_VOTE:
                                        if int(pending_weapon.get("person_vote_samples", 0)) >= max(1, int(FACE_RECOG_MIN_MATCHES)):
                                            resolved_match = _resolve_person_from_votes(pending_weapon)
                                            if resolved_match:
                                                pending_weapon["person_match"] = resolved_match
                                                should_finalize = True
                                                finalize_reason = "person_resolved"
                                    else:
                                        pending_weapon["person_match"] = match
                                        should_finalize = True
                                        finalize_reason = "first_match"
                                else:
                                    print(f"  ❌ STEP 3 │ FACE NOT RECOGNIZED  (unknown person)")
                        elif bbox_for_recog:
                            print(
                                f"ℹ️ Face skipped for recognition: low face score={face_score:.3f} min={FACE_RECOG_MIN_FACE_SCORE:.3f}"
                            )

                        if not should_finalize:
                            attempts = int(pending_weapon.get("face_recog_attempts", 0))
                            if attempts >= max(1, int(FACE_RECOG_MAX_FACE_SAMPLES)):
                                if pending_weapon.get("person_match") is None and FACE_RECOG_REQUIRE_VOTE:
                                    resolved_match = _resolve_person_from_votes(pending_weapon)
                                    if resolved_match:
                                        pending_weapon["person_match"] = resolved_match

                                should_finalize = True
                                finalize_reason = "sample_cap"
                                print(
                                    f"ℹ️ Face sampling reached cap attempts={attempts}; finalizing face phase."
                                )

            if should_finalize:
                if pending_weapon is not None:
                    if pending_weapon.get("person_match") is None and pending_weapon.get("person_votes"):
                        resolved_match = _resolve_person_from_votes(pending_weapon)
                        if resolved_match:
                            pending_weapon["person_match"] = resolved_match

                    if not pending_weapon.get("behavior_future_submitted", False):
                        behavior_submitted = _submit_behavior_future(
                            pending_weapon,
                            current_time=current_time,
                            force=True,
                            include_frame=pending_weapon.get("behavior_trigger_frame"),
                            include_frame_ts=pending_weapon.get("behavior_trigger_ts"),
                            trigger_ts=pending_weapon.get("behavior_trigger_ts"),
                            require_centered_window=True,
                        )

                        if not behavior_submitted:
                            behavior_submitted = _submit_behavior_future(
                                pending_weapon,
                                current_time=current_time,
                                force=True,
                                cutoff_ts=current_time,
                                include_frame=pending_weapon.get("behavior_trigger_frame"),
                                include_frame_ts=pending_weapon.get("behavior_trigger_ts"),
                                require_centered_window=False,
                            )
                            if behavior_submitted:
                                print("ℹ️ Centered behavior window not ready; using fallback clip for this event")

                        pending_weapon["behavior_future_submitted"] = bool(behavior_submitted)

                    behavior_result = _resolve_behavior_result(pending_weapon)
                    if behavior_result is None:
                        behavior_result = _default_non_suspicious_behavior_result()
                        pending_weapon["behavior_result"] = behavior_result
                        print("ℹ️ Behavior result missing; defaulting to non-suspicious decision")
                    pending_weapon["behavior_result"] = behavior_result

                    b_susp = behavior_result.get('is_suspicious', False)
                    b_score = behavior_result.get('suspicious_score', 0)
                    b_label = behavior_result.get('label', 'unknown')
                    b_icon = "🔴" if b_susp else "🟢"
                    print(f"\n  {b_icon} STEP 4 │ BEHAVIOUR  →  {b_label.upper()}  (susp={b_score:.0%})")

                    _person_match = pending_weapon.get("person_match")
                    person_str = _person_match.get('name', 'Unknown').upper() if _person_match else "UNKNOWN"
                    face_img_str = "✅ yes" if pending_weapon.get('image_url') else "❌ no"
                    print(f"\n{'═'*62}")
                    print(f"  🚨  STEP 5 │ ALERT SUMMARY")
                    print(f"{'─'*62}")
                    print(f"  Weapon    : {pending_weapon['weapon_type'].upper()}  ({pending_weapon['confidence']:.1%})")
                    print(f"  Person    : {person_str}" + (f"  (score={_person_match.get('score',0):.3f})" if _person_match else ""))
                    print(f"  Behaviour : {b_icon} {b_label.upper()}  |  Suspicion: {b_score:.0%}")
                    print(f"  Location  : {pending_weapon['location']}")
                    print(f"  Face img  : {face_img_str}  │  Reason: {finalize_reason}")
                    print(f"{'═'*62}\n")

                    send_detection_to_backend(
                        pending_weapon["weapon_type"],
                        pending_weapon["location"],
                        pending_weapon["confidence"],
                        pending_weapon["user_id"],
                        pending_weapon["image_url"],
                        pending_weapon.get("person_match"),
                        behavior_result,
                    )
                    print(f"✅  Pipeline complete → back to WEAPON detection\n")

                pending_weapon = None
                detection_mode = "weapon"
                continue

            time.sleep(0.05)

    print("🛑 Detection stopped")


# ── FastAPI endpoints ─────────────────────────────────────────────────────────

@app.on_event("startup")
async def warmup_face_recognition_on_startup():
    print("⏳ Startup warmup: loading face recognition assets...")
    try:
        load_face_model()
        load_face_embedder()
        load_face_dataset()
        print("✅ Startup warmup complete: face embeddings ready")
    except Exception as e:
        print(f"⚠️ Startup warmup failed: {e}")


@app.post("/start-detection")
async def start_detection(request: DetectionRequest, background_tasks: BackgroundTasks):
    global detection_active, detection_mode, pending_weapon, face_window_end, latest_frame, latest_frame_ts, behavior_only_last_alert_time

    if detection_active:
        return {"message": "Detection already running"}

    load_model()
    load_face_model()
    load_face_embedder()
    if _face_recog_module.known_embeddings is None:
        load_face_dataset()
    load_behavior_model()
    detection_active = True
    detection_mode = "weapon"
    pending_weapon = None
    face_window_end = 0.0
    latest_frame = None
    latest_frame_ts = 0.0
    behavior_only_last_alert_time = 0.0
    last_detections.clear()
    with frame_buffer_lock:
        frame_buffer.clear()

    background_tasks.add_task(
        process_stream,
        request.rtsp_url,
        request.location,
        request.user_id
    )

    return {"message": "Detection started"}


@app.post("/stop-detection")
async def stop_detection():
    global detection_active, latest_frame, latest_frame_ts
    detection_active = False
    latest_frame = None
    latest_frame_ts = 0.0
    with frame_buffer_lock:
        frame_buffer.clear()
    return {"message": "Detection stopped"}


@app.get("/health")
async def health():
    return {"status": "ok", "time": datetime.now().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
