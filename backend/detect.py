import io
from typing import List
import numpy as np
import cv2
from PIL import Image
from pydantic import BaseModel

try:
    from ultralytics import YOLO
except Exception:
    YOLO = None


class BoxModel(BaseModel):
    id: str
    x: int
    y: int
    w: int
    h: int
    label: str = "box"
    confidence: float = 1.0


def _opencv_rect_detect(image_np: np.ndarray) -> List[BoxModel]:
    # Convert to grayscale
    gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY)
    
    # Apply multiple detection methods for better box detection
    boxes: List[BoxModel] = []
    idx = 1
    
    # Method 1: Edge detection with multiple thresholds
    for low_thresh, high_thresh in [(30, 100), (50, 150), (80, 200)]:
        edges = cv2.Canny(gray, low_thresh, high_thresh)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for cnt in contours:
            x, y, w, h = cv2.boundingRect(cnt)
            # More lenient size filtering - accept smaller boxes
            if w * h < 200 or w < 10 or h < 10:  # Filter very tiny noise
                continue
            # Check if this box overlaps significantly with existing boxes
            overlap = False
            for existing_box in boxes:
                if (abs(x - existing_box.x) < 20 and abs(y - existing_box.y) < 20 and 
                    abs(w - existing_box.w) < 20 and abs(h - existing_box.h) < 20):
                    overlap = True
                    break
            if not overlap:
                boxes.append(BoxModel(id=f"box-{idx}", x=int(x), y=int(y), w=int(w), h=int(h), confidence=0.6))
                idx += 1
    
    # Method 2: Template matching for rectangular shapes
    # Create a simple rectangular template
    template_sizes = [(30, 30), (50, 50), (80, 80)]
    for tw, th in template_sizes:
        template = np.ones((th, tw), dtype=np.uint8) * 255
        template = cv2.rectangle(template, (2, 2), (tw-3, th-3), 0, 2)
        
        result = cv2.matchTemplate(gray, template, cv2.TM_CCOEFF_NORMED)
        locations = np.where(result >= 0.3)  # Lower threshold for more detections
        
        for pt in zip(*locations[::-1]):
            x, y = pt
            w, h = tw, th
            # Check for overlaps
            overlap = False
            for existing_box in boxes:
                if (abs(x - existing_box.x) < 30 and abs(y - existing_box.y) < 30):
                    overlap = True
                    break
            if not overlap:
                boxes.append(BoxModel(id=f"box-{idx}", x=int(x), y=int(y), w=int(w), h=int(h), confidence=0.4))
                idx += 1
    
    return boxes


def detect_boxes(image_bytes: bytes):
    # Load image into numpy
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image_np = np.array(image)[:, :, ::-1]  # Convert RGB to BGR for OpenCV
    image_h, image_w = image_np.shape[:2]

    boxes: List[BoxModel] = []

    if YOLO:
        try:
            # Use a lightweight YOLOv8n model
            model = YOLO("yolov8n.pt")
            results = model.predict(source=image_np, verbose=False)
            idx = 1
            for r in results:
                for b in r.boxes:
                    x1, y1, x2, y2 = b.xyxy[0].tolist()
                    w = int(x2 - x1)
                    h = int(y2 - y1)
                    x = int(x1)
                    y = int(y1)
                    conf = float(b.conf[0].item()) if hasattr(b, "conf") else 0.5
                    cls = int(b.cls[0].item()) if hasattr(b, "cls") else -1
                    label = "box"
                    # Map YOLO classes to box/package labels
                    # Common classes: 0=person, 24=backpack, 26=handbag, 28=suitcase, 
                    # 56=chair, 57=couch, 58=potted plant, 59=bed, 60=dining table, 
                    # 61=toilet, 62=tv, 63=laptop, 64=mouse, 65=remote, 66=keyboard, 
                    # 67=cell phone, 68=microwave, 69=oven, 70=toaster, 71=sink, 
                    # 72=refrigerator, 73=book, 74=clock, 75=vase, 76=scissors, 
                    # 77=teddy bear, 78=hair drier, 79=toothbrush
                    
                    # Accept more object types as potential boxes/packages
                    package_classes = {24: "backpack", 26: "handbag", 28: "suitcase", 
                                     73: "book", 75: "vase", 77: "teddy_bear"}
                    
                    # Also accept rectangular objects that could be boxes
                    rectangular_classes = {56: "chair", 60: "dining_table", 62: "tv", 
                                         63: "laptop", 68: "microwave", 69: "oven", 
                                         70: "toaster", 72: "refrigerator"}
                    
                    if cls in package_classes:
                        label = package_classes[cls]
                    elif cls in rectangular_classes:
                        label = f"box_{rectangular_classes[cls]}"
                    else:
                        # For any other detected object, treat as potential box
                        label = f"object_{cls}"
                    boxes.append(BoxModel(id=f"box-{idx}", x=x, y=y, w=w, h=h, label=label, confidence=conf))
                    idx += 1
        except Exception:
            boxes = _opencv_rect_detect(image_np)
    else:
        boxes = _opencv_rect_detect(image_np)

    return {
        "boxes": [b.dict() for b in boxes],
        "image_width": int(image_w),
        "image_height": int(image_h),
    }
