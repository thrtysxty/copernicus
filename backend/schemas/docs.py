from typing import Optional
from pydantic import BaseModel, Field, field_validator
from backend.utils.validate import validate_no_paths


class GenerateDocsRequest(BaseModel):
    story_id: str = Field(..., pattern=r'^[a-zA-Z0-9._:-]{1,100}$')
    status: Optional[str] = Field(default=None)

    @field_validator('story_id')
    @classmethod
    def validate_story_id_path(cls, v: str) -> str:
        return validate_no_paths('story_id')(v)


class VisualAuditRequest(BaseModel):
    story_id: Optional[str] = Field(default=None, pattern=r'^[a-zA-Z0-9._:-]{1,100}$')
    url: Optional[str] = Field(default=None)

    @field_validator('story_id')
    @classmethod
    def validate_story_id_path(cls, v: Optional[str]) -> Optional[str]:
        if v:
            return validate_no_paths('story_id')(v)
        return v
