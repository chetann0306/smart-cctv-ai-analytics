import asyncio
import cv2
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from backend.app.connection_manager import manager

app = FastAPI(title="Smart CCTV AI Analytics Platform")

# Allow Frontend dashboard to connect smoothly without CORS blocks
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load our lightweight model
model = YOLO("yolov8n.pt")

@app.get("/")
def read_root():
    return {"status": "online", "message": "Smart CCTV AI Analytics Engine Active"}

@app.websocket("/ws/alerts")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    
    # Initialize the camera stream (0 = webcam)
    cap = cv2.VideoCapture(0)
    
    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                await asyncio.sleep(0.03)  # Yield control back to loop if frame drops
                continue

            # Run YOLO on the frame
            results = model(frame, verbose=False)
            
            # Extract detected classes
            # COCO dataset: Class 0 is 'person'. Perfect for testing unauthorized entry!
            boxes = results[0].boxes
            detected_items = []
            
            for box in boxes:
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])
                class_name = model.names[class_id]
                
                # Filter for high-confidence detections
                if confidence > 0.5:
                    detected_items.append({
                        "object": class_name,
                        "confidence": round(confidence * 100, 2)
                    })

            # If an anomaly or target object is found, broadcast the alert immediately
            if detected_items:
                alert_payload = {
                    "event": "DETECTION_ALERT",
                    "location": "Camera Feed 01",
                    "detections": detected_items
                }
                await manager.broadcast_alert(alert_payload)

            # Control frame-rate execution (~30 FPS processing)
            await asyncio.sleep(0.03)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    finally:
        cap.release()
        print("Video capture resource released safely.")