from typing import Optional
from pydantic import BaseModel, Field, field_validator
from backend.utils.validate import validate_no_paths, validate_no_sql


class StoryCreateRequest(BaseModel):
    id: Optional[str] = Field(default=None, pattern=r'^[a-zA-Z0-9._:-]{1,100}$')
    title: str = Field(..., min_length=1)
    body_md: Optional[str] = None
    status: str = Field(default='PLANNING', pattern=r'^(PLANNING|IN_PROGRESS|REVIEW|DONE)$')

    @field_validator('title')
    @classmethod
    def validate_title(cls, v: str) -> str:
        validate_no_paths('title')(v)
        validate_no_sql('title')(v)
        return v

    @field_validator('body_md')
    @classmethod
    def validate_body_no_paths(cls, v: Optional[str]) -> Optional[str]:
        return validate_no_paths('body_md')(v)


class StoryUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1)
    body_md: Optional[str] = None
    status: Optional[str] = Field(default=None, pattern=r'^(PLANNING|IN_PROGRESS|REVIEW|DONE)$')

    @field_validator('title')
    @classmethod
    def validate_title(cls, v: Optional[str]) -> Optional[str]:
        validate_no_paths('title')(v)
        validate_no_sql('title')(v)
        return v

    @field_validator('body_md')
    @classmethod
    def validate_body_no_paths(cls, v: Optional[str]) -> Optional[str]:
        return validate_no_paths('body_md')(v)
