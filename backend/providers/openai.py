import json
from openai import OpenAI
from backend.providers.base import LLMProvider

class OpenAIProvider(LLMProvider):
    def stream_chat(self, messages, model, system, api_key, base_url=None, tools=None):
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
