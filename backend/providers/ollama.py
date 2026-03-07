import os
import json
from ollama import Client as OllamaClient
from backend.providers.base import LLMProvider

class OllamaProvider(LLMProvider):
    def __init__(self):
        self.api_key = os.environ.get("OLLAMA_API_KEY")
        self.cloud_host = os.environ.get("OLLAMA_CLOUD_HOST", "https://ollama.com")
        self.local_url = os.environ.get("OLLAMA_LOCAL_URL", "http://localhost:11434")

    def stream_chat(self, messages, model, system, api_key=None, base_url=None, tools=None):
        # api_key and base_url overrides from request
        effective_api_key = api_key or self.api_key
        
        is_cloud = ":cloud" in model
        # Use provided base_url if local, otherwise determine from model name
        target_url = base_url if (base_url and not is_cloud) else (self.cloud_host if is_cloud else self.local_url)
        
        headers = {}
        if is_cloud and effective_api_key:
            headers['Authorization'] = f'Bearer {effective_api_key}'
            
        client = OllamaClient(host=target_url, headers=headers)
        
        stream = client.chat(
            model=model,
            messages=[{'role': 'system', 'content': system}] + messages,
            stream=True
        )
        
        for chunk in stream:
            if 'message' in chunk and 'content' in chunk['message']:
                yield f"data: {json.dumps({'token': chunk['message']['content']})}\n\n"
        yield "data: [DONE]\n\n"
