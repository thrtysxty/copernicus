from backend.utils.errors import AppError
from backend.providers.base import BaseProvider
from backend.providers.anthropic import AnthropicProvider
from backend.providers.openai import OpenAIProvider
from backend.providers.ollama import OllamaProvider

try:
    from backend.providers.google import GoogleProvider, GENAI_AVAILABLE
except ImportError:
    GENAI_AVAILABLE = False

def get_provider(provider_name: str) -> BaseProvider:
    if provider_name == 'anthropic':
        return AnthropicProvider()
    elif provider_name == 'google':
        if not GENAI_AVAILABLE:
            raise AppError("Google provider requires the 'google-genai' package. Install it with: pip install google-genai")
        return GoogleProvider()
    elif provider_name == 'ollama':
        return OllamaProvider()
    elif provider_name == 'openai':
        return OpenAIProvider()
    elif provider_name in ('openrouter', 'deepinfra'):
        return OpenAIProvider()
    else:
        raise AppError(f"Unknown provider: {provider_name}")
