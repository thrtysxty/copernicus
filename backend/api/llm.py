import os
import json
from flask import Blueprint, request, Response, stream_with_context
from backend.middleware.auth import require_auth
from backend.limiter import limiter
from backend.providers.factory import get_provider
from backend.utils.validate import validate
from backend.schemas.llm import ChatRequest
import logging

logger = logging.getLogger(__name__)

llm_bp = Blueprint('llm', __name__)


def _fallback_chain(primary: str) -> list[str]:
    """Return provider names in fallback order: primary first, then known backups."""
    ORDER = ["anthropic", "openai", "google"]
    seen: set[str] = set()
    result: list[str] = []
    for p in [primary] + ORDER:
        if p not in seen:
            seen.add(p)
            result.append(p)
    return result


@llm_bp.route('/chat', methods=['POST'])
@require_auth
@limiter.limit("30 per minute")
@validate(ChatRequest)
def chat(request_data: ChatRequest):
    """
    Unified streaming chat endpoint with automatic provider fallback.
    Expects JSON: { sessionId, messages, model, provider, systemPrompt, apiKey, baseUrl ... }
    """
    messages = [m.model_dump() for m in request_data.messages]
    model = request_data.model
    primary_provider = request_data.provider or 'anthropic'

    system_prompt = request_data.systemPrompt or "You are an AI assistant in the Copernicus IDE."
    api_key = request_data.apiKey or ''
    base_url = request_data.baseUrl
    tools = request_data.tools

    # Story 236: Mock LLM check for E2E testing
    mock = request.args.get('mock') == 'true' or \
           request.headers.get('COPERNICUS_MOCK_LLM') == '1' or \
           os.environ.get('COPERNICUS_MOCK_LLM') == '1'

    if mock:
        def generate_mock():
            mock_resp = {
                "id": "mock-chat-completion",
                "object": "chat.completion.chunk",
                "created": 123456789,
                "model": model,
                "choices": [{"index": 0, "delta": {"content": "Mock Response: I am an AI assistant in the Copernicus IDE. How can I help you?"}, "finish_reason": None}]
            }
            yield f"data: {json.dumps(mock_resp)}\n\n"
            yield f"data: {json.dumps({'choices': [{'index': 0, 'delta': {}, 'finish_reason': 'stop'}]})}\n\n"
        return Response(stream_with_context(generate_mock()), mimetype='text/event-stream')

    def generate():
        tried: list[str] = []
        for provider_name in _fallback_chain(primary_provider):
            tried.append(provider_name)
            try:
                provider = get_provider(provider_name)
                yield from provider.stream_chat(
                    messages, model, system=system_prompt, api_key=api_key, base_url=base_url, tools=tools
                )
                return  # success -- stop iterating
            except Exception as e:
                logger.error(f"LLM provider {provider_name} failed: {e}")

        # All providers exhausted
        logger.error(f"All LLM providers failed. Tried: {tried}")
        yield f'data: {{"error": "All LLM providers failed", "tried": {tried}}}\n\n'

    return Response(stream_with_context(generate()), mimetype='text/event-stream')
