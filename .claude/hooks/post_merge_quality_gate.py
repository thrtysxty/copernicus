#!/usr/bin/env python3
"""
PostToolUse hook — multi-language LSP/lint gate.

Runs after Bash commands that merge or apply agent work.
Checks TypeScript (tsc --noEmit) and Python (py_compile + mypy if available).
Blocks on errors to prevent broken code from landing silently.

Triggers on: git merge, git apply, git cherry-pick, patch apply
"""
import json
import sys
import subprocess
import os
import re

REPO_ROOT = '/Users/dadmin/Projects/agentic-platform'
COPERNICUS_DIR = os.path.join(REPO_ROOT, 'copernicus')

MERGE_PATTERNS = [
    r'git merge',
    r'git apply',
    r'git cherry-pick',
    r'patch\s+-p',
    r'git am\b',
]

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

tool_name = data.get('tool_name', '')
tool_input = data.get('tool_input', {})

if tool_name != 'Bash':
    sys.exit(0)

command = tool_input.get('command', '')

# Only run after merge/apply operations
triggered = any(re.search(p, command) for p in MERGE_PATTERNS)
if not triggered:
    sys.exit(0)

errors = []

# --- TypeScript check ---
tsc = subprocess.run(
    ['npx', 'tsc', '--noEmit'],
    cwd=COPERNICUS_DIR,
    capture_output=True,
    text=True,
    timeout=120,
)
if tsc.returncode != 0:
    errors.append(('TypeScript', tsc.stdout.strip() or tsc.stderr.strip()))

# --- Python check: get changed .py files ---
changed = subprocess.run(
    ['git', 'diff', '--name-only', 'HEAD~1', 'HEAD'],
    cwd=REPO_ROOT,
    capture_output=True,
    text=True,
)
py_files = [f for f in changed.stdout.splitlines() if f.endswith('.py')]

for py_file in py_files:
    full_path = os.path.join(REPO_ROOT, py_file)
    if not os.path.exists(full_path):
        continue
    result = subprocess.run(
        [sys.executable, '-m', 'py_compile', full_path],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        errors.append((f'Python syntax ({py_file})', result.stderr.strip()))

# --- mypy if available ---
mypy_check = subprocess.run(['which', 'mypy'], capture_output=True)
if mypy_check.returncode == 0 and py_files:
    mypy = subprocess.run(
        ['mypy', '--ignore-missing-imports', '--no-error-summary'] + py_files,
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=60,
    )
    if mypy.returncode != 0:
        errors.append(('mypy', mypy.stdout.strip()[:1500]))

if errors:
    print(f"\n  LSP GATE FAILED after: {command[:80]}")
    for lang, msg in errors:
        print(f"\n  [{lang}]")
        for line in msg.splitlines()[:20]:
            print(f"    {line}")
    print(f"\n  Fix errors before proceeding. Do not merge broken code.")
    sys.exit(1)

print(f"  LSP gate passed (tsc clean, {len(py_files)} py files checked)")
sys.exit(0)
