import os
from typing import List, Dict, Any, Optional, Tuple
import anthropic


SYSTEM_PROMPT = (
    "You are Logithon, an AI logistics assistant. "
    "You help with box counting from detections, load planning on a 20x15 cargo grid, "
    "and warehouse operations. You remember prior detections and corrections. "
    "Respond concisely with actionable steps. If user provides counts or corrections, "
    "acknowledge and adjust."
)


class ClaudeClient:
    def __init__(self, api_key: Optional[str]):
        self.api_key = api_key
        self.client = anthropic.Anthropic(api_key=api_key) if api_key else None
        self.model = os.getenv("CLAUDE_MODEL_ID", "claude-3-5-sonnet-20241022")

    async def respond(
        self, messages: List[Dict[str, Any]], context: Optional[Dict[str, Any]]
    ) -> Tuple[str, Optional[Dict[str, Any]]]:
        if not self.client:
            return "Claude is not configured.", context

        # Convert messages to Anthropic format
        chat_messages = []
        for m in messages:
            role = m.get("role", "user")
            content = m.get("content", "")
            chat_messages.append({"role": role, "content": content})

        # Embed context as system modifier
        system = SYSTEM_PROMPT
        if context:
            system += f" Context: {context}"

        resp = await self.client.messages.create(
            model=self.model,
            max_tokens=800,
            temperature=0.2,
            system=system,
            messages=chat_messages,
        )
        # Anthropic returns content as a list of blocks
        reply_text = ""
        for block in resp.content:
            if block.type == "text":
                reply_text += block.text
        # Preserve or update context
        new_context = context or {}
        return reply_text, new_context

