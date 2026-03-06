from backend.providers.anthropic import AnthropicProvider
from backend.providers.google import GoogleProvider
from backend.providers.openai import OpenAIProvider

def get_provider(provider_name: str):
    if provider_name == 'anthropic':
        return AnthropicProvider()
    elif provider_name == 'google':
        return GoogleProvider()
    else:
        return OpenAIProvider()
