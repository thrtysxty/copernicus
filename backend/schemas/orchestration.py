from typing import Optional
from pydantic import BaseModel, Field


class ModelSwitchRequest(BaseModel):
    model: str = Field(..., pattern=r'^[a-zA-Z0-9._:-]{1,100}$')
    reason: Optional[str] = Field(default=None, max_length=500)


class ResolveConfirmationRequest(BaseModel):
    request_id: str
    approved: bool = Field(default=False)
