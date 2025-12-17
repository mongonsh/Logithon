from typing import List, Optional, Dict, Any
from pydantic import BaseModel

class Box(BaseModel):
    id: str
    x: int
    y: int
    w: int
    h: int
    label: str = "box"
    confidence: float = 1.0


class DetectResponse(BaseModel):
    boxes: List[Box]
    image_width: int
    image_height: int


class ChatRequest(BaseModel):
    messages: List[Dict[str, Any]]
    context: Optional[Dict[str, Any]] = None


class ChatResponse(BaseModel):
    reply: str
    audio_url: Optional[str] = None
    context: Optional[Dict[str, Any]] = None


class LoadPlanRequest(BaseModel):
    grid_width: int = 20
    grid_height: int = 15
    boxes: List[Box]
    vehicle: Optional[Dict[str, Any]] = None


class LoadPlanResponse(BaseModel):
    placements: List[Box]
    score: float
    warnings: List[str]
    sequence: List[str]
