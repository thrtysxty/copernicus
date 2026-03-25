import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
import os
import tempfile
import json
from unittest.mock import patch, MagicMock
from pathlib import Path
from scripts.jules_daemon import write_verification_record, review_pr, now_iso

# Mocking external dependencies
@pytest.fixture(autouse=True)
def mock_external_dependencies():
    with patch("scripts.jules_daemon.anthropic_api_key", return_value="mock_anthropic_key"), \
         patch("scripts.jules_daemon.subprocess.run") as mock_run:
        # Mock gh pr diff
        mock_run.side_effect = [
            MagicMock(returncode=0, stdout="mock diff content"), # For review_pr diff fetch
            # Add more side_effects here as needed for other subprocess.run calls
        ]
        yield mock_run

@pytest.fixture
def temp_story_file():
    # Create a temporary directory and file
    temp_dir = tempfile.mkdtemp()
    story_path = Path(temp_dir) / "story_123_test_story.md"
    
    # Initial content for the story file
    initial_content = """# Story 123: Test Story

**Status:** IN_PROGRESS

## Acceptance Criteria
- AC1: This is the first AC.
- AC2: This is the second AC.
"""
    story_path.write_text(initial_content)
    yield story_path
    # Clean up the temporary directory and file
    import shutil
    shutil.rmtree(temp_dir)

@pytest.fixture
def temp_story_file_with_record():
    temp_dir = tempfile.mkdtemp()
    story_path = Path(temp_dir) / "story_124_test_story_with_record.md"
    initial_content = """# Story 124: Test Story With Record

**Status:** IN_PROGRESS

## Acceptance Criteria
- AC1: Existing AC.

## Verification Record

**Reviewed:** 2024-01-01T00:00:00+00:00
**Reviewer:** old-claude
**Verdict:** BLOCKED
**Merge SHA:** `old_sha` (full 40-char; `git show <old_sha>` to inspect)

### ACs Met
- Old AC Met

### ACs Flagged
- Old AC Flagged

### Summary
Old summary for the verification record.
"""
    story_path.write_text(initial_content)
    yield story_path
    import shutil
    shutil.rmtree(temp_dir)


def test_write_verification_record(temp_story_file):
    verdict = {
        "verdict": "APPROVED",
        "acs_met": ["AC1: This is the first AC."],
        "acs_missing": [],
        "summary": "All ACs met, good to merge.",
        "reviewer_model": "claude-sonnet-4-6",
        "reviewed_at": now_iso(),
        "merge_sha": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0"
    }
    write_verification_record(temp_story_file, verdict)

    content = temp_story_file.read_text()
    assert "**Status:** COMPLETE" in content
    assert "## Verification Record" in content
    assert f"**Reviewed:** {verdict['reviewed_at']}" in content
    assert f"**Reviewer:** {verdict['reviewer_model']}" in content
    assert f"**Verdict:** {verdict['verdict']}" in content
    assert f"**Merge SHA:** `{verdict['merge_sha']}`" in content
    assert "- AC1: This is the first AC." in content
    assert "### ACs Flagged\n_(none)_" in content
    assert "All ACs met, good to merge." in content
    # Ensure original AC2 is still there if not explicitly removed
    assert "- AC2: This is the second AC." in content


def test_write_verification_record_replace_existing(temp_story_file_with_record):
    verdict = {
        "verdict": "REQUEST_CHANGES",
        "acs_met": [],
        "acs_missing": ["AC-NEW: New AC missing."],
        "summary": "Some changes requested.",
        "reviewer_model": "claude-sonnet-4-6",
        "reviewed_at": now_iso(),
        "merge_sha": "unknown"
    }
    write_verification_record(temp_story_file_with_record, verdict)

    content = temp_story_file_with_record.read_text()
    assert "**Status:** COMPLETE" in content
    assert "## Verification Record" in content
    assert f"**Reviewed:** {verdict['reviewed_at']}" in content
    assert f"**Reviewer:** {verdict['reviewer_model']}" in content
    assert f"**Verdict:** {verdict['verdict']}" in content
    assert f"**Merge SHA:** `{verdict['merge_sha']}`" in content
    assert "### ACs Met\n" in content # Should be empty or just the header
    assert "- AC-NEW: New AC missing." in content
    assert "Some changes requested." in content
    assert "Old AC Met" not in content # Old record should be gone
    assert "Old AC Flagged" not in content
    assert "Old summary" not in content

def test_write_verification_record_file_not_found():
    non_existent_path = Path("/tmp/non_existent_story.md")
    verdict = {"verdict": "APPROVED", "summary": "test"}
    with patch("scripts.jules_daemon.log") as mock_log:
        write_verification_record(non_existent_path, verdict)
        mock_log.warning.assert_called_with(f"Verification record: Story file not found at {non_existent_path}")

def test_write_verification_record_atomic(temp_story_file):
    verdict = {
        "verdict": "APPROVED",
        "acs_met": [],
        "acs_missing": [],
        "summary": "atomic test",
        "reviewer_model": "claude-sonnet-4-6",
        "reviewed_at": now_iso(),
        "merge_sha": "sha123"
    }
    tmp_path = Path(str(temp_story_file) + ".tmp")
    assert not tmp_path.exists()
    
    write_verification_record(temp_story_file, verdict)
    
    assert not tmp_path.exists() # .tmp file should be cleaned up

@patch("scripts.jules_daemon.subprocess.run")
def test_review_pr_json_fallback(mock_run):
    # Mock gh pr diff (first call)
    mock_run.return_value = MagicMock(returncode=0, stdout="mock diff content")

    # Mock Claude API response with invalid JSON (second call)
    mock_claude_response = MagicMock(returncode=0, stdout='{"content": [{"type": "text", "text": "invalid json here"}}__HTTP_CODE__200')
    mock_run.side_effect = [
        MagicMock(returncode=0, stdout="mock diff content"),
        mock_claude_response
    ]

    # Patch json.loads to raise an error for the specific invalid JSON content
    original_json_loads = json.loads
    def mock_json_loads_for_invalid(s):
        if "invalid json here" in s:
            raise json.JSONDecodeError("Expecting value", s, 0)
        return original_json_loads(s)

    with patch("json.loads", side_effect=mock_json_loads_for_invalid):
        verdict = review_pr(1, 123)

    assert verdict["verdict"] == "BLOCKED"
    assert "Failed to parse Claude API response JSON" in verdict["summary"]
    assert verdict["acs_met"] == []
    assert verdict["acs_missing"] == []
    assert verdict["reviewer_model"] == "claude-sonnet-4-6"
    assert isinstance(verdict["reviewed_at"], str)
    assert verdict["merge_sha"] == "unknown"

@patch("scripts.jules_daemon.subprocess.run")
def test_review_pr_claude_api_error(mock_run):
    # Mock gh pr diff (first call)
    mock_run.return_value = MagicMock(returncode=0, stdout="mock diff content")

    # Mock Claude API response with non-200 status code
    mock_claude_response = MagicMock(returncode=0, stdout='Error message__HTTP_CODE__500')
    mock_run.side_effect = [
        MagicMock(returncode=0, stdout="mock diff content"),
        mock_claude_response
    ]
    
    verdict = review_pr(1, 123)
    
    assert verdict["verdict"] == "BLOCKED"
    assert "Claude API error: 500" in verdict["summary"]
    assert verdict["acs_met"] == []
    assert verdict["acs_missing"] == []
    assert verdict["reviewer_model"] == "claude-sonnet-4-6"
    assert isinstance(verdict["reviewed_at"], str)
    assert verdict["merge_sha"] == "unknown"

@patch("scripts.jules_daemon.subprocess.run")
def test_review_pr_timeout(mock_run):
    # Mock gh pr diff (first call)
    mock_run.return_value = MagicMock(returncode=0, stdout="mock diff content")

    # Mock Claude API call to raise TimeoutExpired
    mock_run.side_effect = [
        MagicMock(returncode=0, stdout="mock diff content"),
        subprocess.TimeoutExpired(cmd="curl", timeout=60)
    ]
    
    verdict = review_pr(1, 123)
    
    assert verdict["verdict"] == "BLOCKED"
    assert "Claude API call timed out" in verdict["summary"]
    assert verdict["acs_met"] == []
    assert verdict["acs_missing"] == []
    assert verdict["reviewer_model"] == "claude-sonnet-4-6"
    assert isinstance(verdict["reviewed_at"], str)
    assert verdict["merge_sha"] == "unknown"
