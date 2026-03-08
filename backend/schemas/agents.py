from typing import Optional, List
from pydantic import BaseModel, Field, model_validator
from backend.utils.validate import validate_no_paths


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
    persona: str = Field(default='junior-dev', pattern=r'^[a-zA-Z0-9._-]{1,50}$')
    session_id: Optional[str] = Field(default=None)
    model: str = Field(..., pattern=r'^[a-zA-Z0-9._:-]{1,100}$')


class ResetContextRequest(BaseModel):
    session_id: str
