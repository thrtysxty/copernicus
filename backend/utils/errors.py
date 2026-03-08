# backend/utils/errors.py
from typing import Optional, Dict, Any, Tuple

class AppError(Exception):
    """
    Custom application exception with optional status code and detail.
    """
    def __init__(self, message: str, status: int = 500, detail: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.detail = detail or {}

    def to_dict(self) -> Dict[str, Any]:
        """Convert error to a serializable dictionary."""
        result = {"error": self.message}
        if self.detail:
            result.update(self.detail)
        return result

def handle_app_error(error: AppError) -> Tuple[Dict[str, Any], int]:
    """
    Handle AppError and return (response_body, status_code) tuple for Flask.
    """
    return error.to_dict(), error.status
