import asyncio
import json
import base64
import os
from typing import Optional, List, Dict, Any
import websockets
from fastapi import WebSocket, WebSocketDisconnect
from .claude_client import ClaudeClient

# Constants
STT_URI = "wss://api.elevenlabs.io/v1/speech-to-text/streaming"
TTS_URI_BASE = "wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input?model_id=eleven_flash_v2_5"
VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"  # George
STT_MODEL_ID = "scribe_v2_realtime"

class ElevenLabsVoiceProxy:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.claude = ClaudeClient(api_key=os.getenv("ANTHROPIC_API_KEY"))
        self.stt_ws: Optional[websockets.WebSocketClientProtocol] = None
        self.tts_ws: Optional[websockets.WebSocketClientProtocol] = None
        self.client_ws: Optional[WebSocket] = None
        self.tasks: List[asyncio.Task] = []
        self.conversation_history: List[Dict[str, Any]] = []

    async def connect_stt(self):
        uri = f"{STT_URI}?model_id={STT_MODEL_ID}"
        self.stt_ws = await websockets.connect(uri, extra_headers={"xi-api-key": self.api_key})
        # Initial config if needed
        await self.stt_ws.send(json.dumps({
            "type": "start",
            "transcription_config": {
                "language_code": "en",
                "enable_partials": True
            }
        }))

    async def connect_tts(self):
        uri = TTS_URI_BASE.format(voice_id=VOICE_ID)
        # ElevenLabs WS requires API key; pass via header to ensure auth succeeds
        self.tts_ws = await websockets.connect(uri, extra_headers={"xi-api-key": self.api_key})
        # Initial config
        await self.tts_ws.send(json.dumps({
            "text": " ",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.8},
            "xi_api_key": self.api_key
        }))

    async def handle_stt_messages(self):
        """Receive transcripts from STT, send to Claude, send response to TTS."""
        try:
            async for message in self.stt_ws:
                data = json.loads(message)
                # Check for transcript
                # Structure: {"type": "partial_transcript"|"final_transcript", "channel_index": 0, "is_final": bool, "text": "..."}
                # Note: Actual structure might vary, based on docs snippet it has "text" and "isFinal" or similar.
                # Snippet 2: "text", "isFinal".
                # Snippet 1: "onCommittedTranscript" -> data.text
                
                text = data.get("text", "")
                is_final = data.get("is_final", False) or data.get("type") == "final_transcript"

                if text:
                    # Send partials to client for UI update?
                    if self.client_ws:
                        await self.client_ws.send_json({
                            "type": "user_transcript",
                            "user_transcription_event": {"user_transcript": text}
                        })

                if is_final and text.strip():
                    # Get Claude Response
                    print(f"User: {text}")
                    # Add to history
                    self.conversation_history.append({"role": "user", "content": text})
                    
                    # Call Claude (non-streaming for now)
                    reply, _ = await self.claude.respond(self.conversation_history)
                    self.conversation_history.append({"role": "assistant", "content": reply})
                    
                    print(f"Claude: {reply}")
                    
                    # Send to Client (text)
                    if self.client_ws:
                        await self.client_ws.send_json({
                            "type": "agent_response",
                            "agent_response_event": {"agent_response": reply}
                        })
                    
                    # Send to TTS
                    if self.tts_ws:
                        await self.tts_ws.send(json.dumps({"text": reply}))
                        # Send flush/eos? 
                        # TTS WS expects "text": "" to close? No, just keep open.
                        # Usually send "text": " " to flush?
                        await self.tts_ws.send(json.dumps({"text": " "}))

        except Exception as e:
            print(f"STT Error: {e}")

    async def handle_tts_messages(self):
        """Receive audio from TTS, send to Client."""
        try:
            async for message in self.tts_ws:
                data = json.loads(message)
                if data.get("audio"):
                    # data["audio"] is base64
                    # Client expects: {"type": "audio", "audio_event": {"audio_base64": "..."}}
                    if self.client_ws:
                        await self.client_ws.send_json({
                            "type": "audio",
                            "audio_event": {"audio_base64": data["audio"]}
                        })
        except Exception as e:
            print(f"TTS Error: {e}")

    async def handle_client_messages(self):
        """Receive audio from Client, send to STT."""
        try:
            while True:
                data = await self.client_ws.receive_json()
                # data: {"user_audio_chunk": "base64..."}
                if "user_audio_chunk" in data:
                    chunk = data["user_audio_chunk"]
                    # Send to STT
                    if self.stt_ws:
                        # Protocol: {"audio_event": {"audio_base64": chunk}}
                        await self.stt_ws.send(json.dumps({
                            "audio_event": {"audio_base64": chunk}
                        }))
                elif "type" in data and data["type"] == "pong":
                    pass
        except WebSocketDisconnect:
            pass
        except Exception as e:
            print(f"Client Error: {e}")

    async def run(self, client_ws: WebSocket):
        self.client_ws = client_ws
        
        # Connect to services
        try:
            await self.connect_stt()
            await self.connect_tts()
        except Exception as e:
            try:
                await client_ws.send_json({"type": "error", "error": f"Voice service connection failed: {str(e)}"})
            except Exception:
                pass
            print(f"Connection Error: {e}")
            await client_ws.close()
            return

        # Start handlers
        self.tasks = [
            asyncio.create_task(self.handle_stt_messages()),
            asyncio.create_task(self.handle_tts_messages()),
            asyncio.create_task(self.handle_client_messages())
        ]

        # Wait for any task to fail or client to disconnect
        done, pending = await asyncio.wait(self.tasks, return_when=asyncio.FIRST_COMPLETED)

        # Cleanup
        await self.close()

    async def close(self):
        for task in self.tasks:
            task.cancel()
        if self.stt_ws:
            await self.stt_ws.close()
        if self.tts_ws:
            await self.tts_ws.close()
