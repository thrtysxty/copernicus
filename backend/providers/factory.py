from backend.providers.anthropic import AnthropicProvider
from backend.providers.google import GoogleProvider
from backend.providers.openai import OpenAIProvider
from backend.providers.ollama import OllamaProvider

def get_provider(provider_name: str):
    if provider_name == 'anthropic':
        return AnthropicProvider()
    elif provider_name == 'google':
        return GoogleProvider()
    elif provider_name == 'ollama':
        return OllamaProvider()
    else:
        return OpenAIProvider()
