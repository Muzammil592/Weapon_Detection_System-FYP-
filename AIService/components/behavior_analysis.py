import os
import sys
import time
import threading
import numpy as np
import cv2
import torch
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from torchvision.models.video import r3d_18

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

BASE_DIR = os.path.dirname(os.path.dirname(__file__))

BEHAVIOR_WINDOW_SIZE = 32
BEHAVIOR_TARGET_FPS = float(os.environ.get("BEHAVIOR_TARGET_FPS", "10"))
BEHAVIOR_INPUT_SIZE = int(os.environ.get("BEHAVIOR_INPUT_SIZE", "224"))
BEHAVIOR_SUSPICIOUS_THRESHOLD = float(os.environ.get("BEHAVIOR_SUSPICIOUS_THRESHOLD", "0.80"))
BEHAVIOR_RESAMPLE_INTERVAL = float(os.environ.get("BEHAVIOR_RESAMPLE_INTERVAL", "1.0"))
BEHAVIOR_MAX_SAMPLES = int(os.environ.get("BEHAVIOR_MAX_SAMPLES", "6"))
BEHAVIOR_PRE_TRIGGER_RATIO = float(os.environ.get("BEHAVIOR_PRE_TRIGGER_RATIO", "0.0"))
BEHAVIOR_MIN_SUSPICIOUS_MARGIN = float(os.environ.get("BEHAVIOR_MIN_SUSPICIOUS_MARGIN", "0.10"))
BEHAVIOR_MIN_SUSPICIOUS_VOTE_RATIO = float(os.environ.get("BEHAVIOR_MIN_SUSPICIOUS_VOTE_RATIO", "0.60"))
BEHAVIOR_MIN_DECISION_SAMPLES = int(os.environ.get("BEHAVIOR_MIN_DECISION_SAMPLES", "3"))
BEHAVIOR_DECISION_MODE = os.environ.get("BEHAVIOR_DECISION_MODE", "threshold").strip().lower()
BEHAVIOR_APPLY_NORMALIZATION = os.environ.get("BEHAVIOR_APPLY_NORMALIZATION", "1").strip().lower() in {"1", "true", "yes", "y", "on"}
BEHAVIOR_INPUT_MEAN = [0.43216, 0.394666, 0.37645]
BEHAVIOR_INPUT_STD = [0.22803, 0.22145, 0.216989]

try:
    parsed_behavior_mean = [
        float(item.strip())
        for item in os.environ.get("BEHAVIOR_INPUT_MEAN", "0.43216,0.394666,0.37645").split(",")
        if item.strip()
    ]
    if len(parsed_behavior_mean) == 3:
        BEHAVIOR_INPUT_MEAN = parsed_behavior_mean
except ValueError:
    pass

try:
    parsed_behavior_std = [
        float(item.strip())
        for item in os.environ.get("BEHAVIOR_INPUT_STD", "0.22803,0.22145,0.216989").split(",")
        if item.strip()
    ]
    if len(parsed_behavior_std) == 3:
        BEHAVIOR_INPUT_STD = [max(1e-6, value) for value in parsed_behavior_std]
except ValueError:
    pass

BEHAVIOR_LABELS = [
    label.strip()
    for label in os.environ.get("BEHAVIOR_LABELS", "suspicious,non_suspicious").split(",")
    if label.strip()
]
SUSPICIOUS_LABEL_KEYWORDS = {
    "suspicious",
    "suspicious_activity",
    "suspicious-behavior",
}
BEHAVIOR_MODEL_PATH_CANDIDATES = [
    os.path.abspath(os.path.join(BASE_DIR, 'model', 'behavior_model_final.pth')),
    os.path.abspath(os.path.join(BASE_DIR, 'model', 'behavior_model_final.pth.zip')),
]

# ── Shared frame buffer (imported by main.py for use in frame_grabber) ───────
frame_buffer = deque(maxlen=BEHAVIOR_WINDOW_SIZE)
frame_buffer_lock = threading.Lock()

# ── Model globals ─────────────────────────────────────────────────────────────
behavior_model = None
behavior_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
behavior_executor = ThreadPoolExecutor(max_workers=2)


# ── Model path / state helpers ────────────────────────────────────────────────

def _resolve_behavior_model_path():
    for candidate in BEHAVIOR_MODEL_PATH_CANDIDATES:
        if os.path.exists(candidate):
            return candidate
    return None


def _extract_behavior_state_dict(checkpoint):
    if isinstance(checkpoint, dict):
        for key in ("state_dict", "model_state_dict", "model"):
            if key in checkpoint:
                return checkpoint[key]
        if any(isinstance(v, torch.Tensor) for v in checkpoint.values()):
            return checkpoint
    return checkpoint


def _sync_behavior_labels_count(num_classes):
    global BEHAVIOR_LABELS
    current = len(BEHAVIOR_LABELS)
    if num_classes <= current:
        return
    for i in range(current, num_classes):
        BEHAVIOR_LABELS.append(f"class_{i}")


def load_behavior_model():
    global behavior_model

    if behavior_model is not None:
        return

    model_path = _resolve_behavior_model_path()
    if not model_path:
        print("⚠️ Behavior model not found in AIService/model. Behavior analysis will be skipped.")
        return

    try:
        checkpoint = torch.load(model_path, map_location="cpu")
        state_dict = _extract_behavior_state_dict(checkpoint)
        if not isinstance(state_dict, dict):
            raise RuntimeError("Behavior checkpoint does not contain a valid state_dict")

        cleaned = {}
        for k, v in state_dict.items():
            cleaned[k[7:] if k.startswith("module.") else k] = v

        output_classes = len(BEHAVIOR_LABELS)
        fc_weight = cleaned.get("fc.weight")
        if isinstance(fc_weight, torch.Tensor) and fc_weight.ndim == 2:
            output_classes = int(fc_weight.shape[0])

        _sync_behavior_labels_count(output_classes)

        net = r3d_18(weights=None)
        net.fc = torch.nn.Linear(net.fc.in_features, max(1, output_classes))
        net.load_state_dict(cleaned, strict=True)
        net = net.to(behavior_device)
        net.eval()
        behavior_model = net
        print(
            f"✅ Behavior model loaded from {model_path} "
            f"(device: {behavior_device}, classes: {len(BEHAVIOR_LABELS)}, threshold: {BEHAVIOR_SUSPICIOUS_THRESHOLD:.2f})"
        )
    except Exception as e:
        print("❌ Failed to load behavior model:", e)
        import traceback
        traceback.print_exc()
        behavior_model = None


# ── Label / decision helpers ──────────────────────────────────────────────────

def _is_suspicious_label(label):
    normalized = (label or "").strip().lower().replace(" ", "_")
    if not normalized:
        return False
    if normalized in {"non_suspicious", "nonsuspicious", "normal", "safe", "benign"}:
        return False
    if normalized.startswith("non_") and "suspicious" in normalized:
        return False
    return any(keyword in normalized for keyword in SUSPICIOUS_LABEL_KEYWORDS)


def _build_behavior_prob_map(probs):
    mapped = {}
    for i, score in enumerate(probs):
        label = BEHAVIOR_LABELS[i] if i < len(BEHAVIOR_LABELS) else f"class_{i}"
        mapped[label] = float(score)
    return mapped


def _best_non_suspicious_label(prob_map, fallback_label):
    non_suspicious_labels = [label for label in BEHAVIOR_LABELS if not _is_suspicious_label(label)]
    if not non_suspicious_labels:
        return fallback_label
    return max(non_suspicious_labels, key=lambda label: float(prob_map.get(label, 0.0)))


def _decide_suspicious(label, suspicious_score):
    if not _is_suspicious_label(label):
        return False
    return float(suspicious_score) >= float(BEHAVIOR_SUSPICIOUS_THRESHOLD)


def _default_non_suspicious_behavior_result():
    fallback_label = "non_suspicious"
    if BEHAVIOR_LABELS:
        fallback_label = _best_non_suspicious_label({}, BEHAVIOR_LABELS[0])
    prob_map = {label: 0.0 for label in BEHAVIOR_LABELS}
    if fallback_label:
        prob_map[fallback_label] = 1.0
    return {
        "label": fallback_label,
        "score": 1.0,
        "is_suspicious": False,
        "suspicious_score": 0.0,
        "probabilities": prob_map,
    }


# ── Clip preparation and inference ────────────────────────────────────────────

def _prepare_behavior_clip(frames):
    if len(frames) == 0:
        return None

    if len(frames) >= BEHAVIOR_WINDOW_SIZE:
        selected = frames[-BEHAVIOR_WINDOW_SIZE:]
    else:
        pad_count = BEHAVIOR_WINDOW_SIZE - len(frames)
        first = frames[0]
        selected = ([first] * pad_count) + list(frames)

    clip = []
    for frame in selected:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        resized = cv2.resize(rgb, (BEHAVIOR_INPUT_SIZE, BEHAVIOR_INPUT_SIZE))
        clip.append(resized.astype(np.float32) / 255.0)

    clip_np = np.stack(clip, axis=0)
    if BEHAVIOR_APPLY_NORMALIZATION:
        mean = np.asarray(BEHAVIOR_INPUT_MEAN, dtype=np.float32).reshape(1, 1, 1, 3)
        std = np.asarray(BEHAVIOR_INPUT_STD, dtype=np.float32).reshape(1, 1, 1, 3)
        clip_np = (clip_np - mean) / np.maximum(std, 1e-6)

    clip_np = np.transpose(clip_np, (3, 0, 1, 2))
    tensor = torch.from_numpy(clip_np).unsqueeze(0).float()
    return tensor


def run_behavior_inference(frames_snapshot):
    if behavior_model is None:
        return None

    clip_tensor = _prepare_behavior_clip(frames_snapshot)
    if clip_tensor is None:
        return None

    try:
        with torch.no_grad():
            logits = behavior_model(clip_tensor.to(behavior_device))
            probs = torch.softmax(logits, dim=1).squeeze(0).detach().cpu().numpy()

        pred_idx = int(np.argmax(probs))
        if pred_idx >= len(BEHAVIOR_LABELS):
            _sync_behavior_labels_count(pred_idx + 1)

        label = BEHAVIOR_LABELS[pred_idx]
        score = float(probs[pred_idx])
        prob_map = _build_behavior_prob_map(probs)

        suspicious_score = 0.0
        for class_label, class_score in prob_map.items():
            if _is_suspicious_label(class_label):
                suspicious_score = max(suspicious_score, float(class_score))

        is_suspicious = _decide_suspicious(label, suspicious_score)
        if not is_suspicious and _is_suspicious_label(label):
            label = _best_non_suspicious_label(prob_map, label)
            score = float(prob_map.get(label, score))

        result = {
            "label": label,
            "score": score,
            "is_suspicious": is_suspicious,
            "suspicious_score": suspicious_score,
            "probabilities": prob_map,
        }
        status_icon = "🔴 SUSPICIOUS" if is_suspicious else "🟢 SAFE"
        bar_filled = int(suspicious_score * 20)
        bar = "█" * bar_filled + "░" * (20 - bar_filled)
        print(
            f"🧠 BEHAVIOR  {status_icon}  |  [{bar}] {suspicious_score:.0%} susp  "
            f"|  label={result['label']}  conf={result['score']:.0%}"
        )
        return result
    except Exception as e:
        print("❌ Behavior inference failed:", e)
        import traceback
        traceback.print_exc()
        return None


def _submit_behavior_future(
    pending_weapon,
    current_time=None,
    force=False,
    cutoff_ts=None,
    include_frame=None,
    include_frame_ts=None,
    trigger_ts=None,
    require_centered_window=False,
):
    if behavior_model is None or pending_weapon is None:
        return False

    futures = pending_weapon.setdefault("behavior_futures", [])
    now = float(current_time if current_time is not None else time.time())
    last_ts = float(pending_weapon.get("last_behavior_sample_ts", 0.0))

    if not force:
        if len(futures) >= BEHAVIOR_MAX_SAMPLES:
            return False
        if last_ts > 0.0 and (now - last_ts) < BEHAVIOR_RESAMPLE_INTERVAL:
            return False

    with frame_buffer_lock:
        buffered_entries = list(frame_buffer)

    frames_snapshot = []
    if require_centered_window and trigger_ts is not None:
        trigger = float(trigger_ts)
        pre_ratio = float(np.clip(BEHAVIOR_PRE_TRIGGER_RATIO, 0.0, 0.90))
        pre_required = int(np.floor(BEHAVIOR_WINDOW_SIZE * pre_ratio))
        pre_required = max(0, min(BEHAVIOR_WINDOW_SIZE, pre_required))
        post_required = int(BEHAVIOR_WINDOW_SIZE - pre_required)

        pre_frames = []
        post_frames = []

        for entry in buffered_entries:
            if isinstance(entry, tuple) and len(entry) == 2:
                ts, buffered_frame = entry
            else:
                ts, buffered_frame = None, entry
            if ts is None or buffered_frame is None:
                continue
            frame_copy = buffered_frame.copy() if hasattr(buffered_frame, "copy") else buffered_frame
            if float(ts) <= trigger:
                pre_frames.append(frame_copy)
            else:
                post_frames.append(frame_copy)

        if include_frame is not None:
            include_ts = float(include_frame_ts) if include_frame_ts is not None else trigger
            if include_ts <= trigger:
                pre_frames.append(include_frame.copy() if hasattr(include_frame, "copy") else include_frame)

        if len(post_frames) < post_required:
            if force or not pending_weapon.get("behavior_centered_wait_logged"):
                print(f"ℹ️ Waiting for post-trigger behavior frames: pre={len(pre_frames)} post={len(post_frames)}/{post_required}")
                pending_weapon["behavior_centered_wait_logged"] = True
            return False

        pending_weapon["behavior_centered_wait_logged"] = False
        selected_pre = pre_frames[-pre_required:] if pre_required > 0 else []
        selected_post = post_frames[:post_required]

        if len(selected_pre) < pre_required:
            pad_source = selected_pre[0] if selected_pre else (selected_post[0] if selected_post else None)
            if pad_source is not None:
                selected_pre = [
                    pad_source.copy() if hasattr(pad_source, "copy") else pad_source
                    for _ in range(pre_required - len(selected_pre))
                ] + selected_pre

        frames_snapshot = selected_pre + selected_post
    else:
        cutoff = float(cutoff_ts) if cutoff_ts is not None else None
        for entry in buffered_entries:
            if isinstance(entry, tuple) and len(entry) == 2:
                ts, buffered_frame = entry
            else:
                ts, buffered_frame = None, entry
            if cutoff is not None:
                if ts is None or float(ts) > cutoff:
                    continue
            if buffered_frame is None:
                continue
            frames_snapshot.append(buffered_frame.copy() if hasattr(buffered_frame, "copy") else buffered_frame)

        if include_frame is not None:
            include_ts = float(include_frame_ts) if include_frame_ts is not None else now
            if cutoff is None or include_ts <= cutoff:
                frames_snapshot.append(include_frame.copy() if hasattr(include_frame, "copy") else include_frame)

        if len(frames_snapshot) > BEHAVIOR_WINDOW_SIZE:
            frames_snapshot = frames_snapshot[-BEHAVIOR_WINDOW_SIZE:]

    if len(frames_snapshot) == 0:
        if force or not pending_weapon.get("behavior_buffer_warned"):
            print("ℹ️ Behavior buffer is empty for this sampling point")
            pending_weapon["behavior_buffer_warned"] = True
        return False

    pending_weapon["behavior_buffer_warned"] = False
    futures.append(behavior_executor.submit(run_behavior_inference, frames_snapshot))
    pending_weapon["last_behavior_sample_ts"] = now

    if require_centered_window and trigger_ts is not None:
        print(
            f"🧠 Behavior inference started with split pre={pre_required} post={post_required} "
            f"(~{(100.0 * pre_required / BEHAVIOR_WINDOW_SIZE):.1f}%/~{(100.0 * post_required / BEHAVIOR_WINDOW_SIZE):.1f}%)"
        )
    else:
        print("🧠 Behavior inference started in parallel")
    return True


def _select_best_behavior_result(results):
    valid = [r for r in results if isinstance(r, dict)]
    if not valid:
        return None

    prob_sum = {label: 0.0 for label in BEHAVIOR_LABELS}
    label_votes = {}
    weighted_total = 0.0
    suspicious_vote_points = 0.0

    for idx, result in enumerate(valid):
        weight = float(idx + 1)
        weighted_total += weight
        label = result.get("label")
        if label:
            label_votes[label] = label_votes.get(label, 0) + 1
            if _is_suspicious_label(label):
                suspicious_vote_points += weight
        probs = result.get("probabilities") or {}
        for class_label in BEHAVIOR_LABELS:
            prob_sum[class_label] += float(probs.get(class_label, 0.0)) * weight

    avg_probs = {
        label: (prob_sum[label] / float(max(1e-6, weighted_total)))
        for label in BEHAVIOR_LABELS
    }
    chosen_label = max(avg_probs, key=avg_probs.get)
    chosen_score = float(avg_probs.get(chosen_label, 0.0))
    suspicious_score = max(
        [score for label, score in avg_probs.items() if _is_suspicious_label(label)] or [0.0]
    )
    non_suspicious_score = max(
        [score for label, score in avg_probs.items() if not _is_suspicious_label(label)] or [0.0]
    )
    decision_margin = float(suspicious_score - non_suspicious_score)
    suspicious_vote_ratio = suspicious_vote_points / float(max(1e-6, weighted_total))
    is_suspicious = _decide_suspicious(chosen_label, suspicious_score)

    if not is_suspicious and _is_suspicious_label(chosen_label):
        chosen_label = _best_non_suspicious_label(avg_probs, chosen_label)
        chosen_score = float(avg_probs.get(chosen_label, chosen_score))

    if is_suspicious and len(valid) >= BEHAVIOR_MIN_DECISION_SAMPLES:
        if (
            decision_margin < BEHAVIOR_MIN_SUSPICIOUS_MARGIN
            or suspicious_vote_ratio < BEHAVIOR_MIN_SUSPICIOUS_VOTE_RATIO
        ):
            non_suspicious_labels = [label for label in BEHAVIOR_LABELS if not _is_suspicious_label(label)]
            if non_suspicious_labels:
                chosen_label = max(non_suspicious_labels, key=lambda label: avg_probs.get(label, 0.0))
                chosen_score = float(avg_probs.get(chosen_label, chosen_score))
            is_suspicious = False

    return {
        "label": chosen_label,
        "score": chosen_score,
        "is_suspicious": is_suspicious,
        "suspicious_score": suspicious_score,
        "probabilities": avg_probs,
        "vote_summary": {
            "total": len(valid),
            "labels": label_votes,
            "suspicious_ratio": suspicious_vote_ratio,
            "margin": decision_margin,
        },
    }


def _resolve_behavior_result(pending_weapon):
    if pending_weapon is None:
        return None
    futures = pending_weapon.get("behavior_futures") or []
    results = []
    for future in futures:
        try:
            results.append(future.result())
        except Exception as e:
            print("❌ Failed waiting for behavior inference result:", e)
    best = _select_best_behavior_result(results)
    pending_weapon["behavior_result"] = best
    return best
