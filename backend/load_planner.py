from typing import List, Dict, Any
from .models import Box, LoadPlanRequest, LoadPlanResponse


def plan_load(body: LoadPlanRequest) -> LoadPlanResponse:
    grid_w = body.grid_width
    grid_h = body.grid_height
    boxes: List[Box] = body.boxes

    # Sort boxes by area descending for a simple heuristic
    sorted_boxes = sorted(boxes, key=lambda b: b.w * b.h, reverse=True)

    occupied = [[False for _ in range(grid_w)] for _ in range(grid_h)]
    placements: List[Box] = []
    warnings: List[str] = []

    def can_place(x: int, y: int, w: int, h: int) -> bool:
        if x < 0 or y < 0 or x + w > grid_w or y + h > grid_h:
            return False
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                if occupied[yy][xx]:
                    return False
        return True

    def place(x: int, y: int, w: int, h: int):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                occupied[yy][xx] = True

    # Simple first-fit left-to-right, top-to-bottom packing
    for b in sorted_boxes:
        placed = False
        for yy in range(grid_h):
            for xx in range(grid_w):
                if can_place(xx, yy, b.w, b.h):
                    place(xx, yy, b.w, b.h)
                    placements.append(Box(id=b.id, x=xx, y=yy, w=b.w, h=b.h, label=b.label, confidence=b.confidence))
                    placed = True
                    break
            if placed:
                break
        if not placed:
            warnings.append(f"Could not place {b.id}, not enough space")

    # Compute a simple stability score: fewer adjacent edges reduce shifts
    adjacency = 0
    for yy in range(grid_h):
        for xx in range(grid_w):
            if occupied[yy][xx]:
                if yy > 0 and occupied[yy - 1][xx]:
                    adjacency += 1
                if xx > 0 and occupied[yy][xx - 1]:
                    adjacency += 1

    total_cells = grid_w * grid_h
    filled = sum(1 for yy in range(grid_h) for xx in range(grid_w) if occupied[yy][xx])
    fill_ratio = filled / total_cells if total_cells else 0
    score = round(0.6 * fill_ratio + 0.4 * (adjacency / (total_cells * 2)), 3)

    sequence: List[str] = [p.id for p in placements]

    return LoadPlanResponse(placements=placements, score=score, warnings=warnings, sequence=sequence)

