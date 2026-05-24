"""
LLM Router Tests for Copernicus Backend.

# Router module: backend/api/llm.py + backend/providers/factory.py

Tests provider selection, fallback behavior, and error handling
at the /chat endpoint (the LLM routing layer).
"""

import json
import os
import tempfile
import pytest
from unittest.mock import patch, MagicMock
from typing import Iterator, List, Dict

# Set up temp DB before importing app
db_fd, db_path = tempfile.mkstemp()
os.environ["COPERNICUS_DB_PATH"] = db_path
os.environ["COPERNICUS_SETTINGS_PATH"] = db_path + "_settings.json"
if "COPERNICUS_API_KEY" in os.environ:
    del os.environ["COPERNICUS_API_KEY"]

from backend.app import app
from backend.api.stories import init_db
from backend.providers.base import BaseProvider


# ---------------------------------------------------------------------------
# Mock providers for routing tests
# ---------------------------------------------------------------------------

class MockSuccessProvider(BaseProvider):
    """Provider that returns a successful stream."""

    def stream_chat(
        self, messages: List[Dict[str, str]], model: str, **kwargs
    ) -> Iterator[str]:
        yield 'data: {"token": "Hello from fallback"}\n\n'
        yield 'data: [DONE]\n\n'


class MockFailureProvider(BaseProvider):
    """Provider that raises an exception to simulate provider failure."""

    def stream_chat(
        self, messages: List[Dict[str, str]], model: str, **kwargs
    ) -> Iterator[str]:
        raise RuntimeError("Provider internal error")


class MockRateLimitedProvider(BaseProvider):
    """Provider that raises a rate-limit exception to trigger fallback."""

    def stream_chat(
        self, messages: List[Dict[str, str]], model: str, **kwargs
    ) -> Iterator[str]:
        raise Exception("429 Rate limit exceeded")


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        init_db()
        yield c


def make_chat_payload(provider: str = "anthropic", model: str = "claude-sonnet"):
    return {
        "messages": [{"role": "user", "content": "Hello"}],
        "model": model,
        "provider": provider,
    }


# ---------------------------------------------------------------------------
# Test 1: Happy path — primary provider returns 200
# ---------------------------------------------------------------------------

def test_happy_path_primary_provider_succeeds(client):
    """Router selects configured primary provider and returns its response."""
    with patch("backend.api.llm.get_provider") as mock_get:
        mock_provider = MagicMock()
        mock_provider.stream_chat.return_value = iter([
            'data: {"token": "hi"}\n\n',
            'data: [DONE]\n\n',
        ])
        mock_get.return_value = mock_provider

        response = client.post(
            "/api/llm/chat",
            json=make_chat_payload(provider="anthropic"),
            headers={"X-API-Key": ""},
        )

        assert response.status_code == 200
        mock_get.assert_called_once_with("anthropic")
        # Verify streaming response contains data
        data = b"".join(response.response).decode("utf-8")
        assert '"token": "hi"' in data


# ---------------------------------------------------------------------------
# Test 2: Provider failure → fallback to second provider
# ---------------------------------------------------------------------------

def test_provider_failure_triggers_fallback(client):
    """When primary provider fails, router calls second provider and returns its response."""
    with patch("backend.api.llm.get_provider") as mock_get:
        primary = MockFailureProvider()
        fallback = MockSuccessProvider()

        # Return primary first, then fallback on second call
        mock_get.side_effect = [primary, fallback]

        response = client.post(
            "/api/llm/chat",
            json=make_chat_payload(provider="anthropic"),
            headers={"X-API-Key": ""},
        )

        assert response.status_code == 200
        # Router must have called get_provider twice
        assert mock_get.call_count == 2


# ---------------------------------------------------------------------------
# Test 3: All providers fail — clear error returned (not unhandled exception)
# ---------------------------------------------------------------------------

def test_all_providers_fail_returns_clear_error(client):
    """All providers returning 500 results in a clear error, not an unhandled exception."""
    with patch("backend.api.llm.get_provider") as mock_get:
        # Both primary and fallback raise
        mock_get.side_effect = [MockFailureProvider(), MockFailureProvider()]

        response = client.post(
            "/api/llm/chat",
            json=make_chat_payload(provider="anthropic"),
            headers={"X-API-Key": ""},
        )

        # Router returns 200 with an error event in the stream body (no unhandled crash)
        assert response.status_code == 200
        # The generate() wrapper catches exceptions and yields them as a JSON error event
        data = b"".join(response.response).decode("utf-8")
        assert '"error"' in data


# ---------------------------------------------------------------------------
# Test 4: Rate limit (429) triggers fallback
# ---------------------------------------------------------------------------

def test_rate_limit_triggers_fallback(client):
    """When primary returns 429, router uses fallback provider."""
    with patch("backend.api.llm.get_provider") as mock_get:
        primary = MockRateLimitedProvider()
        fallback = MockSuccessProvider()
        mock_get.side_effect = [primary, fallback]

        response = client.post(
            "/api/llm/chat",
            json=make_chat_payload(provider="anthropic"),
            headers={"X-API-Key": ""},
        )

        assert response.status_code == 200
        assert mock_get.call_count == 2
        data = b"".join(response.response).decode("utf-8")
        assert "fallback" in data.lower()


# ---------------------------------------------------------------------------
# Test 5: Unknown provider name — clear error
# ---------------------------------------------------------------------------

def test_unknown_provider_returns_clear_error(client):
    """provider: 'nonexistent' results in a clear error response."""
    response = client.post(
        "/api/llm/chat",
        json=make_chat_payload(provider="nonexistent"),
        headers={"X-API-Key": ""},
    )

    # The validate() decorator returns 422 for invalid providers (schema validation)
    assert response.status_code == 422
    data = response.get_json()
    assert "error" in data or "detail" in data
