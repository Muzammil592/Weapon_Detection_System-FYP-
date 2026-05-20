import os
import sys
import csv
import json
import hashlib
import cv2
import numpy as np
import onnxruntime as ort

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from components.face_detection import (
    detect_faces,
    _align_face_chip,
    _face_square_bbox_for_recognition,
    _expand_bbox_xyxy,
    _to_square_bbox,
    _normalize_landmarks,
    _flip_landmarks,
    _bbox_from_face_candidate,
    _bbox_min_side,
    _clip_bbox_xyxy,
    _estimate_face_profile_strength,
    FACE_CROP_PROFILE,
    FACE_PAD_RATIO,
    FACE_PAD_RATIO_MIN,
    FACE_PAD_RATIO_MAX,
    FACE_TARGET_OCCUPANCY,
    FACE_ALIGN_EMBEDDINGS,
    FACE_EMBED_FUSE_ALIGN_AND_CROP,
    FACE_PROFILE_YAW_THRESHOLD,
    FACE_EMBED_PAD_BONUS,
    FACE_SNAPSHOT_PAD_BONUS,
    FACE_LM_SIDE_EXPAND,
    FACE_LM_TOP_EXPAND,
    FACE_LM_BOTTOM_EXPAND,
)

BASE_DIR = os.path.dirname(os.path.dirname(__file__))

FACE_EMBEDDER_PATH = os.environ.get("FACE_EMBEDDER_PATH", "").strip()
FACE_EMBEDDER_PREPROC = os.environ.get("FACE_EMBEDDER_PREPROC", "arcface").strip().lower()
FACE_EMBEDDER_LAYOUT = os.environ.get("FACE_EMBEDDER_LAYOUT", "auto").strip().lower()
FACE_EMBEDDER_DEFAULT_CANDIDATES = [
    os.path.abspath(os.path.join(BASE_DIR, 'model', 'arcface', 'buffalo_sc', 'w600k_mbf.onnx')),
    os.path.abspath(os.path.join(BASE_DIR, 'model', 'arcface_w600k_mbf.onnx')),
    os.path.abspath(os.path.join(BASE_DIR, 'model', 'arcface_w600k_r50.onnx')),
]
DATASET_DIR = os.path.abspath(os.path.join(BASE_DIR, 'model', 'dataset'))
DATASET_CSV_PATH = os.path.abspath(os.path.join(DATASET_DIR, 'Dataset.csv'))
FACE_EMBED_CACHE_PATH = os.path.abspath(
    os.environ.get(
        "FACE_EMBED_CACHE_PATH",
        os.path.join(DATASET_DIR, ".face_embeddings_cache_v1.npz"),
    )
)
FACE_EMBED_CACHE_VERSION = 5

RECOG_THRESHOLD = float(os.environ.get("RECOG_THRESHOLD", "0.35"))
RECOG_MARGIN = float(os.environ.get("RECOG_MARGIN", "0.015"))
RECOG_MIN_CENTROID_SCORE = float(os.environ.get("RECOG_MIN_CENTROID_SCORE", "0.75"))
RECOG_SUPPORT_SIM = float(os.environ.get("RECOG_SUPPORT_SIM", "0.88"))
RECOG_MIN_SUPPORT_COUNT = int(os.environ.get("RECOG_MIN_SUPPORT_COUNT", "2"))
RECOG_MAX_CENTROID_GAP = float(os.environ.get("RECOG_MAX_CENTROID_GAP", "0.05"))
RECOG_SCORE_TOLERANCE = float(os.environ.get("RECOG_SCORE_TOLERANCE", "0.10"))
RECOG_AUTO_CALIBRATE = os.environ.get("RECOG_AUTO_CALIBRATE", "1").strip().lower() in {"1", "true", "yes", "y", "on"}
RECOG_THRESHOLD_MIN = float(os.environ.get("RECOG_THRESHOLD_MIN", "0.20"))
RECOG_THRESHOLD_MAX = float(os.environ.get("RECOG_THRESHOLD_MAX", "0.42"))
RECOG_BLEND_CENTROID_WEIGHT = float(os.environ.get("RECOG_BLEND_CENTROID_WEIGHT", "0.35"))
RECOG_CCTV_RELAX_ENABLED = os.environ.get("RECOG_CCTV_RELAX_ENABLED", "1").strip().lower() in {"1", "true", "yes", "y", "on"}
RECOG_CCTV_THRESHOLD_RELAX = float(os.environ.get("RECOG_CCTV_THRESHOLD_RELAX", "0.07"))
RECOG_CCTV_SUPPORT_MARGIN = float(os.environ.get("RECOG_CCTV_SUPPORT_MARGIN", "0.01"))
RECOG_CCTV_MIN_CENTROID_DELTA = float(os.environ.get("RECOG_CCTV_MIN_CENTROID_DELTA", "0.05"))
RECOG_TOPK = 3
RECOG_ALLOW_AMBIGUOUS = os.environ.get("RECOG_ALLOW_AMBIGUOUS", "0").strip().lower() in {"1", "true", "yes", "y", "on"}
RECOG_QUERY_MAX_VIEWS = int(os.environ.get("RECOG_QUERY_MAX_VIEWS", "4"))
try:
    RECOG_QUERY_PAD_OFFSETS = [
        float(item.strip())
        for item in os.environ.get("RECOG_QUERY_PAD_OFFSETS", "0.00,0.02,0.05,-0.01").split(",")
        if item.strip()
    ]
except ValueError:
    RECOG_QUERY_PAD_OFFSETS = [0.00, 0.02, 0.05, -0.01]
if not RECOG_QUERY_PAD_OFFSETS:
    RECOG_QUERY_PAD_OFFSETS = [0.00, 0.02, 0.05, -0.01]
RECOG_QUERY_PAD_OFFSETS = RECOG_QUERY_PAD_OFFSETS[:max(1, RECOG_QUERY_MAX_VIEWS)]

FACE_RECOG_MIN_FACE_SCORE = float(os.environ.get("FACE_RECOG_MIN_FACE_SCORE", "0.45"))
FACE_RECOG_MIN_MATCHES = int(os.environ.get("FACE_RECOG_MIN_MATCHES", "1"))
FACE_RECOG_CONSENSUS_RATIO = float(os.environ.get("FACE_RECOG_CONSENSUS_RATIO", "0.60"))
FACE_RECOG_MIN_AVG_SCORE = float(os.environ.get("FACE_RECOG_MIN_AVG_SCORE", "0.55"))
FACE_RECOG_MIN_SHARPNESS = float(os.environ.get("FACE_RECOG_MIN_SHARPNESS", "45.0"))
FACE_RECOG_MIN_SHARPNESS_FLOOR = float(os.environ.get("FACE_RECOG_MIN_SHARPNESS_FLOOR", "20.0"))
FACE_RECOG_LOW_SHARPNESS_THRESHOLD_BOOST = float(os.environ.get("FACE_RECOG_LOW_SHARPNESS_THRESHOLD_BOOST", "0.00"))
FACE_RECOG_MAX_FACE_SAMPLES = int(os.environ.get("FACE_RECOG_MAX_FACE_SAMPLES", "5"))
FACE_RECOG_SAMPLE_INTERVAL = float(os.environ.get("FACE_RECOG_SAMPLE_INTERVAL", "0.10"))
FACE_RECOG_REQUIRE_VOTE = os.environ.get("FACE_RECOG_REQUIRE_VOTE", "1").strip().lower() in {"1", "true", "yes", "y", "on"}

ENROLL_REQUIRE_SINGLE_FACE = os.environ.get("ENROLL_REQUIRE_SINGLE_FACE", "1").strip().lower() in {"1", "true", "yes", "y", "on"}
ENROLL_MIN_FACE_SCORE = float(os.environ.get("ENROLL_MIN_FACE_SCORE", "0.55"))
ENROLL_OUTLIER_MIN_SIM = float(os.environ.get("ENROLL_OUTLIER_MIN_SIM", "0.45"))
ENROLL_MIN_PER_PERSON_EMBEDS = int(os.environ.get("ENROLL_MIN_PER_PERSON_EMBEDS", "4"))
ENROLL_MIN_BOX_SIZE = int(os.environ.get("ENROLL_MIN_BOX_SIZE", "72"))
ENROLL_ALLOW_RELAXED_BACKFILL = os.environ.get("ENROLL_ALLOW_RELAXED_BACKFILL", "1").strip().lower() in {"1", "true", "yes", "y", "on"}
ENROLL_MIN_TARGET_EMBEDS = int(os.environ.get("ENROLL_MIN_TARGET_EMBEDS", "12"))
ENROLL_RELAXED_MIN_FACE_SCORE = float(os.environ.get("ENROLL_RELAXED_MIN_FACE_SCORE", "0.40"))
ENROLL_RELAXED_MIN_BOX_SIZE = int(os.environ.get("ENROLL_RELAXED_MIN_BOX_SIZE", "56"))
ENROLL_RELAXED_MAX_FACES = int(os.environ.get("ENROLL_RELAXED_MAX_FACES", "3"))
ENROLL_CCTV_AUGMENT = os.environ.get("ENROLL_CCTV_AUGMENT", "1").strip().lower() in {"1", "true", "yes", "y", "on"}
ENROLL_CCTV_AUGMENT_MAX_VIEWS = int(os.environ.get("ENROLL_CCTV_AUGMENT_MAX_VIEWS", "2"))

# ── Embedder globals ─────────────────────────────────────────────────────────

embedder_session = None
embedder_input_name = None
embedder_input_height = 112
embedder_input_width = 112
embedder_uses_nchw = False
embedder_input_dtype = np.float32
embedder_output_dim = 512
active_face_embedder_path = None

recog_threshold_runtime = float(RECOG_THRESHOLD)
recog_min_centroid_score_runtime = float(RECOG_MIN_CENTROID_SCORE)
recog_support_sim_runtime = float(RECOG_SUPPORT_SIM)
face_recog_min_avg_score_runtime = float(FACE_RECOG_MIN_AVG_SCORE)

known_embeddings = None
known_names = []
person_info_by_name = {}
centroid_embeddings = None
centroid_names = []


# ── Utility helpers ──────────────────────────────────────────────────────────

def _normalize_person_name(name):
    return " ".join((name or "").strip().lower().split())


def _file_signature(path):
    try:
        stat = os.stat(path)
    except OSError:
        return None
    mtime_ns = getattr(stat, "st_mtime_ns", int(stat.st_mtime * 1_000_000_000))
    return {"size": int(stat.st_size), "mtime_ns": int(mtime_ns)}


def _parse_static_onnx_dim(dim):
    if isinstance(dim, (int, np.integer)):
        return int(dim) if int(dim) > 0 else None
    if isinstance(dim, str):
        dim = dim.strip()
        if dim.isdigit():
            parsed = int(dim)
            return parsed if parsed > 0 else None
    return None


def _resolve_face_embedder_path():
    if FACE_EMBEDDER_PATH:
        explicit = os.path.abspath(FACE_EMBEDDER_PATH)
        if os.path.exists(explicit):
            return explicit
        return None
    for candidate in FACE_EMBEDDER_DEFAULT_CANDIDATES:
        if os.path.exists(candidate):
            return candidate
    return None


def _empty_embeddings():
    dim = int(embedder_output_dim) if int(embedder_output_dim) > 0 else 512
    return np.zeros((0, dim), dtype=np.float32)


def _is_arcface_embedder_active():
    if FACE_EMBEDDER_PREPROC.startswith("arcface"):
        return True
    resolved = (active_face_embedder_path or _resolve_face_embedder_path() or "").lower()
    return any(token in resolved for token in ("arcface", "w600k", "glint"))


def _reset_recog_runtime_thresholds():
    global recog_threshold_runtime, recog_min_centroid_score_runtime, recog_support_sim_runtime, face_recog_min_avg_score_runtime
    recog_threshold_runtime = float(RECOG_THRESHOLD)
    recog_min_centroid_score_runtime = float(RECOG_MIN_CENTROID_SCORE)
    recog_support_sim_runtime = float(RECOG_SUPPORT_SIM)
    face_recog_min_avg_score_runtime = float(FACE_RECOG_MIN_AVG_SCORE)


def _score_face_candidate(sample_best, centroid_score):
    blend = float(np.clip(RECOG_BLEND_CENTROID_WEIGHT, 0.0, 0.95))
    if not _is_arcface_embedder_active():
        blend = min(blend, 0.20)
    return float(((1.0 - blend) * float(sample_best)) + (blend * float(centroid_score)))


def _l2_normalize(vec, eps=1e-12):
    vec = np.asarray(vec, dtype=np.float32)
    n = float(np.linalg.norm(vec))
    if n < eps:
        return vec
    return vec / n


# ── Calibration ──────────────────────────────────────────────────────────────

def _calibrate_recog_runtime_thresholds():
    global recog_threshold_runtime, recog_min_centroid_score_runtime, recog_support_sim_runtime, face_recog_min_avg_score_runtime

    _reset_recog_runtime_thresholds()

    if not RECOG_AUTO_CALIBRATE:
        return
    if known_embeddings is None or known_embeddings.shape[0] < 8:
        return
    if centroid_embeddings is None or centroid_embeddings.shape[0] == 0:
        return

    names = np.asarray(known_names, dtype=object)
    if names.size != int(known_embeddings.shape[0]):
        return

    name_to_centroid = {
        str(name): centroid_embeddings[idx]
        for idx, name in enumerate(centroid_names)
        if idx < int(centroid_embeddings.shape[0])
    }
    if not name_to_centroid:
        return

    sims = known_embeddings @ known_embeddings.T
    n = int(known_embeddings.shape[0])
    records = []
    own_centroid_scores = []

    for i in range(n):
        anchor_name = str(names[i])
        row = np.asarray(sims[i], dtype=np.float32).copy()
        row[i] = -1e9

        same_idx = np.where(names == anchor_name)[0]
        same_idx = same_idx[same_idx != i]
        if same_idx.size == 0:
            continue

        centroid_vec = name_to_centroid.get(anchor_name)
        ranked = []
        for j in range(n):
            if j == i:
                continue
            candidate_name = str(names[j])
            if centroid_vec is None:
                centroid_score = float(row[j])
            else:
                centroid_score = float(np.dot(known_embeddings[j], centroid_vec))
            final_score = _score_face_candidate(float(row[j]), centroid_score)
            ranked.append((candidate_name, final_score))

        if not ranked:
            continue

        ranked.sort(key=lambda item: item[1], reverse=True)
        pred_name, best_score = ranked[0]
        second_score = float(ranked[1][1]) if len(ranked) > 1 else -1.0
        margin = float(best_score - second_score)
        correct = pred_name == anchor_name

        records.append({"score": float(best_score), "margin": margin, "correct": bool(correct)})

        own_centroid = name_to_centroid.get(anchor_name)
        if own_centroid is not None:
            own_centroid_scores.append(float(np.dot(known_embeddings[i], own_centroid)))

    if not records:
        return

    scores = np.asarray([r["score"] for r in records], dtype=np.float32)
    s_min = float(np.min(scores))
    s_max = float(np.max(scores))
    if s_max <= s_min:
        return

    candidates = np.linspace(s_min, s_max, num=120, dtype=np.float32)
    best_threshold = float(RECOG_THRESHOLD)
    best_utility = -1.0
    best_precision = -1.0
    best_recall = -1.0
    zero_wrong_threshold = None
    zero_wrong_recall = -1.0
    zero_wrong_precision = -1.0

    for threshold in candidates:
        accepted = [r for r in records if r["score"] >= float(threshold) and r["margin"] >= float(RECOG_MARGIN)]
        if not accepted:
            continue
        correct = sum(1 for r in accepted if r["correct"])
        wrong = len(accepted) - correct
        precision = float(correct / len(accepted)) if accepted else 0.0
        recall = float(correct / len(records)) if records else 0.0

        if wrong == 0 and (
            recall > zero_wrong_recall
            or (np.isclose(recall, zero_wrong_recall) and precision > zero_wrong_precision)
        ):
            zero_wrong_recall = recall
            zero_wrong_precision = precision
            zero_wrong_threshold = float(threshold)

        utility = (precision * precision) * recall
        if (
            utility > best_utility
            or (np.isclose(utility, best_utility) and precision > best_precision)
            or (np.isclose(utility, best_utility) and np.isclose(precision, best_precision) and recall > best_recall)
        ):
            best_utility = utility
            best_precision = precision
            best_recall = recall
            best_threshold = float(threshold)

    if zero_wrong_threshold is not None:
        best_threshold = float(zero_wrong_threshold)
        best_precision = float(zero_wrong_precision)
        best_recall = float(zero_wrong_recall)

    floor = min(float(RECOG_THRESHOLD_MIN), float(RECOG_THRESHOLD_MAX))
    ceil = max(float(RECOG_THRESHOLD_MIN), float(RECOG_THRESHOLD_MAX))
    recog_threshold_runtime = float(np.clip(best_threshold, floor, ceil))

    if own_centroid_scores:
        centroid_floor = float(np.percentile(np.asarray(own_centroid_scores, dtype=np.float32), 8.0) - 0.02)
        recog_min_centroid_score_runtime = float(np.clip(centroid_floor, 0.10, 0.95))

    support_floor = float(recog_threshold_runtime + 0.03)
    recog_support_sim_runtime = float(np.clip(min(float(RECOG_SUPPORT_SIM), support_floor), 0.15, 0.95))

    if _is_arcface_embedder_active():
        recog_support_sim_runtime = float(np.clip(recog_threshold_runtime + 0.03, 0.15, 0.85))
        recog_min_centroid_score_runtime = float(
            np.clip(min(recog_min_centroid_score_runtime, recog_threshold_runtime - 0.02), 0.10, 0.90)
        )

        if RECOG_CCTV_RELAX_ENABLED:
            relax = max(0.0, float(RECOG_CCTV_THRESHOLD_RELAX))
            recog_threshold_runtime = float(np.clip(recog_threshold_runtime - relax, floor, ceil))
            support_margin = float(RECOG_CCTV_SUPPORT_MARGIN)
            recog_support_sim_runtime = float(np.clip(recog_threshold_runtime + support_margin, 0.15, 0.80))
            centroid_delta = max(0.0, float(RECOG_CCTV_MIN_CENTROID_DELTA))
            recog_min_centroid_score_runtime = float(
                np.clip(min(recog_min_centroid_score_runtime, recog_threshold_runtime - centroid_delta), 0.10, 0.85)
            )

    face_recog_min_avg_score_runtime = float(
        np.clip(min(float(FACE_RECOG_MIN_AVG_SCORE), recog_threshold_runtime - 0.01), 0.10, 0.95)
    )

    print(
        "ℹ️ Recognition calibration "
        f"threshold={recog_threshold_runtime:.3f} "
        f"centroid_min={recog_min_centroid_score_runtime:.3f} "
        f"support_sim={recog_support_sim_runtime:.3f} "
        f"vote_avg_min={face_recog_min_avg_score_runtime:.3f} "
        f"samples={len(records)} precision={max(0.0, best_precision):.3f} recall={max(0.0, best_recall):.3f}"
    )


# ── Enrollment / cache helpers ───────────────────────────────────────────────

def _collect_enrollment_images(rows, csv_name_by_normalized):
    image_entries = []
    for row in rows:
        csv_name = (row.get("Name") or row.get("name") or "").strip()
        if not csv_name:
            continue
        name = csv_name_by_normalized.get(_normalize_person_name(csv_name), csv_name)
        folder = os.path.join(DATASET_DIR, name)
        if not os.path.isdir(folder):
            continue
        try:
            image_names = sorted(os.listdir(folder))
        except OSError:
            continue
        for img_name in image_names:
            if not img_name.lower().endswith((".jpg", ".jpeg", ".png")):
                continue
            img_path = os.path.join(folder, img_name)
            signature = _file_signature(img_path)
            if signature is None:
                continue
            image_entries.append({
                "name": name,
                "img_path": img_path,
                "rel_path": os.path.relpath(img_path, DATASET_DIR).replace("\\", "/"),
                "size": signature["size"],
                "mtime_ns": signature["mtime_ns"],
            })
    return image_entries


def _build_face_dataset_fingerprint(image_entries):
    resolved_embedder_path = active_face_embedder_path or _resolve_face_embedder_path()
    payload = {
        "cache_version": FACE_EMBED_CACHE_VERSION,
        "dataset_csv": _file_signature(DATASET_CSV_PATH),
        "face_model": _file_signature(os.path.abspath(os.path.join(BASE_DIR, 'model', 'Facedetect_resnet.pth'))),
        "face_embedder": _file_signature(resolved_embedder_path),
        "face_embedder_path": resolved_embedder_path,
        "face_embedder_preproc": FACE_EMBEDDER_PREPROC,
        "face_embedder_layout": FACE_EMBEDDER_LAYOUT,
        "crop_profile": FACE_CROP_PROFILE,
        "face_align_embeddings": bool(FACE_ALIGN_EMBEDDINGS),
        "face_embed_fuse_align_and_crop": bool(FACE_EMBED_FUSE_ALIGN_AND_CROP),
        "face_profile_yaw_threshold": float(FACE_PROFILE_YAW_THRESHOLD),
        "recog_cctv_relax_enabled": bool(RECOG_CCTV_RELAX_ENABLED),
        "recog_cctv_threshold_relax": float(RECOG_CCTV_THRESHOLD_RELAX),
        "recog_cctv_support_margin": float(RECOG_CCTV_SUPPORT_MARGIN),
        "recog_cctv_min_centroid_delta": float(RECOG_CCTV_MIN_CENTROID_DELTA),
        "face_pad_ratio": float(FACE_PAD_RATIO),
        "face_pad_ratio_min": float(FACE_PAD_RATIO_MIN),
        "face_pad_ratio_max": float(FACE_PAD_RATIO_MAX),
        "face_target_occupancy": float(FACE_TARGET_OCCUPANCY),
        "face_embed_pad_bonus": float(FACE_EMBED_PAD_BONUS),
        "recog_blend_centroid_weight": float(RECOG_BLEND_CENTROID_WEIGHT),
        "recog_auto_calibrate": bool(RECOG_AUTO_CALIBRATE),
        "face_snapshot_pad_bonus": float(FACE_SNAPSHOT_PAD_BONUS),
        "face_lm_side_expand": float(FACE_LM_SIDE_EXPAND),
        "face_lm_top_expand": float(FACE_LM_TOP_EXPAND),
        "face_lm_bottom_expand": float(FACE_LM_BOTTOM_EXPAND),
        "enroll_require_single_face": bool(ENROLL_REQUIRE_SINGLE_FACE),
        "enroll_min_face_score": float(ENROLL_MIN_FACE_SCORE),
        "enroll_outlier_min_sim": float(ENROLL_OUTLIER_MIN_SIM),
        "enroll_min_per_person_embeds": int(ENROLL_MIN_PER_PERSON_EMBEDS),
        "enroll_min_box_size": int(ENROLL_MIN_BOX_SIZE),
        "enroll_allow_relaxed_backfill": bool(ENROLL_ALLOW_RELAXED_BACKFILL),
        "enroll_min_target_embeds": int(ENROLL_MIN_TARGET_EMBEDS),
        "enroll_relaxed_min_face_score": float(ENROLL_RELAXED_MIN_FACE_SCORE),
        "enroll_relaxed_min_box_size": int(ENROLL_RELAXED_MIN_BOX_SIZE),
        "enroll_relaxed_max_faces": int(ENROLL_RELAXED_MAX_FACES),
        "enroll_cctv_augment": bool(ENROLL_CCTV_AUGMENT),
        "enroll_cctv_augment_max_views": int(ENROLL_CCTV_AUGMENT_MAX_VIEWS),
        "face_recog_min_box_size": int(os.environ.get("FACE_RECOG_MIN_BOX_SIZE", "70")),
        "recog_allow_ambiguous": bool(RECOG_ALLOW_AMBIGUOUS),
        "images": [
            {"name": e["name"], "rel_path": e["rel_path"], "size": int(e["size"]), "mtime_ns": int(e["mtime_ns"])}
            for e in image_entries
        ],
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(encoded.encode("ascii")).hexdigest()


def _load_face_dataset_cache(dataset_fingerprint):
    if not os.path.exists(FACE_EMBED_CACHE_PATH):
        return None
    try:
        with np.load(FACE_EMBED_CACHE_PATH, allow_pickle=False) as cache:
            cached_version = int(np.asarray(cache["cache_version"]).reshape(-1)[0])
            cached_fingerprint = str(np.asarray(cache["fingerprint"]).reshape(-1)[0])
            if cached_version != FACE_EMBED_CACHE_VERSION:
                print("ℹ️ Face embedding cache version mismatch. Rebuilding cache.")
                return None
            if cached_fingerprint != dataset_fingerprint:
                print("ℹ️ Face embedding cache is stale. Rebuilding cache.")
                return None
            cached_known_embeddings = np.asarray(cache["known_embeddings"], dtype=np.float32)
            cached_known_names = [str(n) for n in np.asarray(cache["known_names"]).tolist()]
            cached_centroid_embeddings = np.asarray(cache["centroid_embeddings"], dtype=np.float32)
            cached_centroid_names = [str(n) for n in np.asarray(cache["centroid_names"]).tolist()]

        expected_dim = int(embedder_output_dim) if int(embedder_output_dim) > 0 else None
        if (
            cached_known_embeddings.ndim != 2
            or cached_known_embeddings.shape[1] <= 0
            or len(cached_known_names) != cached_known_embeddings.shape[0]
        ):
            print("⚠️ Face embedding cache has invalid sample shapes. Rebuilding cache.")
            return None
        if (
            cached_centroid_embeddings.ndim != 2
            or cached_centroid_embeddings.shape[1] != cached_known_embeddings.shape[1]
            or len(cached_centroid_names) != cached_centroid_embeddings.shape[0]
        ):
            print("⚠️ Face embedding cache has invalid centroid shapes. Rebuilding cache.")
            return None
        if expected_dim and cached_known_embeddings.shape[1] != expected_dim:
            print(f"ℹ️ Face embedding cache dim mismatch (cache={cached_known_embeddings.shape[1]}, model={expected_dim}). Rebuilding cache.")
            return None
        return (cached_known_embeddings, cached_known_names, cached_centroid_embeddings, cached_centroid_names)
    except KeyError:
        print("⚠️ Face embedding cache missing required keys. Rebuilding cache.")
    except Exception as e:
        print(f"⚠️ Failed to read face embedding cache: {e}. Rebuilding cache.")
    return None


def _save_face_dataset_cache(dataset_fingerprint):
    if known_embeddings is None or centroid_embeddings is None:
        return
    tmp_path = f"{FACE_EMBED_CACHE_PATH}.tmp"
    cache_dir = os.path.dirname(FACE_EMBED_CACHE_PATH)
    try:
        if cache_dir:
            os.makedirs(cache_dir, exist_ok=True)
        with open(tmp_path, "wb") as tmp_file:
            np.savez_compressed(
                tmp_file,
                cache_version=np.asarray([FACE_EMBED_CACHE_VERSION], dtype=np.int32),
                fingerprint=np.asarray([dataset_fingerprint], dtype=np.str_),
                known_embeddings=np.asarray(known_embeddings, dtype=np.float32),
                known_names=np.asarray(known_names, dtype=np.str_),
                centroid_embeddings=np.asarray(centroid_embeddings, dtype=np.float32),
                centroid_names=np.asarray(centroid_names, dtype=np.str_),
            )
        os.replace(tmp_path, FACE_EMBED_CACHE_PATH)
        print(f"✅ Face embedding cache saved: {FACE_EMBED_CACHE_PATH}")
    except Exception as e:
        print(f"⚠️ Failed to save face embedding cache: {e}")
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except OSError:
            pass


# ── Embedder loading and inference ───────────────────────────────────────────

def load_face_embedder():
    global embedder_session, embedder_input_name
    global embedder_input_height, embedder_input_width
    global embedder_uses_nchw, embedder_input_dtype, embedder_output_dim
    global active_face_embedder_path

    if embedder_session is not None:
        return

    resolved_path = _resolve_face_embedder_path()
    if not resolved_path:
        if FACE_EMBEDDER_PATH:
            print(f"⚠️ Face embedder not found at {os.path.abspath(FACE_EMBEDDER_PATH)}")
        else:
            print("⚠️ Face embedder not found. Checked default candidates:")
            for candidate in FACE_EMBEDDER_DEFAULT_CANDIDATES:
                print(f"   - {candidate}")
        return

    providers = ["CPUExecutionProvider"]
    if "CUDAExecutionProvider" in ort.get_available_providers():
        providers.insert(0, "CUDAExecutionProvider")

    embedder_session = ort.InferenceSession(resolved_path, providers=providers)
    active_face_embedder_path = resolved_path

    input_meta = embedder_session.get_inputs()[0]
    embedder_input_name = input_meta.name
    input_shape = list(input_meta.shape) if input_meta.shape else []
    layout_override = FACE_EMBEDDER_LAYOUT if FACE_EMBEDDER_LAYOUT in {"nchw", "nhwc"} else None
    if layout_override:
        embedder_uses_nchw = layout_override == "nchw"
    else:
        channel_first = _parse_static_onnx_dim(input_shape[1]) if len(input_shape) >= 4 else None
        channel_last = _parse_static_onnx_dim(input_shape[3]) if len(input_shape) >= 4 else None
        if channel_first in {1, 3} and channel_last not in {1, 3}:
            embedder_uses_nchw = True
        elif channel_last in {1, 3} and channel_first not in {1, 3}:
            embedder_uses_nchw = False
        elif channel_first in {1, 3} and channel_last in {1, 3}:
            embedder_uses_nchw = "w600k" in os.path.basename(resolved_path).lower()
        else:
            embedder_uses_nchw = FACE_EMBEDDER_PREPROC == "arcface"

    if len(input_shape) >= 4:
        if embedder_uses_nchw:
            parsed_h = _parse_static_onnx_dim(input_shape[2])
            parsed_w = _parse_static_onnx_dim(input_shape[3])
        else:
            parsed_h = _parse_static_onnx_dim(input_shape[1])
            parsed_w = _parse_static_onnx_dim(input_shape[2])
        if parsed_h and parsed_w:
            embedder_input_height = int(parsed_h)
            embedder_input_width = int(parsed_w)

    input_type = str(input_meta.type).lower()
    if "float16" in input_type:
        embedder_input_dtype = np.float16
    elif "float64" in input_type or "double" in input_type:
        embedder_input_dtype = np.float64
    else:
        embedder_input_dtype = np.float32

    output_meta = embedder_session.get_outputs()[0] if embedder_session.get_outputs() else None
    output_shape = list(output_meta.shape) if output_meta and output_meta.shape else []
    parsed_output_dim = _parse_static_onnx_dim(output_shape[-1]) if output_shape else None
    if parsed_output_dim:
        embedder_output_dim = int(parsed_output_dim)

    layout_name = "NCHW" if embedder_uses_nchw else "NHWC"
    print(
        f"✅ Face embedder loaded path={resolved_path} layout={layout_name} "
        f"input={embedder_input_width}x{embedder_input_height} preproc={FACE_EMBEDDER_PREPROC} "
        f"output_dim={embedder_output_dim} providers={providers}"
    )


def _prepare_embedder_input(crop_rgb):
    if crop_rgb is None or crop_rgb.size == 0:
        return None
    target_h = int(embedder_input_height) if int(embedder_input_height) > 0 else 112
    target_w = int(embedder_input_width) if int(embedder_input_width) > 0 else 112
    if crop_rgb.shape[:2] != (target_h, target_w):
        crop_rgb = cv2.resize(crop_rgb, (target_w, target_h))
    img = crop_rgb.astype(np.float32)
    if FACE_EMBEDDER_PREPROC in {"arcface", "arcface112"}:
        img = (img - 127.5) / 127.5
    elif FACE_EMBEDDER_PREPROC in {"legacy", "cctv"}:
        img = (img - 127.5) / 128.0
    elif FACE_EMBEDDER_PREPROC in {"scale01", "zero_one", "01"}:
        img = img / 255.0
    else:
        img = (img - 127.5) / 127.5
    if embedder_uses_nchw:
        img = np.transpose(img, (2, 0, 1))
    img_batch = np.expand_dims(img, axis=0)
    return img_batch.astype(embedder_input_dtype, copy=False)


def _infer_embedding_from_rgb(crop_rgb):
    img_batch = _prepare_embedder_input(crop_rgb)
    if img_batch is None:
        return None
    raw_embedding = embedder_session.run(None, {embedder_input_name: img_batch})[0]
    embedding = np.asarray(raw_embedding, dtype=np.float32).reshape(-1)
    if embedding.size == 0:
        return None
    return _l2_normalize(embedding)


def _get_face_embedding(frame, bbox, landmarks=None, pad_ratio=None, pad_bonus=FACE_EMBED_PAD_BONUS):
    if embedder_session is None or embedder_input_name is None:
        return None

    aligned_rgb = None
    align_size = 112
    if int(embedder_input_height) > 0 and int(embedder_input_height) == int(embedder_input_width):
        align_size = int(embedder_input_height)

    if FACE_ALIGN_EMBEDDINGS:
        aligned_chip = _align_face_chip(frame, landmarks, output_size=align_size)
        if aligned_chip is not None:
            aligned_rgb = cv2.cvtColor(aligned_chip, cv2.COLOR_BGR2RGB)

    crop_rgb = None
    if bbox and len(bbox) >= 4:
        if FACE_CROP_PROFILE == "legacy":
            applied_pad = float(FACE_PAD_RATIO + float(pad_bonus)) if pad_ratio is None else float(pad_ratio)
            crop_bbox = _expand_bbox_xyxy(bbox, frame.shape, pad_ratio=applied_pad)
        else:
            if pad_ratio is None:
                crop_bbox = _face_square_bbox_for_recognition(bbox, frame.shape, pad_bonus=pad_bonus)
            else:
                crop_bbox = _to_square_bbox(bbox, frame.shape, pad_ratio=pad_ratio)
        if crop_bbox:
            cx1, cy1, cx2, cy2 = [int(v) for v in crop_bbox]
            crop = frame[cy1:cy2, cx1:cx2]
            if crop.size != 0:
                crop_rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)

    emb_aligned = _infer_embedding_from_rgb(aligned_rgb) if aligned_rgb is not None else None

    if emb_aligned is not None and not FACE_EMBED_FUSE_ALIGN_AND_CROP:
        return emb_aligned

    emb_crop = _infer_embedding_from_rgb(crop_rgb) if crop_rgb is not None else None

    if emb_aligned is not None and emb_crop is not None:
        profile_strength = _estimate_face_profile_strength(landmarks)
        if profile_strength >= float(FACE_PROFILE_YAW_THRESHOLD):
            w_align, w_crop = 0.30, 0.70
        else:
            w_align, w_crop = 0.65, 0.35
        return _l2_normalize((w_align * emb_aligned) + (w_crop * emb_crop))

    if emb_aligned is not None:
        return emb_aligned
    if emb_crop is not None:
        return emb_crop
    return None


# ── Enrollment helpers ───────────────────────────────────────────────────────

def _select_enrollment_face(faces, frame_shape):
    if not faces:
        return None
    h, w = frame_shape[:2]
    cx, cy = w / 2.0, h / 2.0
    diag = (w ** 2 + h ** 2) ** 0.5
    best_face = None
    best_score = -1.0
    for face in faces:
        bbox = face.get("bbox")
        conf = float(face.get("score", 0.0))
        if not bbox or len(bbox) < 4:
            continue
        x1, y1, x2, y2 = bbox[:4]
        fw = max(1.0, x2 - x1)
        fh = max(1.0, y2 - y1)
        area_ratio = (fw * fh) / float(max(1, w * h))
        fcx = (x1 + x2) / 2.0
        fcy = (y1 + y2) / 2.0
        center_dist = ((fcx - cx) ** 2 + (fcy - cy) ** 2) ** 0.5
        center_score = 1.0 - min(1.0, center_dist / max(1.0, diag))
        score = (0.55 * conf) + (0.30 * center_score) + (0.15 * min(1.0, area_ratio * 10.0))
        if score > best_score:
            best_score = score
            best_face = face
    return best_face


def _filter_person_embeddings(name, emb_list):
    if not emb_list:
        return []
    if len(emb_list) < 3:
        return emb_list
    stacked = np.stack(emb_list, axis=0).astype(np.float32)
    centroid = _l2_normalize(np.mean(stacked, axis=0))
    sims = stacked @ centroid
    keep_idx = np.where(sims >= float(ENROLL_OUTLIER_MIN_SIM))[0].tolist()
    min_required = min(len(emb_list), max(1, int(ENROLL_MIN_PER_PERSON_EMBEDS)))
    if len(keep_idx) < min_required:
        ranked_idx = np.argsort(-sims)
        keep_idx = ranked_idx[:min_required].tolist()
    filtered = [emb_list[idx] for idx in keep_idx]
    dropped = len(emb_list) - len(filtered)
    if dropped > 0:
        print(f"ℹ️ Enrollment outlier filter: {name} kept={len(filtered)} dropped={dropped} min_sim={ENROLL_OUTLIER_MIN_SIM:.2f}")
    return filtered


def _generate_cctv_augmented_views(img):
    if img is None or img.size == 0:
        return []
    views = []
    h, w = img.shape[:2]
    dark = cv2.convertScaleAbs(img, alpha=0.72, beta=-10)
    views.append(dark)
    sw = max(48, int(round(w * 0.55)))
    sh = max(48, int(round(h * 0.55)))
    down = cv2.resize(img, (sw, sh), interpolation=cv2.INTER_AREA)
    up = cv2.resize(down, (w, h), interpolation=cv2.INTER_LINEAR)
    blur = cv2.GaussianBlur(up, (3, 3), 0)
    views.append(blur)
    ok, enc = cv2.imencode('.jpg', img, [int(cv2.IMWRITE_JPEG_QUALITY), 45])
    if ok:
        decoded = cv2.imdecode(enc, cv2.IMREAD_COLOR)
        if decoded is not None and decoded.size != 0:
            views.append(decoded)
    max_views = max(0, int(ENROLL_CCTV_AUGMENT_MAX_VIEWS))
    if max_views <= 0:
        return []
    return views[:max_views]


# ── Dataset loading ──────────────────────────────────────────────────────────

def load_face_dataset():
    global known_embeddings, known_names, person_info_by_name, centroid_embeddings, centroid_names

    if known_embeddings is not None:
        return

    _reset_recog_runtime_thresholds()

    if embedder_session is None or embedder_input_name is None:
        print("⚠️ Face embedder is not loaded; skipping face dataset enrollment.")
        known_embeddings = _empty_embeddings()
        known_names = []
        person_info_by_name = {}
        centroid_embeddings = _empty_embeddings()
        centroid_names = []
        return

    if not os.path.exists(DATASET_CSV_PATH):
        print(f"⚠️ Dataset CSV not found at {DATASET_CSV_PATH}")
        known_embeddings = _empty_embeddings()
        known_names = []
        person_info_by_name = {}
        centroid_embeddings = _empty_embeddings()
        centroid_names = []
        return

    rows = []
    with open(DATASET_CSV_PATH, newline="", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            rows.append(row)

    person_info_by_name = {}
    csv_name_by_normalized = {}
    for row in rows:
        name = (row.get("Name") or row.get("name") or "").strip()
        if not name:
            continue
        norm = _normalize_person_name(name)
        person_info_by_name[name] = {k: v for k, v in row.items() if k}
        csv_name_by_normalized[norm] = name

    image_entries = _collect_enrollment_images(rows, csv_name_by_normalized)
    dataset_fingerprint = _build_face_dataset_fingerprint(image_entries)

    cached = _load_face_dataset_cache(dataset_fingerprint)
    if cached is not None:
        known_embeddings, known_names, centroid_embeddings, centroid_names = cached
        _calibrate_recog_runtime_thresholds()
        return

    embeddings_by_name = {}
    total_images = 0
    skipped_no_face = 0
    skipped_multi_face = 0
    skipped_low_face_score = 0
    skipped_small_face = 0
    deferred_entries_by_name = {}

    from components.face_detection import face_model as _face_model
    for entry in image_entries:
        name = entry["name"]
        img_path = entry["img_path"]
        img = cv2.imread(img_path)
        if img is None:
            continue
        faces = detect_faces(img) if _face_model is not None else []
        if not faces:
            skipped_no_face += 1
            continue
        if ENROLL_REQUIRE_SINGLE_FACE and len(faces) != 1:
            skipped_multi_face += 1
            if ENROLL_ALLOW_RELAXED_BACKFILL:
                deferred_entries_by_name.setdefault(name, []).append(entry)
            continue
        best = _select_enrollment_face(faces, img.shape)
        if not best:
            skipped_no_face += 1
            continue
        best_score = float(best.get("score", 0.0))
        if best_score < float(ENROLL_MIN_FACE_SCORE):
            skipped_low_face_score += 1
            if ENROLL_ALLOW_RELAXED_BACKFILL:
                deferred_entries_by_name.setdefault(name, []).append(entry)
            continue
        bbox = _bbox_from_face_candidate(best, img.shape)
        if not bbox:
            skipped_no_face += 1
            continue
        if _bbox_min_side(bbox) < float(ENROLL_MIN_BOX_SIZE):
            skipped_small_face += 1
            if ENROLL_ALLOW_RELAXED_BACKFILL:
                deferred_entries_by_name.setdefault(name, []).append(entry)
            continue
        landmarks = best.get("landmarks") if isinstance(best, dict) else None
        emb = _get_face_embedding(img, bbox, landmarks=landmarks)
        if emb is None:
            continue
        total_images += 1
        embeddings_by_name.setdefault(name, []).append(emb)
        if ENROLL_CCTV_AUGMENT:
            for aug_img in _generate_cctv_augmented_views(img):
                emb_aug = _get_face_embedding(aug_img, bbox, landmarks=landmarks)
                if emb_aug is not None:
                    embeddings_by_name[name].append(emb_aug)
        flip_img = cv2.flip(img, 1)
        ih, iw = img.shape[:2]
        x1, y1, x2, y2 = bbox
        flip_bbox = [float(iw - 1 - x2), float(y1), float(iw - 1 - x1), float(y2)]
        flip_landmarks = _flip_landmarks(landmarks, iw)
        emb_flip = _get_face_embedding(flip_img, flip_bbox, landmarks=flip_landmarks)
        if emb_flip is not None:
            embeddings_by_name[name].append(emb_flip)

    if ENROLL_ALLOW_RELAXED_BACKFILL and deferred_entries_by_name:
        relaxed_target = max(int(ENROLL_MIN_PER_PERSON_EMBEDS), int(ENROLL_MIN_TARGET_EMBEDS))
        relaxed_added = 0
        relaxed_skipped_too_many_faces = 0
        for name in sorted(deferred_entries_by_name.keys()):
            current_count = len(embeddings_by_name.get(name, []))
            if current_count >= relaxed_target:
                continue
            for entry in deferred_entries_by_name.get(name, []):
                current_count = len(embeddings_by_name.get(name, []))
                if current_count >= relaxed_target:
                    break
                img = cv2.imread(entry["img_path"])
                if img is None:
                    continue
                faces = detect_faces(img) if _face_model is not None else []
                if not faces:
                    continue
                if len(faces) > max(1, int(ENROLL_RELAXED_MAX_FACES)):
                    relaxed_skipped_too_many_faces += 1
                    continue
                best = _select_enrollment_face(faces, img.shape)
                if not best:
                    continue
                best_score = float(best.get("score", 0.0))
                if best_score < float(ENROLL_RELAXED_MIN_FACE_SCORE):
                    continue
                bbox = _bbox_from_face_candidate(best, img.shape)
                if not bbox:
                    continue
                if _bbox_min_side(bbox) < float(ENROLL_RELAXED_MIN_BOX_SIZE):
                    continue
                landmarks = best.get("landmarks") if isinstance(best, dict) else None
                emb = _get_face_embedding(img, bbox, landmarks=landmarks)
                if emb is None:
                    continue
                embeddings_by_name.setdefault(name, []).append(emb)
                relaxed_added += 1
                if ENROLL_CCTV_AUGMENT:
                    for aug_img in _generate_cctv_augmented_views(img):
                        emb_aug = _get_face_embedding(aug_img, bbox, landmarks=landmarks)
                        if emb_aug is not None:
                            embeddings_by_name[name].append(emb_aug)
                flip_img = cv2.flip(img, 1)
                ih, iw = img.shape[:2]
                x1, y1, x2, y2 = bbox
                flip_bbox = [float(iw - 1 - x2), float(y1), float(iw - 1 - x1), float(y2)]
                flip_landmarks = _flip_landmarks(landmarks, iw)
                emb_flip = _get_face_embedding(flip_img, flip_bbox, landmarks=flip_landmarks)
                if emb_flip is not None:
                    embeddings_by_name[name].append(emb_flip)
        if relaxed_added > 0:
            print(f"ℹ️ Enrollment relaxed backfill added={relaxed_added} target={relaxed_target} max_faces={ENROLL_RELAXED_MAX_FACES}")
        if relaxed_skipped_too_many_faces > 0:
            print(f"ℹ️ Enrollment relaxed backfill skipped too-many-face images: {relaxed_skipped_too_many_faces}")

    if embeddings_by_name:
        sample_embeddings = []
        sample_names = []
        avg_embeddings = []
        avg_names = []
        for name, emb_list in embeddings_by_name.items():
            if not emb_list:
                continue
            filtered_list = _filter_person_embeddings(name, emb_list)
            if not filtered_list:
                continue
            if len(filtered_list) < max(1, int(ENROLL_MIN_PER_PERSON_EMBEDS)):
                print(f"⚠️ Enrollment warning: {name} has only {len(filtered_list)} embeddings (min_target={ENROLL_MIN_PER_PERSON_EMBEDS})")
            for emb in filtered_list:
                sample_embeddings.append(emb)
                sample_names.append(name)
            mean_emb = np.mean(np.stack(filtered_list, axis=0), axis=0)
            mean_emb = _l2_normalize(mean_emb)
            avg_embeddings.append(mean_emb)
            avg_names.append(name)
        known_embeddings = np.stack(sample_embeddings, axis=0).astype(np.float32) if sample_embeddings else _empty_embeddings()
        known_names = sample_names
        centroid_embeddings = np.stack(avg_embeddings, axis=0).astype(np.float32) if avg_embeddings else _empty_embeddings()
        centroid_names = avg_names
    else:
        known_embeddings = _empty_embeddings()
        known_names = []
        centroid_embeddings = _empty_embeddings()
        centroid_names = []

    print(
        f"✅ Face dataset loaded (people={len(centroid_names)}, sample_embeddings={len(known_names)}, images={total_images}, "
        f"skipped_no_face={skipped_no_face}, skipped_multi_face={skipped_multi_face}, "
        f"skipped_low_score={skipped_low_face_score}, skipped_small_face={skipped_small_face})"
    )
    _calibrate_recog_runtime_thresholds()
    _save_face_dataset_cache(dataset_fingerprint)


# ── Query embedding ──────────────────────────────────────────────────────────

def _pick_best_query_embedding(candidates):
    if not candidates:
        return None
    if len(candidates) == 1:
        return candidates[0].astype(np.float32)
    if centroid_embeddings is not None and centroid_embeddings.shape[0] > 0:
        best_idx = 0
        best_score = -1.0
        for idx, emb in enumerate(candidates):
            score = float(np.max(centroid_embeddings @ emb))
            if score > best_score:
                best_score = score
                best_idx = idx
        return candidates[best_idx].astype(np.float32)
    fused = _l2_normalize(np.mean(np.stack(candidates, axis=0), axis=0))
    return fused.astype(np.float32)


def _get_query_embedding(frame, bbox, landmarks=None):
    if not bbox or len(bbox) < 4:
        return None
    h, w = frame.shape[:2]
    x1, y1, x2, y2 = [float(v) for v in bbox[:4]]
    flip_frame = cv2.flip(frame, 1)
    flip_bbox = [float(w - 1 - x2), y1, float(w - 1 - x1), y2]
    flip_landmarks = _flip_landmarks(landmarks, w)
    candidates = []
    for offset in RECOG_QUERY_PAD_OFFSETS:
        pad_bonus = FACE_EMBED_PAD_BONUS + float(offset)
        emb = _get_face_embedding(frame, bbox, landmarks=landmarks, pad_bonus=pad_bonus)
        if emb is None:
            continue
        candidates.append(emb.astype(np.float32))
        emb_flip = _get_face_embedding(flip_frame, flip_bbox, landmarks=flip_landmarks, pad_bonus=pad_bonus)
        if emb_flip is not None:
            fused_flip = _l2_normalize((emb + emb_flip) / 2.0)
            candidates.append(fused_flip.astype(np.float32))
    return _pick_best_query_embedding(candidates)


# ── Identity matching ────────────────────────────────────────────────────────

def match_face_identity(frame, bbox, landmarks=None, threshold_boost=0.0):
    if known_embeddings is None or known_embeddings.shape[0] == 0:
        return None

    emb = _get_query_embedding(frame, bbox, landmarks=landmarks)
    if emb is None:
        return None

    emb = emb.astype(np.float32)
    sample_sims = known_embeddings @ emb
    name_to_scores = {}
    for i, name in enumerate(known_names):
        name_to_scores.setdefault(name, []).append(float(sample_sims[i]))

    if not name_to_scores:
        return None

    centroid_score_by_name = {}
    if centroid_embeddings is not None and centroid_embeddings.shape[0] > 0:
        centroid_sims = centroid_embeddings @ emb
        for i, name in enumerate(centroid_names):
            centroid_score_by_name[name] = float(centroid_sims[i])

    ranked_scores = []
    for name, scores in name_to_scores.items():
        scores_sorted = sorted(scores, reverse=True)
        sample_best = float(scores_sorted[0])
        top_k = scores_sorted[:max(1, RECOG_TOPK)]
        sample_topk = float(np.mean(top_k))
        centroid_score = centroid_score_by_name.get(name, sample_best)
        support_count = int(np.sum(np.asarray(scores_sorted, dtype=np.float32) >= float(recog_support_sim_runtime)))
        final_score = _score_face_candidate(sample_best, centroid_score)
        ranked_scores.append((name, final_score, sample_best, sample_topk, centroid_score, support_count, len(scores_sorted)))

    ranked_scores.sort(key=lambda x: x[1], reverse=True)
    best_name, best_score, best_sample, best_topk, best_centroid, best_support, best_samples = ranked_scores[0]

    top_candidates = [
        {
            "name": item[0],
            "score": float(item[1]),
            "sampleBest": float(item[2]),
            "sampleTopK": float(item[3]),
            "centroidScore": float(item[4]),
            "support": int(item[5]),
            "info": person_info_by_name.get(item[0]),
        }
        for item in ranked_scores[:min(3, len(ranked_scores))]
    ]

    required_support_cfg = int(RECOG_MIN_SUPPORT_COUNT)
    if _is_arcface_embedder_active() and RECOG_CCTV_RELAX_ENABLED:
        required_support_cfg = max(1, required_support_cfg - 1)

    min_required_support = min(max(1, required_support_cfg), max(1, int(best_samples)))
    second_score = float(ranked_scores[1][1]) if len(ranked_scores) > 1 else -1.0
    score_margin = float(best_score - second_score) if second_score >= 0.0 else 1.0

    match_threshold = float(recog_threshold_runtime + max(0.0, float(threshold_boost)))
    if best_score < match_threshold:
        score_tolerance = max(0.0, float(RECOG_SCORE_TOLERANCE))
        soft_floor = float(match_threshold - score_tolerance)
        can_soft_accept = (
            score_tolerance > 0.0
            and best_score >= soft_floor
            and best_support >= min_required_support
            and best_centroid >= float(recog_min_centroid_score_runtime)
            and score_margin >= float(RECOG_MARGIN)
        )
        if not can_soft_accept:
            print(f"ℹ️ Face match rejected: best={best_name} score={best_score:.3f} < threshold={match_threshold:.3f}")
            return None
        print(
            f"ℹ️ Face match soft-accepted: best={best_name} score={best_score:.3f} within tolerance={score_tolerance:.3f} "
            f"(threshold={match_threshold:.3f}, centroid={best_centroid:.3f}, support={best_support}/{best_samples}, margin={score_margin:.3f})"
        )

    if best_support < min_required_support:
        print(f"ℹ️ Face match rejected: low support best={best_name} support={best_support}/{best_samples} required={min_required_support} sim>={recog_support_sim_runtime:.3f}")
        return None

    if best_centroid < float(recog_min_centroid_score_runtime):
        print(f"ℹ️ Face match rejected: weak centroid best={best_name} centroid={best_centroid:.3f} min={recog_min_centroid_score_runtime:.3f}")
        return None

    if centroid_score_by_name and float(RECOG_MAX_CENTROID_GAP) >= 0.0:
        centroid_leader_name, centroid_leader_score = max(centroid_score_by_name.items(), key=lambda item: item[1])
        centroid_gap = float(centroid_leader_score - best_centroid)
        if centroid_gap > float(RECOG_MAX_CENTROID_GAP):
            print(f"ℹ️ Face match rejected: centroid mismatch best={best_name}({best_centroid:.3f}) centroid_leader={centroid_leader_name}({centroid_leader_score:.3f}) gap={centroid_gap:.3f} max={RECOG_MAX_CENTROID_GAP:.3f}")
            return None

    if len(ranked_scores) > 1:
        second_name, second_score, _, _, _, _, _ = ranked_scores[1]
        margin = best_score - second_score
        if margin < RECOG_MARGIN:
            print(f"ℹ️ Face match ambiguous: best={best_name}({best_score:.3f}) second={second_name}({second_score:.3f}) margin={margin:.3f}")
            if not RECOG_ALLOW_AMBIGUOUS:
                print("ℹ️ Face match rejected: ambiguous identity")
                return None
            return {
                "name": best_name, "score": best_score,
                "info": person_info_by_name.get(best_name),
                "is_ambiguous": True, "margin": margin, "candidates": top_candidates,
            }

    print(f"✅ Face match: {best_name} score={best_score:.3f} sample_best={best_sample:.3f} sample_topk={best_topk:.3f} centroid={best_centroid:.3f} support={best_support}/{best_samples}")
    return {
        "name": best_name, "score": best_score,
        "info": person_info_by_name.get(best_name),
        "is_ambiguous": False, "candidates": top_candidates,
    }


# ── Voting helpers (used by pipeline orchestration in main.py) ───────────────

def _record_person_vote(pending_weapon, match):
    if pending_weapon is None or not match:
        return
    pending_weapon["person_vote_samples"] = int(pending_weapon.get("person_vote_samples", 0)) + 1
    votes = pending_weapon.setdefault("person_votes", {})

    def _add_vote(name, score, info, points):
        if not name:
            return
        if name not in votes:
            votes[name] = {"points": 0.0, "scores": [], "info": info}
        votes[name]["points"] += float(points)
        if score is not None:
            votes[name]["scores"].append(float(score))
        if votes[name].get("info") is None and info is not None:
            votes[name]["info"] = info

    candidates = match.get("candidates")
    if match.get("is_ambiguous") and candidates and len(candidates) > 1:
        raw_scores = np.asarray([float(c.get("score", 0.0)) for c in candidates], dtype=np.float32)
        max_score = float(np.max(raw_scores)) if raw_scores.size else 0.0
        logits = (raw_scores - max_score) / 0.02
        exp_vals = np.exp(logits)
        denom = float(np.sum(exp_vals))
        if denom <= 0.0:
            weights = np.ones_like(raw_scores) / float(max(1, len(raw_scores)))
        else:
            weights = exp_vals / denom
        for idx, candidate in enumerate(candidates):
            _add_vote(candidate.get("name"), candidate.get("score"), candidate.get("info"), float(weights[idx]))
        return
    _add_vote(match.get("name"), match.get("score"), match.get("info"), 1.0)


def _resolve_person_from_votes(pending_weapon):
    if pending_weapon is None:
        return None
    votes = pending_weapon.get("person_votes") or {}
    if not votes:
        return None
    total_samples = int(pending_weapon.get("person_vote_samples", 0))
    if total_samples <= 0:
        return None
    ranked = []
    for name, data in votes.items():
        points = float(data.get("points", 0.0))
        scores = data.get("scores") or []
        avg_score = float(np.mean(scores)) if scores else 0.0
        ranked.append((name, points, avg_score, data.get("info")))
    ranked.sort(key=lambda x: (x[1], x[2]), reverse=True)
    best_name, best_points, best_avg_score, best_info = ranked[0]
    total_points = float(sum(item[1] for item in ranked))
    ratio = best_points / float(max(1e-6, total_points))
    if total_samples < FACE_RECOG_MIN_MATCHES:
        print(f"ℹ️ Face vote unresolved: insufficient samples total_samples={total_samples} required={FACE_RECOG_MIN_MATCHES}")
        return None
    if ratio < FACE_RECOG_CONSENSUS_RATIO:
        print(f"ℹ️ Face vote unresolved: low consensus best={best_name} points={best_points:.2f}/{total_points:.2f} ratio={ratio:.2f}")
        return None
    if best_avg_score < face_recog_min_avg_score_runtime:
        print(f"ℹ️ Face vote unresolved: low avg score best={best_name} avg_score={best_avg_score:.3f} min={face_recog_min_avg_score_runtime:.3f}")
        return None
    print(f"✅ Face vote resolved: {best_name} points={best_points:.2f}/{total_points:.2f} ratio={ratio:.2f} avg_score={best_avg_score:.3f} samples={total_samples}")
    return {"name": best_name, "score": best_avg_score, "info": best_info}
