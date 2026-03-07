import os
import json
import logging
import subprocess
from flask import Blueprint, request, Response, stream_with_context, jsonify
from backend.providers.factory import get_provider

llm_bp = Blueprint('llm', __name__)
logger = logging.getLogger(__name__)

@llm_bp.route('/chat', methods=['POST'])
def chat():
    """
    Unified streaming chat endpoint.
    Expects JSON: { sessionId, messages, model, provider, systemPrompt, apiKey, baseUrl ... }
    """
    data = request.json or {}
    session_id = data.get('sessionId')
    messages = data.get('messages')
    model = data.get('model')
    provider_name = data.get('provider', 'anthropic')
    system_prompt = data.get('systemPrompt', "You are an AI assistant in the Copernicus IDE.")
    api_key = data.get('apiKey', '')
    base_url = data.get('baseUrl')
    tools = data.get('tools')

    if not model or not messages:
        return Response(json.dumps({'error': 'Missing required fields: model or messages'}), status=400, mimetype='application/json')

    def generate():
        try:
            provider = get_provider(provider_name)
            yield from provider.stream_chat(messages, model, system_prompt, api_key, base_url, tools)
        except Exception as e:
            logger.error(f"LLM Stream Error: {str(e)}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(stream_with_context(generate()), mimetype='text/event-stream')

@llm_bp.route('/context/git', methods=['GET'])
def get_git_context():
    """Returns repository context: git status and file list."""
    try:
        status = subprocess.check_output(["git", "status", "--short"], text=True).strip() or "Clean"
        files = subprocess.check_output(["git", "ls-files"], text=True).strip().split("\n")[:50]
        return jsonify({
            "status": status,
            "files": files
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
