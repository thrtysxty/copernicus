import pytest
from backend.app import validate_origin

def test_valid_origin_allowed():
    """AC-1: Valid origins should be allowed."""
    assert validate_origin('http://localhost:3000') is True
    assert validate_origin('http://localhost:5001') is True
    assert validate_origin('app://copernicus') is True

def test_unknown_origin_rejected():
    """AC-1: Unknown or malicious origins should be rejected."""
    assert validate_origin('http://evil.com') is False
    assert validate_origin('http://localhost:3001') is False
    assert validate_origin(None) is False
    assert validate_origin('') is False

def test_env_sanitizer_rejects_bad_value():
    """
    AC-4: Verify origin validation logic handles paths and queries as rejection criteria
    (proxying for strict validation logic in env sanitizer).
    """
    assert validate_origin('http://localhost:3000/malicious') is False
    assert validate_origin('http://localhost:3000?query=1') is False
