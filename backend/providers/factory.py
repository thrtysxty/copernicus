from backend.utils.errors import AppError
from backend.providers.base import BaseProvider
from backend.providers.anthropic import AnthropicProvider
from backend.providers.google import GoogleProvider
from backend.providers.openai import OpenAIProvider
from backend.providers.ollama import OllamaProvider
from backend.providers.notebooklm import NotebookLMProvider

def get_provider(provider_name: str) -> BaseProvider:
    if provider_name == 'anthropic':
        return AnthropicProvider()
    elif provider_name == 'google':
        return GoogleProvider()
    elif provider_name == 'ollama':
        return OllamaProvider()
    elif provider_name == 'openai':
        return OpenAIProvider()
    elif provider_name in ('openrouter', 'deepinfra'):
        return OpenAIProvider()
    elif provider_name == 'notebooklm':
        return NotebookLMProvider()
    else:
        raise AppError(f"Unknown provider: {provider_name}")
