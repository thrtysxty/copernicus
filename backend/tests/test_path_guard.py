import pytest
from pathlib import Path
import os # Import os for os.sep

from backend.utils.path_guard import assert_safe_path

# Define a consistent mock project root for testing
MOCK_PROJECT_ROOT = Path('/mock_project_root')
MOCK_ALLOWED_ROOTS = [MOCK_PROJECT_ROOT / 'data']

def test_assert_safe_path_inside_allowed_root():
    """Test with a path inside allowed roots -> returns resolved Path."""
    safe_path = assert_safe_path(str(MOCK_PROJECT_ROOT / 'data' / 'file.txt'), roots=[str(r) for r in MOCK_ALLOWED_ROOTS])
    assert safe_path == MOCK_PROJECT_ROOT / 'data' / 'file.txt'

def test_assert_safe_path_outside_allowed_root():
    """Test with a path outside all roots -> raises ValueError."""
    with pytest.raises(ValueError, match="Path outside allowed roots: /outside/file.txt"):
        assert_safe_path('/outside/file.txt', roots=[str(r) for r in MOCK_ALLOWED_ROOTS])

def test_assert_safe_path_with_path_traversal():
    """Test with path traversal (../../etc/passwd) -> raises ValueError."""
    # This path is constructed to resolve outside the mock root if not handled
    bad_path = str(MOCK_PROJECT_ROOT / 'data' / '..' / '..' / 'etc' / 'passwd')
    with pytest.raises(ValueError, match="Path outside allowed roots: /etc/passwd"):        assert_safe_path(bad_path, roots=[str(r) for r in MOCK_ALLOWED_ROOTS])

def test_assert_safe_path_with_symlink_outside_roots(tmp_path):
    """Test with symlink that resolves outside roots -> raises ValueError."""
    # Create a mock allowed root within the temporary directory
    mock_data_root_temp = tmp_path / "mock_project_root_temp" / "data"
    mock_data_root_temp.mkdir(parents=True)
    
    # Create a target file outside the mock project root temp
    target_file = tmp_path / "outside_symlink_target.txt"
    target_file.touch()

    # Create a symlink inside the allowed root, pointing outside
    symlink_path = mock_data_root_temp / "bad_link.txt"
    symlink_path.symlink_to(target_file)

    allowed_roots_temp = [str(mock_data_root_temp)]
    with pytest.raises(ValueError, match=f"Path outside allowed roots: {str(target_file)}"):
        assert_safe_path(str(symlink_path), roots=allowed_roots_temp)

def test_assert_safe_path_with_symlink_inside_roots(tmp_path):
    """Test with symlink that resolves inside roots -> returns resolved Path."""
    mock_data_root_temp = tmp_path / "mock_project_root_temp" / "data"
    mock_data_root_temp.mkdir(parents=True)

    target_file = mock_data_root_temp / "target.txt"
    target_file.touch()

    symlink_path = mock_data_root_temp / "good_link.txt"
    symlink_path.symlink_to(target_file)

    allowed_roots_temp = [str(mock_data_root_temp)]
    safe_path = assert_safe_path(str(symlink_path), roots=allowed_roots_temp)
    assert safe_path == target_file