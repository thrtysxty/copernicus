import pytest
from pydantic import ValidationError
from backend.schemas.agents import ContextHandoffRequest, AgentRunRequest, ResetContextRequest
from backend.schemas.stories import StoryCreateRequest, StoryUpdateRequest
from backend.schemas.llm import ChatRequest, Message
from backend.schemas.orchestration import ModelSwitchRequest, ResolveConfirmationRequest
from backend.schemas.settings import UpdateSettingsRequest
from backend.schemas.docs import GenerateDocsRequest
from backend.utils.validate import _is_path_violating
@pytest.mark.parametrize("value,expected", [
    ("/etc/passwd", True),
    ("C:\\Users\\temp", True),
    ("folder/../file", True),
    ("./secret", True),
    (".hidden", True),
    ("foo/bar/.git/config", True),
    ("normal-path", False),
    ("foo/bar", False),
    ("", False),
    (123, False),
])
def test_path_rejection(value, expected):
    assert _is_path_violating(value) == expected
class TestAgents:
    def test_context_handoff_valid(self):
        req = ContextHandoffRequest(session_id="s123")
        assert req.session_id == "s123"

    def test_context_handoff_standalone_story_id(self):
        req = ContextHandoffRequest(story_id="st-456")
        assert req.story_id == "st-456"

    def test_context_handoff_fails_without_id(self):
        with pytest.raises(ValueError) as excinfo:
            ContextHandoffRequest()
        assert "Either 'session_id' or 'story_id' must be provided" in str(excinfo.value)

    def test_agent_run_default_persona(self):
        req = AgentRunRequest(prompt="Hello", model="gpt-4")
        assert req.persona == "junior-dev"

    def test_agent_run_custom_model(self):
        req = AgentRunRequest(prompt="Hi", model="claude-3.5-sonnet")
        assert req.model == "claude-3.5-sonnet"

    def test_agent_run_invalid_model(self):
        with pytest.raises(ValidationError):
            AgentRunRequest(prompt="Hi", model="invalid model!")

    def test_reset_context_valid(self):
        req = ResetContextRequest(session_id="s1")
        assert req.session_id == "s1"


class TestStories:
    def test_story_create_required(self):
        req = StoryCreateRequest(title="My Story")
        assert req.status == "PLANNING"

    def test_story_create_with_path(self):
        with pytest.raises(ValidationError) as excinfo:
            StoryCreateRequest(title="My..Story")
        assert "must not contain absolute paths" in str(excinfo.value)

    def test_story_update_optional(self):
        req = StoryUpdateRequest(title="Updated")
        assert req.body_md is None

    def test_story_update_allowed_status(self):
        req = StoryUpdateRequest(status="DONE")
        assert req.status == "DONE"


class TestLLM:
    def test_chat_request_valid(self):
        req = ChatRequest(
            messages=[Message(role="user", content="Hi")],
            model="gpt-4"
        )
        assert len(req.messages) == 1

    def test_chat_request_system_prompt_with_path(self):
        with pytest.raises(ValidationError) as excinfo:
            ChatRequest(
                messages=[Message(role="user", content="Hi")],
                model="gpt-4",
                systemPrompt="/secret/prompt.md"
            )
        assert "must not contain absolute paths" in str(excinfo.value)


class TestOrchestration:
    def test_model_switch_valid(self):
        req = ModelSwitchRequest(model="gpt-4-turbo", reason="Better performance")
        assert req.reason == "Better performance"

    def test_resolve_confirmation(self):
        req = ResolveConfirmationRequest(request_id="req-123", approved=True)
        assert req.request_id == "req-123"


class TestSettings:
    def test_update_settings(self):
        UpdateSettingsRequest.model_validate({"theme": "dark", "max_retries": 5})
        # pass


class TestDocs:
    def test_generate_docs(self):
        req = GenerateDocsRequest(story_id="st-789", status="DONE")
        assert req.story_id == "st-789"

    def test_generate_docs_path_violation(self):
        with pytest.raises(ValidationError) as excinfo:
            GenerateDocsRequest(story_id="st..hack", status="DONE")
        assert "must not contain absolute paths" in str(excinfo.value)
