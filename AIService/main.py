from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
import cv2
from ultralytics import YOLO
import requests
import time
from datetime import datetime
import os
import threading

app = FastAPI(title="Weapon Detection AI Service")

# ------------------ Configuration ------------------

BASE_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.abspath(os.path.join(BASE_DIR, '..', 'Yolov10', 'model.pt'))
BACKEND_URL = os.environ.get(
    'BACKEND_URL',
    "http://192.168.100.35:5000/api/detections/receive"
)

CONFIDENCE_THRESHOLD = 0.6
DUPLICATE_TIME_WINDOW = 10  # seconds

# ------------------ Globals ------------------

model = None
detection_active = False
last_detections = {}

latest_frame = None
frame_lock = threading.Lock()

# ------------------ Schemas ------------------

class DetectionRequest(BaseModel):
    rtsp_url: str
    location: str
    user_id: str | None = None

# ------------------ Model ------------------

def load_model():
    global model
    if model is None:
        print(f"Loading YOLO model from {MODEL_PATH}")
        model = YOLO(MODEL_PATH)
        print("Model loaded successfully")

# ------------------ Detection Logic ------------------

def detect_weapons(frame):
    results = model(frame, conf=CONFIDENCE_THRESHOLD, verbose=True)
    detections = []

    for result in results:
        if not hasattr(result, 'boxes') or result.boxes is None:
            continue

        for box in result.boxes:
            cls = int(box.cls)
            conf = float(box.conf)
            class_name = model.names[cls]

            print(f"Detected: {class_name} with conf {conf}")

            if class_name.lower() in ['knife', 'pistol', 'gun']:
                detections.append({
                    "weapon_type": class_name,
                    "confidence": conf
                })

    return detections

def send_detection_to_backend(weapon_type, location, confidence, user_id=None):
    payload = {
        "weaponType": weapon_type,
        "location": location,
        "confidence": confidence,
        "userId": user_id
    }

    try:
        response = requests.post(BACKEND_URL, json=payload, timeout=5)
        if response.status_code == 200:
            print(f"✅ Detection sent: {weapon_type}")
        else:
            print("❌ Backend error:", response.text)
    except Exception as e:
        print("❌ Request failed:", e)

# ------------------ Frame Grabber (NEW) ------------------

def frame_grabber(rtsp_url):
    global latest_frame, detection_active

    cap = cv2.VideoCapture(rtsp_url)
    if not cap.isOpened():
        print("❌ Unable to open RTSP stream")
        detection_active = False
        return

    print("📥 Frame grabber started")

    while detection_active:
        ret, frame = cap.read()
        if not ret:
            continue

        with frame_lock:
            latest_frame = frame

    cap.release()
    print("📥 Frame grabber stopped")

# ------------------ Stream Processing ------------------

def process_stream(rtsp_url, location, user_id=None):
    global detection_active, last_detections

    print("🎥 Detection started (latest-frame mode)")

    grabber_thread = threading.Thread(
        target=frame_grabber,
        args=(rtsp_url,),
        daemon=True
    )
    grabber_thread.start()

    while detection_active:
        with frame_lock:
            frame = latest_frame

        if frame is None:
            time.sleep(0.01)
            continue

        detections = detect_weapons(frame)
        current_time = time.time()

        for det in detections:
            weapon_type = det["weapon_type"]
            confidence = det["confidence"]

            if weapon_type in last_detections:
                if current_time - last_detections[weapon_type] < DUPLICATE_TIME_WINDOW:
                    continue

            last_detections[weapon_type] = current_time
            send_detection_to_backend(weapon_type, location, confidence, user_id)

    print("🛑 Detection stopped")

# ------------------ API ------------------

@app.post("/start-detection")
async def start_detection(request: DetectionRequest, background_tasks: BackgroundTasks):
    global detection_active

    if detection_active:
        return {"message": "Detection already running"}

    load_model()
    detection_active = True
    last_detections.clear()

    background_tasks.add_task(
        process_stream,
        request.rtsp_url,
        request.location,
        request.user_id
    )

    return {"message": "Detection started"}

@app.post("/stop-detection")
async def stop_detection():
    global detection_active
    detection_active = False
    return {"message": "Detection stopped"}

@app.get("/health")
async def health():
    return {"status": "ok", "time": datetime.now().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
