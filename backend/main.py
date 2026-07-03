import asyncio
import cv2
import datetime
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from backend.app.connection_manager import manager
from backend.app.database import init_db, SessionLocal, IncidentLog

app = FastAPI(title="Smart CCTV AI Analytics Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = YOLO("yolov8n.pt")
init_db()

# 1. Available pool of target classes to monitor
AVAILABLE_CLASSES = ["cell phone", "laptop", "backpack", "book"]
# Start with everything active by default
active_targets = list(AVAILABLE_CLASSES)

@app.get("/")
def read_root():
    return {"status": "online", "filters": active_targets}

@app.get("/api/incidents")
def get_incident_history():
    db = SessionLocal()
    try:
        logs = db.query(IncidentLog).order_by(IncidentLog.id.desc()).limit(50).all()
        return [
            {
                "id": log.id,
                "time": log.timestamp.strftime("%I:%M:%S %p"),
                "location": log.location,
                "items": [{"object": log.object_detected, "confidence": log.confidence}]
            }
            for log in logs
        ]
    finally:
        db.close()

# 2. REST Endpoint to dynamically update target filters
@app.post("/api/filters")
def update_filters(selected_filters: list[str]):
    global active_targets
    # Ensure we only accept filters that are part of our available pool
    active_targets = [f for f in selected_filters if f in AVAILABLE_CLASSES]
    return {"status": "updated", "active_filters": active_targets}

# 3. REST Endpoint to truncate/clear the database logs
@app.delete("/api/incidents")
def clear_incident_history():
    db = SessionLocal()
    try:
        db.query(IncidentLog).delete()
        db.commit()
        return {"status": "success", "message": "All incident logs cleared cleanly."}
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}
    finally:
        db.close()

@app.websocket("/ws/alerts")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    
    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                await asyncio.sleep(0.03)
                continue

            results = model(frame, verbose=False)
            boxes = results[0].boxes
            detected_items = []
            
            db = SessionLocal()
            
            for box in boxes:
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])
                class_name = model.names[class_id]
                
                # Check confidence AND match against dynamically modified active_targets list
                if confidence > 0.5 and class_name in active_targets:
                    detected_items.append({
                        "object": class_name,
                        "confidence": round(confidence * 100, 2)
                    })
                    
                    new_incident = IncidentLog(
                        location="Camera Feed 01",
                        object_detected=class_name,
                        confidence=round(confidence * 100, 2)
                    )
                    db.add(new_incident)
            
            if detected_items:
                db.commit()
                
                alert_payload = {
                    "event": "DETECTION_ALERT",
                    "location": "Camera Feed 01",
                    "detections": detected_items
                }
                await manager.broadcast_alert(alert_payload)
            
            db.close()
            await asyncio.sleep(0.03)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    finally:
        cap.release()