import os
import numpy as np
from ultralytics import YOLO

BASE_DIR = os.path.dirname(os.path.dirname(__file__))

MODEL_PATH = os.path.abspath(os.path.join(BASE_DIR, '..', 'Yolov10', 'model.pt'))

CONFIDENCE_THRESHOLD = 0.6
DUPLICATE_TIME_WINDOW = 10
WEAPON_FACE_TRIGGER_LABELS = [
    label.strip().lower()
    for label in os.environ.get("WEAPON_FACE_TRIGGER_LABELS", "knife,pistol,gun,non-pistol,non_pistol").split(",")
    if label.strip()
]
WEAPON_CLASS_PRIORITY = [
    label.strip().lower()
    for label in os.environ.get("WEAPON_CLASS_PRIORITY", "knife,pistol,non-pistol,gun").split(",")
    if label.strip()
]
WEAPON_CLASS_PRIORITY_MARGIN = float(os.environ.get("WEAPON_CLASS_PRIORITY_MARGIN", "0.08"))

model = None


def load_model():
    global model
    if model is None:
        print(f"Loading YOLO model from {MODEL_PATH}")
        model = YOLO(MODEL_PATH)
        print("Weapon model loaded successfully")


def detect_weapons(frame):
    results = model(frame, conf=CONFIDENCE_THRESHOLD, verbose=True)
    detections = []

    def _normalize_weapon_label(label):
        raw = (label or "").strip().lower()
        normalized = []
        last_was_sep = False

        for ch in raw:
            if ch.isalnum():
                normalized.append(ch)
                last_was_sep = False
            elif not last_was_sep:
                normalized.append("_")
                last_was_sep = True

        return "".join(normalized).strip("_")

    def _select_trigger_weapon_index(items):
        if not items:
            return None

        priority_labels = [_normalize_weapon_label(item) for item in WEAPON_CLASS_PRIORITY]
        priority_by_label = {
            label: int(len(priority_labels) - idx)
            for idx, label in enumerate(priority_labels)
        }

        confidences = [float(item.get("confidence", 0.0)) for item in items]
        top_confidence = max(confidences)
        margin = float(np.clip(WEAPON_CLASS_PRIORITY_MARGIN, 0.0, 0.30))

        candidate_indices = [
            idx for idx, score in enumerate(confidences)
            if score >= (top_confidence - margin)
        ]

        if not candidate_indices:
            return int(np.argmax(confidences))

        return max(
            candidate_indices,
            key=lambda idx: (
                priority_by_label.get(_normalize_weapon_label(items[idx].get("weapon_type")), 0),
                confidences[idx],
            ),
        )

    def _is_face_trigger_weapon_label(label):
        normalized = _normalize_weapon_label(label)
        compact = normalized.replace("_", "")

        normalized_triggers = {
            _normalize_weapon_label(item) for item in WEAPON_FACE_TRIGGER_LABELS
        }
        compact_triggers = {item.replace("_", "") for item in normalized_triggers}

        return normalized in normalized_triggers or compact in compact_triggers

    for result in results:
        if not hasattr(result, 'boxes') or result.boxes is None:
            continue

        for box in result.boxes:
            cls = int(box.cls)
            conf = float(box.conf)
            class_name = model.names[cls]

            print(f"Detected: {class_name} with conf {conf}")

            if not _is_face_trigger_weapon_label(class_name):
                continue

            bbox = None
            if hasattr(box, "xyxy") and box.xyxy is not None:
                bbox = box.xyxy[0].tolist()
            detections.append({
                "weapon_type": class_name,
                "confidence": conf,
                "bbox": bbox
            })

    selected_idx = _select_trigger_weapon_index(detections)
    if selected_idx is None:
        return detections

    selected = detections[selected_idx]
    others = [
        det for idx, det in enumerate(detections)
        if idx != selected_idx
    ]
    others.sort(key=lambda item: float(item.get("confidence", 0.0)), reverse=True)

    ordered = [selected] + others
    return ordered
