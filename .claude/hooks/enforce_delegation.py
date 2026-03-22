#!/usr/bin/env python3
"""
PreToolUse hook — delegation reminder (warn, not block).

Claude should delegate primary implementation to Gemini, Jules, or cloud_agent.
Direct edits by Claude are acceptable for:
  - Merges, PR fixes, cherry-picks
  - Fixing issues surfaced by coding agents
  - Small targeted fixes when user explicitly requests
  - Story/doc authoring (always allowed)

This hook prints a reminder when touching implementation paths.
It does NOT block — Claude uses judgment on whether to delegate.
"""
import json
import sys

IMPL_PATHS = [
    'copernicus/src/',
    'copernicus/electron/',
    'backend/',
    'src/agentic/',
]

ALLOWED_SUBSTRINGS = (
    'docs/', '.claude/', 'CLAUDE.md', 'README', 'Makefile', 'Dockerfile',
    'docs/stories/', 'docs/reference/', 'docs/epics/', 'scripts/utils/',
)

ALLOWED_EXTENSIONS = ('.md', '.json', '.yaml', '.yml', '.toml', '.cfg', '.ini',)

EDIT_TOOLS = ('Edit', 'Write', 'MultiEdit')

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

tool_name = data.get('tool_name', '')
tool_input = data.get('tool_input', {})

if tool_name not in EDIT_TOOLS:
    sys.exit(0)

file_path = tool_input.get('file_path', tool_input.get('new_file_path', ''))

for substring in ALLOWED_SUBSTRINGS:
    if substring in file_path:
        sys.exit(0)

for ext in ALLOWED_EXTENSIONS:
    if file_path.endswith(ext):
        sys.exit(0)

for impl in IMPL_PATHS:
    if impl in file_path:
        # Warn only — Claude decides whether to proceed
        print(f"[delegation] Editing implementation file: {file_path}")
        print(f"[delegation] Prefer Jules/Gemini/cloud_agent for primary implementation.")
        print(f"[delegation] Direct edit is OK for: merges, agent fixes, user-requested work.")
        # exit(0) = allow, exit(1) = block
        sys.exit(0)

sys.exit(0)
