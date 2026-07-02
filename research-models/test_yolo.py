import cv2
from ultralytics import YOLO

print("Loading YOLO model...")
model = YOLO("yolov8n.pt") 

# Open webcam stream
video_source = 0  
cap = cv2.VideoCapture(video_source)

if not cap.isOpened():
    print(f"Error: Could not open video source {video_source}")
    exit()

print("AI Engine Active. Press 'q' key to safely exit.")

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        print("Unable to grab frame.")
        break

    # Run direct inference (Bypasses complex multi-frame optical matching)
    results = model(frame, verbose=False)
    
    # Render the standard YOLO bounding boxes
    annotated_frame = results[0].plot()

    # Show the stream
    cv2.imshow("Smart CCTV AI Analytics - Test Stream", annotated_frame)

    # Break loop if 'q' is pressed (Check every 10ms for responsiveness)
    if cv2.waitKey(10) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
print("Pipeline terminated cleanly.")