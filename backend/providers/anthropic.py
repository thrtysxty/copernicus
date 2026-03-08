import json
from typing import Iterator, List, Dict
from anthropic import Anthropic
from backend.providers.base import BaseProvider

class AnthropicProvider(BaseProvider):
    def stream_chat(self, messages: List[Dict[str, str]], model: str, **kwargs) -> Iterator[str]:
        api_key = kwargs.get("api_key")
        system = kwargs.get("system")
        tools = kwargs.get("tools")
        
        client = Anthropic(api_key=api_key)
        formatted = [{"role": m["role"], "content": m["content"]} for m in messages]
        stream_kwargs = {
            "model": model,
            "max_tokens": 4096,
            "system": system,
            "messages": formatted
        }
        if tools:
            stream_kwargs["tools"] = tools

        with client.messages.stream(**stream_kwargs) as stream:
            for event in stream:
                event_type = getattr(event, 'type', None)
                # Emit tool_use start event so the renderer can intercept
                if event_type == 'content_block_start':
                    block = getattr(event, 'content_block', None)
                    if block and getattr(block, 'type', None) == 'tool_use':
                        yield f"data: {json.dumps({'tool_use': {'id': block.id, 'name': block.name, 'input': {}}})}\n\n"
                        return  # renderer re-invokes after tool execution
                elif hasattr(event, 'text') and event.text:
                    yield f"data: {json.dumps({'token': event.text})}\n\n"

        yield "data: [DONE]\n\n"
