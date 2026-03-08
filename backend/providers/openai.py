import json
from typing import Iterator, List, Dict
from openai import OpenAI
from backend.providers.base import BaseProvider

class OpenAIProvider(BaseProvider):
    def stream_chat(self, messages: List[Dict[str, str]], model: str, **kwargs) -> Iterator[str]:
        api_key = kwargs.get("api_key")
        system = kwargs.get("system")
        base_url = kwargs.get("base_url")

        client = OpenAI(api_key=api_key, base_url=base_url)

        stream = client.chat.completions.create(
            model=model,
            messages=[{"role": "system", "content": system}] + messages,
            stream=True
        )

        for chunk in stream:
            if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                yield f"data: {json.dumps({'token': chunk.choices[0].delta.content})}\n\n"
        yield "data: [DONE]\n\n"
