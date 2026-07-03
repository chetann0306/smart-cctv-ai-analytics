from ultralytics import YOLO

# Load your new weights file
model = YOLO("best.pt")

print("\n====================================")
print("🔍 SYSTEM DIAGNOSTIC LABELS FOR CUSTOM MODEL")
print("====================================")
print(f"Your model's exact detection labels are: {model.names}")
print("====================================\n")