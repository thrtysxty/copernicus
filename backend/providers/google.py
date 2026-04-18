import json
from typing import Iterator, List, Dict
from google import genai
from google.genai import types
from backend.providers.base import BaseProvider

class GoogleProvider(BaseProvider):
    def stream_chat(self, messages: List[Dict[str, str]], model: str, **kwargs) -> Iterator[str]:
        api_key = kwargs.get("api_key")
        system = kwargs.get("system")

        model_id = model.split('/')[-1]
        client = genai.Client(api_key=api_key)

        if not messages:
            raise ValueError("messages required")

        # Build contents
        contents = []
        for m in messages[:-1]:
            contents.append(types.Content(
                role="model" if m["role"] == "assistant" else "user",
                parts=[types.Part.from_text(text=m["content"])]
            ))
        contents.append(types.Content(
            role="user",
            parts=[types.Part.from_text(text=messages[-1]["content"])]
        ))

        # Streaming generation
        for chunk in client.models.generate_content_stream(
            model=model_id,
            contents=contents,
            config=types.GenerateContentConfig(system_instruction=system)
        ):
            if chunk.text:
                yield f"data: {json.dumps({'token': chunk.text})}\n\n"
        yield "data: [DONE]\n\n"
