import os
import asyncio
import base64
import json
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from .models import Box, DetectResponse, ChatRequest, ChatResponse, LoadPlanRequest, LoadPlanResponse
from .detect import detect_boxes
from .load_planner import plan_load
from .claude_client import ClaudeClient
from .voice_proxy import ElevenLabsVoiceProxy

# Environment variables for external services
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

app = FastAPI(title="Logithon Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return JSONResponse({"status": "ok"})


@app.post("/detect", response_model=DetectResponse)
async def detect(file: UploadFile = File(...)):
    # Read file into bytes
    image_bytes = await file.read()
    # Run detection with YOLO v8 (with OpenCV fallback)
    result = detect_boxes(image_bytes)
    return result


claude = ClaudeClient(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None


@app.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest):
    if not claude:
        # Fallback: simple rule-based response if API key missing
        last_user = ""
        for m in reversed(body.messages):
            if m.get("role") == "user":
                last_user = m.get("content", "")
                break
        reply = "I can help with box counting and load planning. Please provide an image or box list."
        if "count" in last_user.lower():
            reply = "If you share the detection results, I will count boxes and adjust per your corrections."
        return ChatResponse(reply=reply, context=body.context)
    reply, new_context = await claude.respond(body.messages, body.context)
    return ChatResponse(reply=reply, context=new_context)


@app.post("/load-plan", response_model=LoadPlanResponse)
async def load_plan(body: LoadPlanRequest):
    return plan_load(body)


@app.websocket("/voice-stream")
async def voice_stream(websocket: WebSocket):
    await websocket.accept()
    if not ELEVENLABS_API_KEY:
        await websocket.send_text(json.dumps({"error": "ELEVENLABS_API_KEY missing"}))
        await websocket.close()
        return
    proxy = ElevenLabsVoiceProxy(api_key=ELEVENLABS_API_KEY)
    try:
        await proxy.run(websocket)
    except WebSocketDisconnect:
        await proxy.close()
    except Exception as e:
        await websocket.send_text(json.dumps({"error": str(e)}))
        await proxy.close()

