import asyncio
import cv2
import datetime
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from backend.app.connection_manager import manager
from backend.app.database import init_db, SessionLocal, IncidentLog

app = FastAPI(title="Smart CCTV AI Analytics Platform")

# Standardize global cross-origin rules for local microservices
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load lightweight AI model weights and initialize database tables
model = YOLO("yolov8n.pt")
init_db()

@app.get("/")
def read_root():
    return {"status": "online", "message": "Smart CCTV AI Analytics Engine with Persistence Layer Active"}

# REST Endpoint to fetch historical logs when the dashboard client mounts
@app.get("/api/incidents")
def get_incident_history():
    db = SessionLocal()
    try:
        # Fetch the last 50 historical items recorded across webcam instances
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

@app.websocket("/ws/alerts")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    cap = cv2.VideoCapture(0)
    
    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                await asyncio.sleep(0.03)
                continue

            results = model(frame, verbose=False)
            boxes = results[0].boxes
            detected_items = []
            
            # Start database transaction block
            db = SessionLocal()
            
            for box in boxes:
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])
                class_name = model.names[class_id]
                
                if confidence > 0.5:
                    detected_items.append({
                        "object": class_name,
                        "confidence": round(confidence * 100, 2)
                    })
                    
                    # Commit this specific frame detection metric directly to SQLite
                    new_incident = IncidentLog(
                        location="Camera Feed 01",
                        object_detected=class_name,
                        confidence=round(confidence * 100, 2)
                    )
                    db.add(new_incident)
            
            if detected_items:
                db.commit() # Save transaction records securely
                
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