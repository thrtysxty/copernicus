from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator
from backend.utils.validate import validate_no_paths


class Message(BaseModel):
    role: str = Field(..., pattern=r'^(user|assistant|system|tool)$')
    content: Optional[str] = None


class ChatRequest(BaseModel):
    messages: List[Message]
    model: str = Field(..., pattern=r'^[a-zA-Z0-9._:-]{1,100}$')
    sessionId: Optional[str] = Field(default=None, pattern=r'^[a-zA-Z0-9._:-]{1,100}$')
    provider: Optional[str] = Field(default=None, pattern=r'^[a-zA-Z0-9._-]{1,50}$')
    systemPrompt: Optional[str] = None
    apiKey: Optional[str] = None
    baseUrl: Optional[str] = None
    tools: Optional[List[Dict[str, Any]]] = None

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
