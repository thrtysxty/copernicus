from pathlib import Path
import os

# Define allowed roots for file operations
ALLOWED_ROOTS = [
    str(Path.home() / 'Projects'),
    '/tmp/copernicus',
    str(Path(__file__).resolve().parent.parent.parent)  # Current project root
]

def assert_safe_path(path_str: str, roots: list[str] = None) -> Path:
    """
    Resolves path and asserts it is within one of the allowed roots.
    Returns the resolved Path object.
    Raises ValueError if path is outside allowed roots.
    """
    if roots is None:
        roots = ALLOWED_ROOTS
        
    # Handle None input gracefully
    if path_str is None:
        raise ValueError(f"Path outside allowed roots: None")
    
    # Use realpath to resolve symlinks (handles macOS /private/etc)
    resolved = Path(path_str).resolve()
    resolved_str = str(resolved)
    
    # Ensure all roots are absolute and resolved
    abs_roots = [str(Path(r).resolve()) for r in roots]
    
    if not any(resolved_str == root or resolved_str.startswith(root + os.sep) for root in abs_roots):
        raise ValueError(f"Path outside allowed roots: {resolved}")
        
    return resolved
