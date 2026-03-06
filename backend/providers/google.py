import json
import google.generativeai as genai
from backend.providers.base import LLMProvider

class GoogleProvider(LLMProvider):
    def stream_chat(self, messages, model, system, api_key, base_url=None, tools=None):
        genai.configure(api_key=api_key)
        model_id = model.split('/')[-1]
        gen_model = genai.GenerativeModel(model_name=model_id, system_instruction=system)

        history = []
        for m in messages[:-1]:
            history.append({
                "role": "model" if m["role"] == "assistant" else "user",
                "parts": [m["content"]]
            })

        chat = gen_model.start_chat(history=history)
        last_msg = messages[-1]["content"]

        response = chat.send_message(last_msg, stream=True)
        for chunk in response:
            if chunk.text:
                yield f"data: {json.dumps({'token': chunk.text})}\n\n"
        yield "data: [DONE]\n\n"
