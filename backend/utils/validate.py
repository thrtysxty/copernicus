from functools import wraps
from typing import Type, Any
from flask import request, jsonify
from pydantic import BaseModel, ValidationError
import re


# Reusable path-rejection utility
def _is_path_violating(value: Any) -> bool:
    """Check if a string value violates path restrictions (absolute, .., hidden, etc.)."""
    if not isinstance(value, str):
        return False

    # Absolute path: starts with '/' (Unix) or '[A-Za-z]:\\' (Windows)
    if value.startswith('/') or re.match(r'^[A-Za-z]:\\', value):
        return True

    # Contains '..'
    if '..' in value:
        return True

    # Any path segment is hidden (starts with '.')
    normalized = value.replace('\\', '/')
    parts = normalized.split('/')
    for part in parts:
        if part.startswith('.') and part != '.' and part != '..':
            return True
        if part == '.':
            return True

    return False


# Global validator factory for Pydantic v2 (used in schemas)
def validate_no_paths(field_name: str):
    """Factory for field_validator to reject path-like strings."""
    def validator(v):
        if v and _is_path_violating(v):
            raise ValueError(f'{field_name} must not contain absolute paths, "..", or hidden folder references (e.g., ".git")')
        return v
    return validator


def validate(schema_class: Type[BaseModel]):
    """Decorator to validate request body using Pydantic v2 schema."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            try:
                data = request.get_json(silent=True, force=True)
                if data is None:
                    return jsonify({"error": "Validation failed", "detail": ["Request body must be valid JSON"]}), 422

                validated = schema_class.model_validate(data)

                # Inject as first arg
                return f(validated, *args, **kwargs)

            except ValidationError as e:
                errors = []
                for err in e.errors():
                    loc = ".".join(str(x) for x in err["loc"]) or "body"
                    msg = err["msg"]
                    errors.append(f"{loc}: {msg}")
                return jsonify({"error": "Validation failed", "detail": errors}), 422
            except Exception as e:
                return jsonify({"error": "Validation failed", "detail": [str(e)]}), 422

        return wrapper
    return decorator
