from typing import Dict, Any
from pydantic import BaseModel, model_validator


class UpdateSettingsRequest(BaseModel):
    # settings_bp.route('', methods=['PUT']) merges with existing settings
    # The data can be any dict.
    pass

    @model_validator(mode='before')
    @classmethod
    def validate_dict(cls, data: Any) -> Dict[str, Any]:
        if not isinstance(data, dict):
            raise ValueError("Request body must be a JSON object")
        return data
