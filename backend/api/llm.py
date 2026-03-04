import os
import json
import logging
import subprocess
from flask import Blueprint, request, Response, stream_with_context
from anthropic import Anthropic
from openai import OpenAI
import google.generativeai as genai
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
    Expects JSON: { sessionId, messages, model, provider, systemPrompt, ... }
    """
    data = request.json
    session_id = data.get('sessionId')
    messages = data.get('messages', [])
    model = data.get('model')
    provider = data.get('provider', 'anthropic')
    system_prompt = data.get('systemPrompt', "You are an AI assistant in the Copernicus IDE.")

    def generate():
        try:
            if provider == 'anthropic':
                yield from stream_anthropic(messages, model, system_prompt)
            elif provider == 'google':
                yield from stream_google(messages, model, system_prompt)
            elif provider == 'ollama':
                yield from stream_ollama(messages, model, system_prompt)
            else:
                # Default to OpenAI compatible
                yield from stream_openai(messages, model, system_prompt)
        except Exception as e:
            logger.error(f"LLM Stream Error: {str(e)}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(stream_with_context(generate()), mimetype='text/event-stream')

def stream_anthropic(messages, model, system):
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key: raise ValueError("ANTHROPIC_API_KEY not set")
    
    client = Anthropic(api_key=api_key)
    # Convert messages to Anthropic format
    formatted = [{"role": m["role"], "content": m["content"]} for m in messages]
    
    with client.messages.stream(
        model=model,
        max_tokens=4096,
        system=system,
        messages=formatted
    ) as stream:
        for text in stream.text_stream:
            yield f"data: {json.dumps({'token': text})}\n\n"
    yield "data: [DONE]\n\n"

def stream_google(messages, model, system):
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key: raise ValueError("GOOGLE_API_KEY not set")
    
    genai.configure(api_key=api_key)
    # Remove provider prefix if present (e.g., google/gemini-pro -> gemini-pro)
    model_id = model.split('/')[-1]
    
    gen_model = genai.GenerativeModel(model_name=model_id, system_instruction=system)
    
    # Simple history conversion
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

def stream_openai(messages, model, system):
    api_key = os.environ.get("OPENAI_API_KEY")
    base_url = os.environ.get("OPENAI_BASE_URL")
    if not api_key: raise ValueError("OPENAI_API_KEY not set")
    
    client = OpenAI(api_key=api_key, base_url=base_url)
    
    stream = client.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": system}] + messages,
        stream=True
    )
    
    for chunk in stream:
        if chunk.choices[0].delta.content:
            yield f"data: {json.dumps({'token': chunk.choices[0].delta.content})}\n\n"
    yield "data: [DONE]\n\n"

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
