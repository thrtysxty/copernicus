import json
from anthropic import Anthropic
from backend.providers.base import LLMProvider

class AnthropicProvider(LLMProvider):
    def stream_chat(self, messages, model, system, api_key, base_url=None):
        client = Anthropic(api_key=api_key)
        formatted = [{"role": m["role"], "content": m["content"]} for m in messages]

        # NOTE: tool usage is not fully migrated in python backend, keeping simple stream for now
        with client.messages.stream(
            model=model,
            max_tokens=4096,
            system=system,
            messages=formatted
        ) as stream:
            for text in stream.text_stream:
                yield f"data: {json.dumps({'token': text})}\n\n"
        yield "data: [DONE]\n\n"
