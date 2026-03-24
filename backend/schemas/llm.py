from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator
import re, unicodedata
from backend.utils.validate import validate_no_paths

ALLOWED_PROVIDERS = frozenset({'anthropic', 'openai', 'google', 'openrouter', 'deepinfra', 'ollama', 'notebooklm'})

class Message(BaseModel):
    role: str = Field(..., pattern=r'^(user|assistant|system|tool)$')
    content: Optional[str] = None


class ChatRequest(BaseModel):
    messages: List[Message]
    model: str = Field(...)
    sessionId: Optional[str] = Field(default=None, pattern=r'^[a-zA-Z0-9._:-]{1,100}$')
    provider: Optional[str] = Field(default=None)
    systemPrompt: Optional[str] = None
    apiKey: Optional[str] = None
    baseUrl: Optional[str] = None
    tools: Optional[List[Dict[str, Any]]] = None

    @field_validator('provider')
    @classmethod
    def validate_provider(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ALLOWED_PROVIDERS:
            raise ValueError(f"Provider must be one of {ALLOWED_PROVIDERS}")
        return v

    @field_validator('model')
    @classmethod
    def validate_model_name(cls, v: str) -> str:
        normalized = unicodedata.normalize('NFKC', v)
        pattern = r'^[a-zA-Z0-9]([a-zA-Z0-9_.:\-/]{0,99})$'
        if not re.match(pattern, normalized):
            raise ValueError('Invalid model name format')
        return normalized

    @field_validator('systemPrompt')
    @classmethod
    def validate_system_prompt_no_paths(cls, v: Optional[str]) -> Optional[str]:
        return validate_no_paths('systemPrompt')(v)

    @field_validator('apiKey')
    @classmethod
    def validate_api_key_no_paths(cls, v: Optional[str]) -> Optional[str]:
        return validate_no_paths('apiKey')(v)

    @field_validator('baseUrl')
    @classmethod
    def validate_base_url_no_paths(cls, v: Optional[str]) -> Optional[str]:
        return validate_no_paths('baseUrl')(v)
