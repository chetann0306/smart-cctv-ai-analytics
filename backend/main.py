import asyncio
import cv2
import datetime
import base64
import time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from sqlalchemy import text
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

# Initialize neural engine and run structural migration steps
model = YOLO("best.pt")
init_db()

# Configure SQLite WAL mode directly on application startup cleanly using text() blocks
db_setup = SessionLocal()
try:
    db_setup.execute(text("PRAGMA journal_mode=WAL;"))
    db_setup.execute(text("PRAGMA synchronous=NORMAL;"))
    db_setup.commit()
except Exception as e:
    print(f"⚠️ [WAL Init Warning]: {e}")
finally:
    db_setup.close()

AVAILABLE_CLASSES = ["Fire"]
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

@app.post("/api/filters")
def update_filters(selected_filters: list[str]):
    global active_targets
    active_targets = [f for f in selected_filters if f in AVAILABLE_CLASSES]
    return {"status": "updated", "active_filters": active_targets}

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
                await asyncio.sleep(0.01)
                continue

            results = model(frame, verbose=False)
            boxes = results[0].boxes
            detected_items = []
            
            db = SessionLocal()
            try:
                for box in boxes:
                    class_id = int(box.cls[0])
                    confidence = float(box.conf[0])
                    
                    class_name = model.names[class_id] if class_id < len(model.names) else "Fire"
                    
                    if confidence > 0.75 and class_name in active_targets:
                        detected_items.append({
                            "object": class_name,
                            "confidence": round(confidence * 100, 2)
                        })
                        
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 3)
                        
                        label = f"{class_name} {round(confidence * 100)}%"
                        cv2.putText(frame, label, (x1, max(y1 - 10, 20)), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
                        
                        new_incident = IncidentLog(
                            location="Camera Feed 01",
                            object_detected=class_name,
                            confidence=round(confidence * 100, 2)
                        )
                        db.add(new_incident)
                
                if detected_items:
                    db.commit()
            except Exception as write_err:
                print(f"⚠️ [Database Write Warning]: {write_err}")
                db.rollback()
            finally:
                db.close()
            
            _, buffer = cv2.imencode('.jpg', frame)
            base64_frame = base64.b64encode(buffer).decode('utf-8')
            
            alert_payload = {
                "event": "DETECTION_ALERT",
                "location": "Camera Feed 01",
                "detections": detected_items,
                "frame": f"data:image/jpeg;base64,{base64_frame}"
            }
            await manager.broadcast_alert(alert_payload)
            await asyncio.sleep(0.01)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    finally:
        cap.release()