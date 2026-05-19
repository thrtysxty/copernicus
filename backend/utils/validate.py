from functools import wraps
from typing import Type, Any
from flask import request, jsonify
from pydantic import BaseModel, ValidationError
import re
import unicodedata


# Reusable path-rejection utility
def _is_path_violating(value: Any) -> bool:
    """Check if a string value violates path restrictions (absolute, .., hidden, etc.)."""
    if not isinstance(value, str):
        return False

    value = unicodedata.normalize('NFKC', value)

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


# SQL injection indicators: semicolon-prefixed DML/DDL or comment sequences
_SQL_INJECTION_RE = re.compile(
    r'(;\s*(DROP|INSERT|UPDATE|DELETE|CREATE|ALTER|TRUNCATE|EXEC|EXECUTE)\b|--(?:\s|$)|/\*)',
    re.IGNORECASE,
)

def _is_sql_injection(value: Any) -> bool:
    """Return True if value contains common SQL injection patterns."""
    if not isinstance(value, str):
        return False
    return bool(_SQL_INJECTION_RE.search(unicodedata.normalize('NFKC', value)))


# Global validator factory for Pydantic v2 (used in schemas)
def validate_no_paths(field_name: str):
    """Factory for field_validator to reject path-like strings."""
    def validator(v):
        if v and _is_path_violating(v):
            raise ValueError(f'{field_name} must not contain absolute paths, "..", or hidden folder references (e.g., ".git")')
        return v
    return validator


def validate_no_sql(field_name: str):
    """Factory for field_validator to reject SQL injection patterns."""
    def validator(v):
        if v and _is_sql_injection(v):
            raise ValueError(f'{field_name} must not contain SQL injection patterns')
        return v
    return validator


def validate(schema_class: Type[BaseModel]):
    """Decorator to validate request body using Pydantic v2 schema."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            try:
                data = request.get_json(silent=True, force=True)
                if data is None and request.content_length:
                    return jsonify({"error": "Validation failed", "detail": ["Request body must be valid JSON"]}), 422

                validated = schema_class.model_validate(data or {})

                # Inject as keyword arg so URL params aren't displaced
                return f(*args, **kwargs, request_data=validated)

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
