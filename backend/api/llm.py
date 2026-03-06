import os
import json
import logging
import subprocess
from flask import Blueprint, request, Response, stream_with_context
from backend.providers.factory import get_provider
from ollama import Client as OllamaClient

llm_bp = Blueprint('llm', __name__)
logger = logging.getLogger(__name__)

# Config from environment
OLLAMA_API_KEY = os.environ.get("OLLAMA_API_KEY")
OLLAMA_CLOUD_HOST = os.environ.get("OLLAMA_CLOUD_HOST", "https://ollama.com")
OLLAMA_LOCAL_URL = os.environ.get("OLLAMA_LOCAL_URL", "http://192.168.1.185:11434")

@llm_bp.route('/chat', methods=['POST'])
def chat():
    """
    Unified streaming chat endpoint.
    Expects JSON: { sessionId, messages, model, provider, systemPrompt, apiKey, baseUrl ... }
    """
    data = request.json
    session_id = data.get('sessionId')
    messages = data.get('messages', [])
    model = data.get('model')
    provider_name = data.get('provider', 'anthropic')
    system_prompt = data.get('systemPrompt', "You are an AI assistant in the Copernicus IDE.")
    api_key = data.get('apiKey', '')
    base_url = data.get('baseUrl')

    def generate():
        try:
            if provider_name == 'ollama':
                yield from stream_ollama(messages, model, system_prompt)
            else:
                provider = get_provider(provider_name)
                yield from provider.stream_chat(messages, model, system_prompt, api_key, base_url)
        except Exception as e:
            logger.error(f"LLM Stream Error: {str(e)}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(stream_with_context(generate()), mimetype='text/event-stream')

def stream_ollama(messages, model, system):
    # Determine if cloud or local based on model suffix or env
    is_cloud = ":cloud" in model
    target_url = OLLAMA_CLOUD_HOST if is_cloud else OLLAMA_LOCAL_URL
    
    headers = {}
    if is_cloud and OLLAMA_API_KEY:
        headers['Authorization'] = f'Bearer {OLLAMA_API_KEY}'
        
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

@llm_bp.route('/context/git', methods=['GET'])
def get_git_context():
    """Returns repository context: git status and file list."""
    try:
        status = subprocess.check_output(["git", "status", "--short"], text=True).strip() or "Clean"
        files = subprocess.check_output(["git", "ls-files"], text=True).strip().split("\n")[:50]
        return json.dumps({
            "status": status,
            "files": files
        })
    except Exception as e:
        return json.dumps({"error": str(e)}), 500
