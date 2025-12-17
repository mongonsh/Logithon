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
    # Edge detection
    edges = cv2.Canny(gray, 50, 150)
    # Find contours
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes: List[BoxModel] = []
    idx = 1
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        if w * h < 500:  # Filter tiny noise
            continue
        boxes.append(BoxModel(id=f"box-{idx}", x=int(x), y=int(y), w=int(w), h=int(h), confidence=0.5))
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
                    # Prefer packaging-like classes when available
                    # Common classes: 24=backpack, 26=handbag, 28=suitcase
                    if cls in (24, 26, 28):
                        label = "package"
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
