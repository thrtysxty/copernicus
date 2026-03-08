from typing import Optional
from pydantic import BaseModel, Field


class ReloadRequest(BaseModel):
    force: Optional[bool] = Field(default=False)
