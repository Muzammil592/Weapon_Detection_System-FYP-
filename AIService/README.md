# Weapon Detection AI Service

This is a FastAPI-based AI service for real-time weapon detection using YOLOv10.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Ensure the YOLOv10 model is at `../Yolov10/model.pt`

3. Ensure the ArcFace embedder model is available at one of these paths:
  - `model/arcface/buffalo_sc/w600k_mbf.onnx` (default)
  - `model/arcface_w600k_mbf.onnx`
  - `model/arcface_w600k_r50.onnx`

Legacy `cctv_face_embedder.onnx` is no longer auto-selected. If you need to force a legacy model for testing, set `FACE_EMBEDDER_PATH` explicitly.

You can override the embedder path with:

```bash
set FACE_EMBEDDER_PATH=C:\path\to\your\arcface.onnx
```

Recognition tuning defaults (new):

- Alert snapshots now prefer full-face square crops before sending to backend.
- ArcFace matching thresholds are auto-calibrated from enrolled embeddings at startup/cache rebuild.
- CCTV mode now relaxes ArcFace gates slightly and augments enrollment embeddings for low-light/compressed camera frames.

Optional overrides:

```bash
set FACE_REQUIRE_FULL_FACE_FOR_ALERT=1
set FACE_REQUIRE_FULL_FACE_FOR_RECOG=0
set RECOG_AUTO_CALIBRATE=1
set FACE_EMBED_FUSE_ALIGN_AND_CROP=1
set FACE_ALERT_SNAPSHOT_ALLOW_RELAXED_FALLBACK=1
set FACE_SNAPSHOT_TARGET_OCCUPANCY=0.56
set RECOG_CCTV_RELAX_ENABLED=1
set RECOG_CCTV_THRESHOLD_RELAX=0.07
set ENROLL_CCTV_AUGMENT=1
```

Behavior context:

- The behavior classifier runs for each weapon-triggered event clip.
- Suspicious vs non-suspicious routing is based on behavior model output only.

Optional overrides:

```bash
set BEHAVIOR_SUSPICIOUS_THRESHOLD=0.55
set BEHAVIOR_PRE_TRIGGER_RATIO=0.10
set BEHAVIOR_MIN_DECISION_SAMPLES=3
set BEHAVIOR_MIN_SUSPICIOUS_MARGIN=0.10
set BEHAVIOR_MIN_SUSPICIOUS_VOTE_RATIO=0.60
```

## Running the Service

```bash
python main.py
```

The service will run on `http://localhost:8000`

## API Endpoints

### POST /start-detection
Start weapon detection on an RTSP stream.

Request body:
```json
{
  "rtsp_url": "rtsp://example.com/stream",
  "location": "Main Entrance",
  "user_id": "user123"
}
```

### POST /stop-detection
Stop the current detection process.

### GET /health
Health check endpoint.

## Integration

The service sends detection results to the backend at `http://192.168.100.35:5000/api/detections/receive`

Make sure the backend is running and accessible.