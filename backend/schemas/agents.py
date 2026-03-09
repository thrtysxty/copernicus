from typing import Optional, Literal
from pydantic import BaseModel, Field, model_validator, field_validator

ALLOWED_PERSONAS = frozenset({'default', 'junior-dev', 'senior-dev', 'sentinel', 'architect', 'scribe', 'researcher', 'dev', 'code-reviewer'})

class ContextHandoffRequest(BaseModel):
    session_id: Optional[str] = Field(default=None)
    story_id: Optional[str] = Field(default=None)

    @model_validator(mode='after')
    def check_at_least_one(self) -> 'ContextHandoffRequest':
        if not self.session_id and not self.story_id:
            raise ValueError("Either 'session_id' or 'story_id' must be provided")
        return self


class AgentRunRequest(BaseModel):
    prompt: str
    persona: str = Field(default='junior-dev')
    session_id: Optional[str] = Field(default=None)
    model: str = Field(...)

    @field_validator('persona')
    @classmethod
    def validate_persona(cls, v: str) -> str:
        if v not in ALLOWED_PERSONAS:
            raise ValueError(f"Persona must be one of {ALLOWED_PERSONAS}")
        return v

    @field_validator('model')
    @classmethod
    def validate_model_name(cls, v: str) -> str:
        import re, unicodedata
        normalized = unicodedata.normalize('NFKC', v)
        pattern = r'^[a-zA-Z0-9]([a-zA-Z0-9_.:\-/]{0,99})$'
        if not re.match(pattern, normalized):
            raise ValueError('Invalid model name format')
        return normalized


class ResetContextRequest(BaseModel):
    session_id: str


class ResearchRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=32000)
    persona: str = Field(default='scribe')
    role: Optional[Literal['researcher', 'coder', 'thinker', 'fast']] = Field(default=None)
    session_id: Optional[str] = Field(default=None)
    model: str = Field(...)

    @field_validator('persona')
    @classmethod
    def validate_persona(cls, v: str) -> str:
        if v not in ALLOWED_PERSONAS:
            raise ValueError(f"Persona must be one of {ALLOWED_PERSONAS}")
        return v

    @field_validator('model')
    @classmethod
    def validate_model_name(cls, v: str) -> str:
        import re, unicodedata
        normalized = unicodedata.normalize('NFKC', v)
        pattern = r'^[a-zA-Z0-9]([a-zA-Z0-9_.:\-/]{0,99})$'
        if not re.match(pattern, normalized):
            raise ValueError('Invalid model name format')
        return normalized

    @field_validator('prompt')
    @classmethod
    def prompt_no_leading_dash(cls, v: str) -> str:
        if v and v.lstrip().startswith('-'):
            raise ValueError("Prompt must not start with '-' or whitespace followed by '-'")
        return v
