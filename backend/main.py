import os
import uuid
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import anthropic
from elevenlabs import ElevenLabs
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from models import Box, DetectResponse, ChatRequest, ChatResponse, LoadPlanRequest, LoadPlanResponse
from detect import detect_boxes
from load_planner import plan_load

# Environment variables for external services
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

# Initialize clients
anthropic_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None
elevenlabs_client = ElevenLabs(api_key=ELEVENLABS_API_KEY) if ELEVENLABS_API_KEY else None

# Audio setup
AUDIO_DIR = "audio_output"
os.makedirs(AUDIO_DIR, exist_ok=True)

app = FastAPI(title="Logithon Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount audio directory to serve generated speech files
app.mount("/audio", StaticFiles(directory=AUDIO_DIR), name="audio")

SYSTEM_PROMPT = """You are Logithon, an AI logistics assistant specializing in cargo optimization and warehouse management.

CORE RESPONSIBILITIES:
- Analyze box counts and dimensions with precision
- Provide detailed descriptions of cargo arrangements
- Explain load planning efficiency and optimization strategies
- Give specific measurements and spatial analysis

COMMUNICATION STYLE:
- Be descriptive and analytical when discussing boxes and cargo
- Always mention specific counts, dimensions, and spatial relationships
- Explain WHY certain arrangements are efficient or inefficient
- Use professional logistics terminology
- Keep responses informative but conversational for voice communication

WHEN ANALYZING BOXES:
- State the exact count you detect
- Describe approximate dimensions (e.g., "20cm x 50cm boxes")
- Comment on box arrangement and spacing efficiency
- Suggest improvements for better space utilization
- Explain load distribution and stability considerations

EXAMPLE RESPONSES:
- "I can see 5 rectangular boxes in the image. The boxes appear to be approximately 30cm x 40cm each. The current arrangement uses about 60% of available space efficiently, with good weight distribution along the bottom edge."
- "Based on the corrected count of 8 boxes, each measuring roughly 25cm x 35cm, I recommend a 2x4 grid arrangement which would optimize space utilization to 85% while maintaining proper load balance."

Always be specific about numbers, measurements, and efficiency explanations.
"""

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


@app.post("/chat", response_model=ChatResponse)
def chat(body: ChatRequest):
    """
    Handle chat requests:
    1. Send message history to Claude
    2. Get text response
    3. Generate audio using ElevenLabs
    4. Return text and audio URL
    """
    if not anthropic_client:
        # Fallback if no API key
        return ChatResponse(
            reply="I'm sorry, I cannot process your request because the AI service is not configured.",
            context=body.context
        )

    # Prepare messages for Claude
    messages = []
    for m in body.messages:
        messages.append({
            "role": m.get("role", "user"),
            "content": m.get("content", "")
        })

    try:
        # Get response from Claude
        response = anthropic_client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=messages
        )
        
        assistant_response = response.content[0].text
        
        audio_url = None
        if elevenlabs_client:
            try:
                # Use the user-provided voice ID
                voice_id = "cNYrMw9glwJZXR8RwbuR"  
                
                audio_generator = elevenlabs_client.text_to_speech.convert(
                    voice_id=voice_id,
                    text=assistant_response,
                    model_id="eleven_multilingual_v2"
                )
                
                # Save audio file
                audio_filename = f"{uuid.uuid4()}.mp3"
                audio_path = os.path.join(AUDIO_DIR, audio_filename)
                
                with open(audio_path, 'wb') as f:
                    for chunk in audio_generator:
                        f.write(chunk)
                
                # Return relative URL
                audio_url = f"/audio/{audio_filename}"
                
            except Exception as e:
                print(f"ElevenLabs error: {e}")
                # Continue without audio
        
        return ChatResponse(
            reply=assistant_response,
            audio_url=audio_url,
            context=body.context
        )

    except Exception as e:
        print(f"Chat error: {e}")
        # Return a polite error message instead of 500 if possible, or let it raise
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/load-plan", response_model=LoadPlanResponse)
async def load_plan(body: LoadPlanRequest):
    return plan_load(body)
