import os
import sys
import cv2
import base64
import numpy as np
import torch

# Allow imports of models/, layers/, utils/ from AIService root
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from models.retinaface import RetinaFace
from data.config import cfg_re50
from layers.functions.prior_box import PriorBox
from utils.box_utils import decode, decode_landm
from utils.nms.py_cpu_nms import py_cpu_nms

BASE_DIR = os.path.dirname(os.path.dirname(__file__))

FACE_MODEL_PATH = os.path.abspath(os.path.join(BASE_DIR, 'model', 'Facedetect_resnet.pth'))

FACE_CONFIDENCE_THRESHOLD = 0.3
FACE_WINDOW_DURATION = 10

FACE_CROP_PROFILE = os.environ.get("FACE_CROP_PROFILE", "legacy").strip().lower()
FACE_PAD_RATIO = float(os.environ.get("FACE_PAD_RATIO", "0.15"))
FACE_PAD_RATIO_MIN = float(os.environ.get("FACE_PAD_RATIO_MIN", "0.00"))
FACE_PAD_RATIO_MAX = float(os.environ.get("FACE_PAD_RATIO_MAX", "0.20"))
FACE_TARGET_OCCUPANCY = float(os.environ.get("FACE_TARGET_OCCUPANCY", "0.80"))
FACE_ALIGN_EMBEDDINGS = os.environ.get("FACE_ALIGN_EMBEDDINGS", "1").strip().lower() in {"1", "true", "yes", "y", "on"}
FACE_EMBED_FUSE_ALIGN_AND_CROP = os.environ.get("FACE_EMBED_FUSE_ALIGN_AND_CROP", "1").strip().lower() in {"1", "true", "yes", "y", "on"}
FACE_PROFILE_YAW_THRESHOLD = float(os.environ.get("FACE_PROFILE_YAW_THRESHOLD", "0.30"))
FACE_SNAPSHOT_PAD_BONUS = float(os.environ.get("FACE_SNAPSHOT_PAD_BONUS", "0.00"))
FACE_SNAPSHOT_FORCE_SQUARE = os.environ.get("FACE_SNAPSHOT_FORCE_SQUARE", "1").strip().lower() in {"1", "true", "yes", "y", "on"}
FACE_SNAPSHOT_TARGET_OCCUPANCY = float(os.environ.get("FACE_SNAPSHOT_TARGET_OCCUPANCY", "0.56"))
FACE_SNAPSHOT_PAD_RATIO_MIN = float(os.environ.get("FACE_SNAPSHOT_PAD_RATIO_MIN", "0.12"))
FACE_SNAPSHOT_PAD_RATIO_MAX = float(os.environ.get("FACE_SNAPSHOT_PAD_RATIO_MAX", "0.50"))
FACE_ALERT_SNAPSHOT_ALLOW_RELAXED_FALLBACK = os.environ.get("FACE_ALERT_SNAPSHOT_ALLOW_RELAXED_FALLBACK", "1").strip().lower() in {"1", "true", "yes", "y", "on"}
FACE_EMBED_PAD_BONUS = float(os.environ.get("FACE_EMBED_PAD_BONUS", "0.00"))
FACE_LM_SIDE_EXPAND = float(os.environ.get("FACE_LM_SIDE_EXPAND", "0.70"))
FACE_LM_TOP_EXPAND = float(os.environ.get("FACE_LM_TOP_EXPAND", "1.25"))
FACE_LM_BOTTOM_EXPAND = float(os.environ.get("FACE_LM_BOTTOM_EXPAND", "1.00"))
FACE_REQUIRE_FULL_FACE_FOR_ALERT = os.environ.get("FACE_REQUIRE_FULL_FACE_FOR_ALERT", "1").strip().lower() in {"1", "true", "yes", "y", "on"}
FACE_REQUIRE_FULL_FACE_FOR_RECOG = os.environ.get("FACE_REQUIRE_FULL_FACE_FOR_RECOG", "0").strip().lower() in {"1", "true", "yes", "y", "on"}
FACE_FULL_EDGE_MARGIN_RATIO = float(os.environ.get("FACE_FULL_EDGE_MARGIN_RATIO", "0.01"))
FACE_WEAPON_ASSOC_MAX_DIST_RATIO = float(os.environ.get("FACE_WEAPON_ASSOC_MAX_DIST_RATIO", "0.75"))
FACE_WEAPON_ASSOC_WEAPON_EXPAND_RATIO = float(os.environ.get("FACE_WEAPON_ASSOC_WEAPON_EXPAND_RATIO", "0.90"))
FACE_WEAPON_ASSOC_MIN_SCORE = float(os.environ.get("FACE_WEAPON_ASSOC_MIN_SCORE", "0.15"))
FACE_TRACK_IOU_MIN = float(os.environ.get("FACE_TRACK_IOU_MIN", "0.25"))
FACE_REFINEMENT_ON_FULL_RES = os.environ.get("FACE_REFINEMENT_ON_FULL_RES", "1").strip().lower() in {"1", "true", "yes", "y", "on"}
FACE_RECOG_MIN_BOX_SIZE = int(os.environ.get("FACE_RECOG_MIN_BOX_SIZE", "70"))

face_model = None
face_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def load_face_model():
    """Load the fine-tuned RetinaFace model using the SAME architecture as training."""
    global face_model

    if face_model is not None:
        return

    if not os.path.exists(FACE_MODEL_PATH):
        print(f"⚠️ Face model file not found at {FACE_MODEL_PATH}")
        return

    print(f"Loading RetinaFace (ResNet50, original arch) from {FACE_MODEL_PATH}")

    try:
        cfg_re50['pretrain'] = False
        net = RetinaFace(cfg=cfg_re50, phase="test")

        checkpoint = torch.load(FACE_MODEL_PATH, map_location="cpu")
        state_dict = checkpoint.get("model_state_dict", checkpoint)

        from collections import OrderedDict
        cleaned = OrderedDict()
        for k, v in state_dict.items():
            cleaned[k[7:] if k.startswith("module.") else k] = v

        net.load_state_dict(cleaned)
        print("✅ All face model weights loaded (exact match)")

        net = net.to(face_device)
        net.eval()
        face_model = net
        print(f"Face model loaded successfully (device: {face_device})")
    except Exception as e:
        print("❌ Failed to load face model:", e)
        import traceback
        traceback.print_exc()
        face_model = None


def detect_faces(frame):
    """Run face detection using the original RetinaFace inference pipeline."""
    if face_model is None:
        return []

    try:
        img_raw = frame.copy()
        img = np.float32(img_raw)
        im_height, im_width, _ = img.shape

        img -= np.array([104.0, 117.0, 123.0], dtype=np.float32)
        img = img.transpose(2, 0, 1)
        img = torch.from_numpy(img).unsqueeze(0).to(face_device)

        with torch.no_grad():
            loc, conf, landms = face_model(img)

        priorbox = PriorBox(cfg_re50, image_size=(im_height, im_width))
        priors = priorbox.forward().to(face_device)

        boxes = decode(loc.data.squeeze(0), priors.data, cfg_re50['variance'])
        scale = torch.tensor([im_width, im_height, im_width, im_height],
                             dtype=torch.float32, device=face_device)
        boxes = boxes * scale
        boxes = boxes.cpu().numpy()

        landms = decode_landm(landms.data.squeeze(0), priors.data, cfg_re50['variance'])
        scale1 = torch.tensor(
            [im_width, im_height, im_width, im_height, im_width, im_height, im_width, im_height, im_width, im_height],
            dtype=torch.float32,
            device=face_device,
        )
        landms = landms * scale1
        landms = landms.cpu().numpy()

        scores = conf.data.squeeze(0)[:, 1].cpu().numpy()

        inds = np.where(scores >= FACE_CONFIDENCE_THRESHOLD)[0]
        boxes = boxes[inds]
        scores = scores[inds]
        landms = landms[inds]

        if len(boxes) == 0:
            return []

        dets = np.hstack((boxes, scores[:, np.newaxis])).astype(np.float32, copy=False)
        keep = py_cpu_nms(dets, 0.4)
        dets = dets[keep, :]
        landms = landms[keep]

        faces = []
        for idx, det in enumerate(dets):
            x1, y1, x2, y2, score = det
            lm = landms[idx].reshape((5, 2)).astype(np.float32).tolist() if idx < len(landms) else None
            faces.append({
                "bbox": [float(x1), float(y1), float(x2), float(y2)],
                "score": float(score),
                "landmarks": lm,
            })

        if faces:
            print(f"✅ Face(s) detected: {len(faces)} (top score={faces[0]['score']:.3f})")

        return faces
    except Exception as e:
        print("❌ Face detection error:", e)
        import traceback
        traceback.print_exc()
        return []


# ── Geometry / bbox helpers ──────────────────────────────────────────────────

def _normalize_landmarks(landmarks):
    if landmarks is None:
        return None
    try:
        pts = np.asarray(landmarks, dtype=np.float32).reshape(-1, 2)
    except Exception:
        return None
    if pts.shape[0] < 5 or not np.isfinite(pts).all():
        return None
    return pts[:5]


def _estimate_face_profile_strength(landmarks):
    pts = _normalize_landmarks(landmarks)
    if pts is None:
        return 0.0
    left_eye = pts[0]
    right_eye = pts[1]
    nose = pts[2]
    left_dist = abs(float(nose[0] - left_eye[0]))
    right_dist = abs(float(right_eye[0] - nose[0]))
    denom = max(1e-6, left_dist + right_dist)
    asym = abs(left_dist - right_dist) / denom
    return float(np.clip(asym, 0.0, 1.0))


def _scale_landmarks(landmarks, scale_factor):
    pts = _normalize_landmarks(landmarks)
    if pts is None:
        return None
    scaled = pts * float(scale_factor)
    return scaled.astype(np.float32).tolist()


def _flip_landmarks(landmarks, image_width):
    pts = _normalize_landmarks(landmarks)
    if pts is None:
        return None
    flipped = pts.copy()
    flipped[:, 0] = (float(image_width) - 1.0) - flipped[:, 0]
    reordered = np.asarray(
        [flipped[1], flipped[0], flipped[2], flipped[4], flipped[3]],
        dtype=np.float32,
    )
    return reordered.tolist()


def _clip_bbox_xyxy(bbox, frame_shape):
    if not bbox or len(bbox) < 4:
        return None
    h, w = frame_shape[:2]
    x1, y1, x2, y2 = [float(v) for v in bbox[:4]]
    x1 = max(0.0, min(float(max(0, w - 1)), x1))
    y1 = max(0.0, min(float(max(0, h - 1)), y1))
    x2 = max(0.0, min(float(w), x2))
    y2 = max(0.0, min(float(h), y2))
    if x2 <= x1 or y2 <= y1:
        return None
    return [x1, y1, x2, y2]


def _expand_bbox_xyxy(bbox, frame_shape, pad_ratio):
    clipped = _clip_bbox_xyxy(bbox, frame_shape)
    if not clipped:
        return None
    x1, y1, x2, y2 = clipped
    bw = max(1.0, x2 - x1)
    bh = max(1.0, y2 - y1)
    pad = float(pad_ratio)
    expanded = [
        x1 - (bw * pad),
        y1 - (bh * pad),
        x2 + (bw * pad),
        y2 + (bh * pad),
    ]
    return _clip_bbox_xyxy(expanded, frame_shape)


def _to_square_bbox(bbox, frame_shape, pad_ratio=FACE_PAD_RATIO):
    if not bbox or len(bbox) < 4:
        return None
    h, w = frame_shape[:2]
    x1, y1, x2, y2 = map(float, bbox[:4])
    bw = max(1.0, x2 - x1)
    bh = max(1.0, y2 - y1)
    side = max(1.0, max(bw, bh) * (1.0 + (2.0 * float(pad_ratio))))
    side_i = int(round(side))
    side_i = max(1, min(side_i, int(min(h, w))))
    cx = (x1 + x2) / 2.0
    cy = (y1 + y2) / 2.0
    half = side_i / 2.0
    sx1 = int(round(cx - half))
    sy1 = int(round(cy - half))
    sx2 = sx1 + side_i
    sy2 = sy1 + side_i
    if sx1 < 0:
        shift = -sx1; sx1 = 0; sx2 = min(int(w), sx2 + shift)
    if sy1 < 0:
        shift = -sy1; sy1 = 0; sy2 = min(int(h), sy2 + shift)
    if sx2 > int(w):
        shift = sx2 - int(w); sx2 = int(w); sx1 = max(0, sx1 - shift)
    if sy2 > int(h):
        shift = sy2 - int(h); sy2 = int(h); sy1 = max(0, sy1 - shift)
    width = sx2 - sx1
    height = sy2 - sy1
    side_f = min(width, height)
    if side_f <= 0:
        return None
    sx2 = sx1 + side_f
    sy2 = sy1 + side_f
    if sx2 <= sx1 or sy2 <= sy1:
        return None
    return [sx1, sy1, sx2, sy2]


def _adaptive_face_pad_ratio(bbox, target_occupancy=FACE_TARGET_OCCUPANCY):
    if not bbox or len(bbox) < 4:
        return float(FACE_PAD_RATIO)
    x1, y1, x2, y2 = map(float, bbox[:4])
    bw = max(1.0, x2 - x1)
    bh = max(1.0, y2 - y1)
    max_dim = max(1.0, max(bw, bh))
    area = max(1.0, bw * bh)
    occupancy = float(np.clip(float(target_occupancy), 0.60, 0.90))
    desired_side = max(max_dim, float(np.sqrt(area / occupancy)))
    pad_ratio = (desired_side / max_dim - 1.0) / 2.0
    pad_min = min(float(FACE_PAD_RATIO_MIN), float(FACE_PAD_RATIO_MAX))
    pad_max = max(float(FACE_PAD_RATIO_MIN), float(FACE_PAD_RATIO_MAX))
    return float(np.clip(pad_ratio, pad_min, pad_max))


def _face_square_bbox_for_recognition(bbox, frame_shape, pad_bonus=0.0):
    if not bbox or len(bbox) < 4:
        return None
    pad_ratio = _adaptive_face_pad_ratio(bbox) + float(pad_bonus)
    pad_min = min(float(FACE_PAD_RATIO_MIN), float(FACE_PAD_RATIO_MAX))
    pad_max = max(float(FACE_PAD_RATIO_MIN), float(FACE_PAD_RATIO_MAX))
    pad_ratio = float(np.clip(pad_ratio, pad_min, pad_max))
    return _to_square_bbox(bbox, frame_shape, pad_ratio=pad_ratio)


def _landmark_guided_bbox(landmarks, bbox, frame_shape):
    base_bbox = _clip_bbox_xyxy(bbox, frame_shape) if bbox and len(bbox) >= 4 else None
    if not landmarks or len(landmarks) < 5:
        return base_bbox
    pts = np.asarray(landmarks, dtype=np.float32).reshape(-1, 2)
    if not np.isfinite(pts).all():
        return base_bbox
    lx1 = float(np.min(pts[:, 0]))
    ly1 = float(np.min(pts[:, 1]))
    lx2 = float(np.max(pts[:, 0]))
    ly2 = float(np.max(pts[:, 1]))
    eye_center = np.mean(pts[0:2], axis=0)
    mouth_center = np.mean(pts[3:5], axis=0)
    eye_dist = float(np.linalg.norm(pts[0] - pts[1]))
    span = max(1.0, float(mouth_center[1] - eye_center[1]))
    side_extra = (float(FACE_LM_SIDE_EXPAND) * span) + (0.35 * max(1.0, eye_dist))
    lm_bbox = [
        lx1 - side_extra,
        ly1 - (float(FACE_LM_TOP_EXPAND) * span),
        lx2 + side_extra,
        ly2 + (float(FACE_LM_BOTTOM_EXPAND) * span),
    ]
    if base_bbox:
        bx1, by1, bx2, by2 = base_bbox
        lm_bbox = [
            min(float(bx1), float(lm_bbox[0])),
            min(float(by1), float(lm_bbox[1])),
            max(float(bx2), float(lm_bbox[2])),
            max(float(by2), float(lm_bbox[3])),
        ]
    return _clip_bbox_xyxy(lm_bbox, frame_shape)


def _face_square_bbox_for_snapshot(bbox, frame_shape, landmarks=None):
    base_bbox = _landmark_guided_bbox(landmarks, bbox, frame_shape)
    if not base_bbox:
        return None
    if not FACE_SNAPSHOT_FORCE_SQUARE:
        applied_pad = float(FACE_PAD_RATIO + float(FACE_SNAPSHOT_PAD_BONUS))
        return _expand_bbox_xyxy(base_bbox, frame_shape, pad_ratio=applied_pad)
    target_occupancy = float(np.clip(FACE_SNAPSHOT_TARGET_OCCUPANCY, 0.45, 0.90))
    pad_ratio = _adaptive_face_pad_ratio(base_bbox, target_occupancy=target_occupancy)
    pad_ratio += float(FACE_SNAPSHOT_PAD_BONUS)
    pad_min = min(float(FACE_SNAPSHOT_PAD_RATIO_MIN), float(FACE_SNAPSHOT_PAD_RATIO_MAX))
    pad_max = max(float(FACE_SNAPSHOT_PAD_RATIO_MIN), float(FACE_SNAPSHOT_PAD_RATIO_MAX))
    pad_ratio = float(np.clip(pad_ratio, pad_min, pad_max))
    return _to_square_bbox(base_bbox, frame_shape, pad_ratio=pad_ratio)


def _is_face_full_enough(bbox, frame_shape, landmarks=None):
    clipped = _clip_bbox_xyxy(bbox, frame_shape)
    if not clipped:
        return False, "invalid_bbox"
    x1, y1, x2, y2 = [float(v) for v in clipped]
    min_side = max(1.0, min(x2 - x1, y2 - y1))
    if min_side < 36.0:
        return False, "tiny_crop"
    pts = _normalize_landmarks(landmarks)
    if pts is None:
        return True, "ok_no_landmarks"
    profile_strength = _estimate_face_profile_strength(pts)
    edge_margin_ratio = float(max(0.0, FACE_FULL_EDGE_MARGIN_RATIO))
    profile_relax = 0.45 if profile_strength >= float(FACE_PROFILE_YAW_THRESHOLD) else 1.0
    box_margin = max(2.0, edge_margin_ratio * min_side) * profile_relax
    if (
        float(np.min(pts[:, 0])) <= (x1 + box_margin)
        or float(np.max(pts[:, 0])) >= (x2 - box_margin)
        or float(np.min(pts[:, 1])) <= (y1 + box_margin)
        or float(np.max(pts[:, 1])) >= (y2 - box_margin)
    ):
        return False, "landmarks_at_crop_edge"
    return True, "ok"


def _bbox_min_side(bbox):
    if not bbox or len(bbox) < 4:
        return 0.0
    x1, y1, x2, y2 = [float(v) for v in bbox[:4]]
    return float(max(0.0, min(x2 - x1, y2 - y1)))


def _bbox_iou(box_a, box_b):
    if not box_a or not box_b:
        return 0.0
    ax1, ay1, ax2, ay2 = [float(v) for v in box_a[:4]]
    bx1, by1, bx2, by2 = [float(v) for v in box_b[:4]]
    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)
    inter_w = max(0.0, inter_x2 - inter_x1)
    inter_h = max(0.0, inter_y2 - inter_y1)
    inter_area = inter_w * inter_h
    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = area_a + area_b - inter_area
    if union <= 0.0:
        return 0.0
    return inter_area / union


def _align_face_chip(frame, landmarks, output_size=112):
    pts = _normalize_landmarks(landmarks)
    if pts is None:
        return None
    if float(np.linalg.norm(pts[0] - pts[1])) < 2.0:
        return None
    dst = np.asarray(
        [
            [38.2946, 51.6963],
            [73.5318, 51.5014],
            [56.0252, 71.7366],
            [41.5493, 92.3655],
            [70.7299, 92.2041],
        ],
        dtype=np.float32,
    )
    if int(output_size) != 112:
        dst = dst * (float(output_size) / 112.0)
    transform, _ = cv2.estimateAffinePartial2D(pts, dst, method=cv2.LMEDS)
    if transform is None:
        return None
    chip = cv2.warpAffine(
        frame,
        transform,
        (int(output_size), int(output_size)),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_REPLICATE,
    )
    if chip is None or chip.size == 0:
        return None
    return chip


def _bbox_from_face_candidate(face, frame_shape):
    bbox = face.get("bbox") if isinstance(face, dict) else None
    landmarks = face.get("landmarks") if isinstance(face, dict) else None
    guided_bbox = _landmark_guided_bbox(landmarks, bbox, frame_shape)
    if not guided_bbox:
        return None
    if FACE_CROP_PROFILE == "legacy":
        return guided_bbox
    return _to_square_bbox(guided_bbox, frame_shape, pad_ratio=0.0)


def _face_sharpness(frame, bbox):
    if FACE_CROP_PROFILE == "legacy":
        crop_bbox = _clip_bbox_xyxy(bbox, frame.shape)
    else:
        crop_bbox = _to_square_bbox(bbox, frame.shape, pad_ratio=0.0)
    if not crop_bbox:
        return 0.0
    x1, y1, x2, y2 = [int(v) for v in crop_bbox]
    crop = frame[y1:y2, x1:x2]
    if crop.size == 0:
        return 0.0
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def _face_snapshot_quality(face_score, sharpness, bbox):
    min_side = _bbox_min_side(bbox)
    side_score = float(np.clip(min_side / 220.0, 0.0, 1.0))
    sharp_score = float(np.clip(sharpness / 180.0, 0.0, 1.0))
    conf_score = float(np.clip(face_score, 0.0, 1.0))
    return (0.55 * conf_score) + (0.25 * sharp_score) + (0.20 * side_score)


def _scale_bbox(bbox, scale_factor):
    if not bbox or len(bbox) < 4:
        return None
    return [float(v) * scale_factor for v in bbox[:4]]


def _crop_face_to_data_url(frame, bbox, landmarks=None, require_full_face=FACE_REQUIRE_FULL_FACE_FOR_ALERT):
    """Crop a face bbox and return it as a JPEG data URL."""
    if not bbox or len(bbox) < 4:
        return None
    crop_bbox = _face_square_bbox_for_snapshot(bbox, frame.shape, landmarks=landmarks)
    if not crop_bbox:
        return None
    if require_full_face:
        is_full_face, reason = _is_face_full_enough(crop_bbox, frame.shape, landmarks=landmarks)
        if not is_full_face:
            if FACE_ALERT_SNAPSHOT_ALLOW_RELAXED_FALLBACK:
                print(f"ℹ️ Alert face snapshot using relaxed fallback ({reason})")
            else:
                print(f"ℹ️ Alert face snapshot skipped: incomplete face ({reason})")
                return None
    x1, y1, x2, y2 = [int(v) for v in crop_bbox]
    if x2 <= x1 or y2 <= y1:
        return None
    face_crop = frame[y1:y2, x1:x2]
    success, buffer = cv2.imencode('.jpg', face_crop)
    if not success:
        return None
    b64_bytes = base64.b64encode(buffer.tobytes())
    b64_str = b64_bytes.decode('ascii')
    return f"data:image/jpeg;base64,{b64_str}"


def _frame_to_data_url(frame):
    """Encode a raw BGR frame as a base64 JPEG data URL."""
    if frame is None:
        return None
    try:
        ret, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        if not ret:
            return None
        b64 = base64.b64encode(buf.tobytes()).decode('utf-8')
        return f"data:image/jpeg;base64,{b64}"
    except Exception:
        return None


def _point_to_bbox_distance(px, py, bbox):
    if not bbox or len(bbox) < 4:
        return float("inf")
    x1, y1, x2, y2 = [float(v) for v in bbox[:4]]
    dx = max(x1 - float(px), 0.0, float(px) - x2)
    dy = max(y1 - float(py), 0.0, float(py) - y2)
    return float((dx * dx + dy * dy) ** 0.5)


def _select_face_near_weapon(faces, weapon_bbox, frame_shape, track_bbox=None):
    if not faces:
        return None

    valid_faces = [f for f in faces if isinstance(f, dict) and f.get("bbox") and len(f["bbox"]) >= 4]
    if not valid_faces:
        return None

    if not weapon_bbox or len(weapon_bbox) < 4:
        if track_bbox is not None:
            tracked_candidates = [
                (float(_bbox_iou(f["bbox"], track_bbox)), float(f.get("score", 0.0)), f)
                for f in valid_faces
                if _bbox_iou(f["bbox"], track_bbox) >= FACE_TRACK_IOU_MIN
            ]
            if tracked_candidates:
                tracked_candidates.sort(key=lambda x: (x[0], x[1]), reverse=True)
                return tracked_candidates[0][2]
        return max(valid_faces, key=lambda x: x.get("score", 0.0))

    h, w = frame_shape[:2]
    wx1, wy1, wx2, wy2 = [float(v) for v in weapon_bbox[:4]]
    wcx = (wx1 + wx2) / 2.0
    wcy = (wy1 + wy2) / 2.0
    wbw = max(1.0, wx2 - wx1)
    wbh = max(1.0, wy2 - wy1)
    expand_ratio = float(np.clip(FACE_WEAPON_ASSOC_WEAPON_EXPAND_RATIO, 0.20, 2.00))
    ex1 = max(0.0, wx1 - wbw * expand_ratio)
    ey1 = max(0.0, wy1 - wbh * expand_ratio)
    ex2 = min(float(w), wx2 + wbw * expand_ratio)
    ey2 = min(float(h), wy2 + wbh * expand_ratio)
    max_dist_ratio = float(np.clip(FACE_WEAPON_ASSOC_MAX_DIST_RATIO, 0.20, 1.50))
    max_dist = max(24.0, max_dist_ratio * max(h, w))
    min_assoc_score = float(np.clip(FACE_WEAPON_ASSOC_MIN_SCORE, 0.0, 0.9))

    candidates = []
    for face in valid_faces:
        bbox = face.get("bbox")
        fx1, fy1, fx2, fy2 = [float(v) for v in bbox[:4]]
        fw = max(1.0, fx2 - fx1)
        fh = max(1.0, fy2 - fy1)
        fcx = (fx1 + fx2) / 2.0
        fcy = (fy1 + fy2) / 2.0
        holder_zone = _clip_bbox_xyxy(
            [fx1 - (0.70 * fw), fy1 - (0.35 * fh), fx2 + (0.70 * fw), fy2 + (2.40 * fh)],
            frame_shape,
        )
        holder_zone_dist = _point_to_bbox_distance(wcx, wcy, holder_zone)
        center_dist = ((fcx - wcx) ** 2 + (fcy - wcy) ** 2) ** 0.5
        horizontal_dist = abs(fcx - wcx)
        below_weapon_dist = max(0.0, fcy - wcy)
        holder_zone_score = 1.0 - float(np.clip(holder_zone_dist / max_dist, 0.0, 1.0))
        center_score = 1.0 - float(np.clip(center_dist / max_dist, 0.0, 1.0))
        horizontal_score = 1.0 - float(np.clip(horizontal_dist / max(1.0, 0.45 * w), 0.0, 1.0))
        vertical_score = 1.0 - float(np.clip(below_weapon_dist / max(1.0, 0.30 * h), 0.0, 1.0))
        track_iou = _bbox_iou(bbox, track_bbox) if track_bbox is not None else 0.0
        track_score = float(np.clip(track_iou / max(0.05, float(FACE_TRACK_IOU_MIN)), 0.0, 1.0))
        face_score = float(np.clip(float(face.get("score", 0.0)), 0.0, 1.0))
        inside = (ex1 <= fcx <= ex2) and (ey1 <= fcy <= ey2)
        assoc_score = (
            (0.40 * holder_zone_score)
            + (0.23 * center_score)
            + (0.12 * horizontal_score)
            + (0.10 * vertical_score)
            + (0.08 * face_score)
            + (0.07 * track_score)
        )
        if inside:
            assoc_score += 0.05
        if holder_zone_dist <= 1.0:
            assoc_score += 0.08
        candidates.append((assoc_score, track_iou, holder_zone_dist, center_dist, face_score, face))

    if not candidates:
        return None

    ranked = sorted(
        candidates,
        key=lambda item: (item[0], item[1], -item[2], -item[3], item[4]),
        reverse=True,
    )

    if len(ranked) > 1:
        best_assoc = float(ranked[0][0])
        second_assoc = float(ranked[1][0])
        if (best_assoc - second_assoc) < 0.06:
            print(f"ℹ️ Multi-face holder selection ambiguous: best_assoc={best_assoc:.3f} second_assoc={second_assoc:.3f}")

    best_assoc, _, best_zone_dist, best_center_dist, _, best_face = ranked[0]
    if best_zone_dist > max_dist and best_center_dist > max_dist:
        return None
    if float(best_assoc) < min_assoc_score:
        return None

    return best_face
