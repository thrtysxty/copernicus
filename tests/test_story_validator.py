import pytest
import os
from unittest.mock import patch
from scripts.utils.story_validator import StoryValidator

# Define a temporary directory for test stories
TEST_STORY_DIR = "tests/temp_stories"

@pytest.fixture(autouse=True)
def setup_teardown_test_story_dir():
    # Setup: Create the temporary directory
    os.makedirs(TEST_STORY_DIR, exist_ok=True)
    yield
    # Teardown: Clean up the temporary directory after tests
    for f in os.listdir(TEST_STORY_DIR):
        os.remove(os.path.join(TEST_STORY_DIR, f))
    os.rmdir(TEST_STORY_DIR)

# Helper function to create a dummy story file
def create_story_file(filename, content):
    filepath = os.path.join(TEST_STORY_DIR, filename)
    with open(filepath, "w") as f:
        f.write(content)
    return filepath

# Helper function to simulate existing files in the repo root
@pytest.fixture
def mock_repo_root_files():
    # Create dummy files that story validator will check
    os.makedirs("dummy_repo/.git", exist_ok=True)
    os.makedirs("dummy_repo/copernicus/src", exist_ok=True)
    os.makedirs("dummy_repo/copernicus/electron", exist_ok=True)
    with open("dummy_repo/existing_file.ts", "w") as f:
        f.write("// existing file content")
    with open("dummy_repo/copernicus/electron/preload.ts", "w") as f:
        f.write("export const SEND_CHANNELS = ['daemon:install'];\n")
        f.write("export const LISTEN_CHANNELS = ['daemon:status'];\n")
    with open("dummy_repo/copernicus/src/common_types.ts", "w") as f:
        f.write("interface MyInterface {}\n")
        f.write("type MyType = string;\n")
        f.write("class MyClass {}\n")
    
    yield "dummy_repo" # Yield the path to the dummy repo root
    
    # Clean up
    os.remove("dummy_repo/existing_file.ts")
    os.remove("dummy_repo/copernicus/electron/preload.ts")
    os.remove("dummy_repo/copernicus/src/common_types.ts")
    os.rmdir("dummy_repo/copernicus/src")
    os.rmdir("dummy_repo/copernicus/electron")
    os.rmdir("dummy_repo/copernicus")
    os.rmdir("dummy_repo/.git")
    os.rmdir("dummy_repo")


# Test 1: write_verification with clean story → all PASS
def test_clean_story_all_pass(mock_repo_root_files):
    story_content = """
# Story 533 - Clean Story Test

**Status:** COMPLETE
**Priority:** P1

## Problem

This is a clean story.

## Acceptance Criteria

- [ ] Implement feature X using 'daemon:install' IPC channel.
- [ ] Ensure MyInterface is used.
- [ ] Reference to existing_file.ts

## Scope

**Modified files:**
- `existing_file.ts`

## Definition of Done

- [ ] All criteria met.

## Blocks:

- None

## Blocked By:

- Story 123

## Story Number

533
"""
    story_filepath = create_story_file("story_533_clean_story.md", story_content)
    
    with patch('os.getcwd', return_value=os.path.abspath(mock_repo_root_files)):
        validator = StoryValidator(story_filepath)
        is_valid, issues, warnings = validator.validate()

    assert is_valid is True
    assert len(issues) == 0


# Test 2: file path missing (non-new) → FAIL
def test_missing_file_path_fail(mock_repo_root_files):
    story_content = """
# Story 534 - Missing File Test

**Status:** COMPLETE

## Acceptance Criteria
- [ ] Reference to non_existent_file.py

## Scope
**Modified files:**
- `non_existent_file.py`

## Blocks: - None
## Blocked By: - Story 123
## Definition of Done
- [ ] Done
## Story Number
534
"""
    story_filepath = create_story_file("story_534_missing_file.md", story_content)

    with patch('os.getcwd', return_value=os.path.abspath(mock_repo_root_files)):
        validator = StoryValidator(story_filepath)
        is_valid, issues, warnings = validator.validate()

    assert is_valid is False
    assert any("Referenced file not found: non_existent_file.py" in i for i in issues)


# Test 3: file path annotated (new) already exists → WARN
def test_new_file_exists_warn(mock_repo_root_files):
    story_content = """
# Story 535 - New File Exists Test

**Status:** COMPLETE

## Acceptance Criteria
- [ ] Create a new file.

## Scope
**New files:**
- `existing_file.ts` (new)

## Blocks: - None
## Blocked By: - Story 123
## Definition of Done
- [ ] Done
## Story Number
535
"""
    story_filepath = create_story_file("story_535_new_file_exists.md", story_content)

    with patch('os.getcwd', return_value=os.path.abspath(mock_repo_root_files)):
        validator = StoryValidator(story_filepath)
        is_valid, issues, warnings = validator.validate()

    assert is_valid is True # Should still pass, but with a warning
    assert len(issues) == 0
    assert any("File marked (new) already exists: existing_file.ts" in w for w in warnings)


# Test 4: metadata missing ## Blocks: → FAIL
def test_missing_metadata_fail(mock_repo_root_files):
    story_content = """
# Story 536 - Missing Blocks Test

**Status:** COMPLETE

## Acceptance Criteria
- [ ] Do something.

## Blocked By:

- Story 123

## Definition of Done

- [ ] Done

## Story Number

536
"""
    story_filepath = create_story_file("story_536_missing_blocks.md", story_content)

    with patch('os.getcwd', return_value=os.path.abspath(mock_repo_root_files)):
        validator = StoryValidator(story_filepath)
        is_valid, issues, warnings = validator.validate()

    assert is_valid is False
    assert any("Missing required metadata: '## Blocks:'" in i for i in issues)


# Test 5: story number mismatch → FAIL
def test_story_number_mismatch_fail(mock_repo_root_files):
    story_content = """
# Story 537 - Number Mismatch Test

**Status:** COMPLETE

## Acceptance Criteria
- [ ] Do something.

## Blocks: - None
## Blocked By: - Story 123
## Definition of Done
- [ ] Done

## Story Number

538
"""
    story_filepath = create_story_file("story_537_number_mismatch.md", story_content)

    with patch('os.getcwd', return_value=os.path.abspath(mock_repo_root_files)):
        validator = StoryValidator(story_filepath)
        is_valid, issues, warnings = validator.validate()

    assert is_valid is False
    assert any("Story number mismatch: Filename has 537, content has 538." in i for i in issues)

# Test 6: Missing Acceptance Criteria section
def test_missing_acceptance_criteria_fail(mock_repo_root_files):
    story_content = """
# Story 539 - Missing AC Test

**Status:** COMPLETE

## Problem
No AC.

## Blocks: - None
## Blocked By: - Story 123
## Definition of Done
- [ ] Done
## Story Number
539
"""
    story_filepath = create_story_file("story_539_missing_ac.md", story_content)

    with patch('os.getcwd', return_value=os.path.abspath(mock_repo_root_files)):
        validator = StoryValidator(story_filepath)
        is_valid, issues, warnings = validator.validate()

    assert is_valid is False
    assert any("Missing required metadata: '## Acceptance Criteria'" in i for i in issues)

# Test 7: Empty Acceptance Criteria section
def test_empty_acceptance_criteria_fail(mock_repo_root_files):
    story_content = """
# Story 540 - Empty AC Test

**Status:** COMPLETE

## Problem
Empty AC.

## Acceptance Criteria


## Blocks: - None
## Blocked By: - Story 123
## Definition of Done
- [ ] Done
## Story Number
540
"""
    story_filepath = create_story_file("story_540_empty_ac.md", story_content)

    with patch('os.getcwd', return_value=os.path.abspath(mock_repo_root_files)):
        validator = StoryValidator(story_filepath)
        is_valid, issues, warnings = validator.validate()

    assert is_valid is False
    assert any("Acceptance Criteria section is empty." in i for i in issues)

# Test 8: DRAFT status -> WARN
def test_draft_status_warn(mock_repo_root_files):
    story_content = """
# Story 541 - Draft Status Test

**Status:** DRAFT

## Acceptance Criteria
- [ ] Do something.

## Blocks: - None
## Blocked By: - Story 123
## Definition of Done
- [ ] Done
## Story Number
541
"""
    story_filepath = create_story_file("story_541_draft_status.md", story_content)

    with patch('os.getcwd', return_value=os.path.abspath(mock_repo_root_files)):
        validator = StoryValidator(story_filepath)
        is_valid, issues, warnings = validator.validate()

    assert is_valid is True # Should still pass, but with a warning
    assert len(issues) == 0
    assert any("Story status is DRAFT." in w for w in warnings)

# Test 9: IPC Channel referenced but not found
def test_ipc_channel_not_found_fail(mock_repo_root_files):
    story_content = """
# Story 542 - IPC Not Found Test

**Status:** COMPLETE

## Acceptance Criteria
- [ ] Use 'non_existent:channel'.

## Blocks: - None
## Blocked By: - Story 123
## Definition of Done
- [ ] Done
## Story Number
542
"""
    story_filepath = create_story_file("story_542_ipc_not_found.md", story_content)

    with patch('os.getcwd', return_value=os.path.abspath(mock_repo_root_files)):
        validator = StoryValidator(story_filepath)
        is_valid, issues, warnings = validator.validate()

    assert is_valid is False
    assert any("IPC channel 'non_existent:channel' referenced but not found" in i for i in issues)

# Test 10: TypeScript type candidate not found
def test_typescript_type_not_found_warn(mock_repo_root_files):
    story_content = """
# Story 543 - TS Type Not Found Test

**Status:** COMPLETE

## Acceptance Criteria
- [ ] Use `NonExistentType`.

## Blocks: - None
## Blocked By: - Story 123
## Definition of Done
- [ ] Done
## Story Number
543
"""
    story_filepath = create_story_file("story_543_ts_type_not_found.md", story_content)

    with patch('os.getcwd', return_value=os.path.abspath(mock_repo_root_files)):
        validator = StoryValidator(story_filepath)
        is_valid, issues, warnings = validator.validate()

    assert is_valid is True # Should still pass, but with a warning
    assert len(issues) == 0
    assert any("TypeScript type candidate 'NonExistentType' not found" in w for w in warnings)

# Test 11: File marked (new) is not new
def test_file_marked_new_not_new_warn(mock_repo_root_files):
    story_content = """
# Story 544 - File New Not New Test

**Status:** COMPLETE

## Scope
**New files:**
- `existing_file.ts` (new)

## Acceptance Criteria
- [ ] Do something.

## Blocks: - None
## Blocked By: - Story 123
## Definition of Done
- [ ] Done
## Story Number
544
"""
    story_filepath = create_story_file("story_544_file_new_not_new.md", story_content)

    with patch('os.getcwd', return_value=os.path.abspath(mock_repo_root_files)):
        validator = StoryValidator(story_filepath)
        is_valid, issues, warnings = validator.validate()

    assert is_valid is True
    assert len(issues) == 0
    assert any("File marked (new) already exists: existing_file.ts" in w for w in warnings)

# Test 12: Ensure _get_repo_root handles when .git is not in current dir, but in parent
def test_get_repo_root_finds_parent_git():
    # Simulate a scenario where the script is run from a subdirectory
    # and .git is in a parent directory.
    temp_dir = "temp_project_with_git"
    sub_dir = os.path.join(temp_dir, "scripts", "utils")
    os.makedirs(os.path.join(temp_dir, ".git"), exist_ok=True)
    os.makedirs(sub_dir, exist_ok=True)

    expected_root = os.path.abspath(temp_dir)  # compute before chdir changes resolution
    original_cwd = os.getcwd()
    os.chdir(sub_dir) # Change current working directory for the test

    try:
        validator = StoryValidator("dummy.md") # dummy.md won't be read, just need an instance
        assert os.path.abspath(validator.repo_root) == expected_root
    finally:
        os.chdir(original_cwd) # Change back
        # Clean up
        os.rmdir(sub_dir)
        os.rmdir(os.path.join(temp_dir, "scripts"))
        os.rmdir(os.path.join(temp_dir, ".git"))
        os.rmdir(temp_dir)

