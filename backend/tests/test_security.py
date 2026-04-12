import pytest
import json
import os
import pydantic
from backend.app import app, validate_origin
from backend.schemas.agents import AgentRunRequest
from backend.utils.errors import AppError


@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


class TestResearchEndpointSecurity:
    """Tests for Research Endpoint argument injection vulnerability (Story 260)."""

    VALID_PAYLOAD = {
        "prompt": "What does this codebase do?",
        "persona": "scribe",
        "model": "llama3:8b",
    }

    def test_research_injection_with_leading_dash(self, client):
        """Test 400 when prompt starts with dash (command flag injection)."""
        payload = self.VALID_PAYLOAD.copy()
        payload["prompt"] = "-h; whoami"

        response = client.post("/api/agents/research", json=payload)
        assert response.status_code == 400
        json_data = response.get_json()
        assert "invalid prompt" in json_data.get("error", "").lower()

    def test_research_injection_with_leading_dash_and_whitespace(self, client):
        """Test 400 when prompt has leading whitespace before dash."""
        payload = self.VALID_PAYLOAD.copy()
        payload["prompt"] = "   -h; whoami"

        response = client.post("/api/agents/research", json=payload)
        assert response.status_code == 400
        json_data = response.get_json()
        assert "invalid prompt" in json_data.get("error", "").lower()

    def test_research_injection_with_double_dash(self, client):
        """Test 400 when prompt starts with double dash."""
        payload = self.VALID_PAYLOAD.copy()
        payload["prompt"] = "--version"

        response = client.post("/api/agents/research", json=payload)
        assert response.status_code == 400
        json_data = response.get_json()
        assert "invalid prompt" in json_data.get("error", "").lower()

    def test_research_injection_with_null_byte(self, client):
        """Test 400 when prompt contains a null byte."""
        payload = self.VALID_PAYLOAD.copy()
        payload["prompt"] = "normal_prompt\x00evil_command"

        response = client.post("/api/agents/research", json=payload)
        assert response.status_code == 400
        json_data = response.get_json()
        assert "invalid prompt" in json_data.get("error", "").lower()

    def test_research_injection_with_empty_prompt_fails_validation(self, client):
        """Empty prompt should fail pydantic min_length=1 with 422."""
        payload = self.VALID_PAYLOAD.copy()
        payload["prompt"] = ""

        response = client.post("/api/agents/research", json=payload)
        assert response.status_code == 422
        json_data = response.get_json()
        assert "prompt: string should have at least 1 character" in json_data.get("detail", [[""]])[0].lower()

    def test_research_injection_with_very_long_prompt_fails_validation(self, client):
        """Prompt >32k chars should fail max_length validation with 422."""
        payload = self.VALID_PAYLOAD.copy()
        payload["prompt"] = "x" * 32001

        response = client.post("/api/agents/research", json=payload)
        assert response.status_code == 422
        json_data = response.get_json()
        assert "prompt: string should have at most 32000 characters" in json_data.get("detail", [[""]])[0].lower()

    def test_research_valid_prompt_succeeds(self, client, mocker):
        """Test that a safe prompt is accepted."""
        # Mock subprocess.run to avoid actual subprocesses
        mock_run = mocker.patch("backend.api.agents.subprocess.run")
        mock_result = mocker.MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "Success response"
        mock_result.stderr = ""
        mock_run.return_value = mock_result

        payload = self.VALID_PAYLOAD.copy()
        payload["prompt"] = "What does this codebase do?"
        payload["session_id"] = "test-session"

        # Mock the context manager to avoid DB/UUID issues in simple test
        mocker.patch("backend.api.agents.context_manager.add_item")
        mocker.patch("backend.api.agents._add_context_to_payload", return_value={"messages": [], "new_message": {"content": payload["prompt"]}})

        response = client.post("/api/agents/research", json=payload)
        assert response.status_code == 200
        json_data = response.get_json()
        assert json_data["data"]["result"] == "Success response"
        
        # Verify prompt was NOT passed as positional arg
        args, kwargs = mock_run.call_args
        cmd_args = args[0]
        # Command should NOT contain the prompt string
        assert payload["prompt"] not in cmd_args
        # Should contain --history
        assert "--history" in cmd_args


class TestSecurityHardening:
    """Tests for Story 264 security hardening."""

    def test_cors_null_origin(self):
        """Test that validate_origin rejects 'null' (case-insensitive)."""
        assert validate_origin('null') is False
        assert validate_origin('NULL') is False
        assert validate_origin('Null') is False
        assert validate_origin('') is False
        assert validate_origin(None) is False

    def test_invalid_model_name(self):
        """Test that AgentRunRequest rejects model names with path traversal."""
        with pytest.raises(pydantic.ValidationError):
            AgentRunRequest(model='../../etc/passwd')
