# Execution Plan 003: Shell Injection Remediation
**Sprint:** 1
**Agent Role:** Senior Developer (Python + TypeScript)
**Story:** 101 (C-5, M-2, M-4)
**Prerequisite:** Plan 001 complete
**Date Authored:** 2026-02-25

---

## Context

Multiple call sites use `shell=True` / `shell: true` with user-controlled input,
enabling command injection. The blacklist in `tool_executor.py` is trivially bypassed.
A symlink-based path traversal exists in `tool_executor.py`. A circular import
in `scaffold_story.py` prevents direct script execution.

This plan eliminates all `shell=True` usage and hardens the input validation layer.

---

## Task 1: Fix `agent_tui.py` Shell Injection (C-5)

### File: `scripts/agent_tui.py`

**Step 1: Read `scripts/agent_tui.py` around lines 2230–2280.**

Find the `subprocess.Popen` call with `shell=True`. Identify:
- Where the `command` variable comes from (user input? LLM output? Makefile target?)
- What valid commands look like (is it a Makefile target, a shell command, or a Python call?)

**Step 2: Determine the correct remediation approach based on what you find.**

**Case A — `command` is a Makefile target (e.g. `"dev"`, `"test"`):**

Replace:
```python
process = subprocess.Popen(
    command,
    shell=True,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    bufsize=1,
)
```

With:
```python
import shlex

# Validate target is alphanumeric with hyphens/underscores only
if not re.fullmatch(r'[a-zA-Z0-9_\-]+', command):
    raise ValueError(f"Invalid make target: {command!r}")

process = subprocess.Popen(
    ['make', command],   # list form — no shell interpretation
    shell=False,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    bufsize=1,
    cwd=self.repo_root,
)
```

**Case B — `command` is a free-form shell string (e.g. from LLM output):**

Replace:
```python
process = subprocess.Popen(
    command,
    shell=True,
    ...
)
```

With:
```python
import shlex

args = shlex.split(command)
if not args:
    raise ValueError("Empty command")

# Validate first token is an allowed executable
ALLOWED_EXECUTABLES = {'make', 'python', 'python3', 'npm', 'git', 'ruff', 'pytest'}
if args[0] not in ALLOWED_EXECUTABLES:
    raise ValueError(f"Executable not permitted: {args[0]!r}")

process = subprocess.Popen(
    args,
    shell=False,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    bufsize=1,
    cwd=self.repo_root,
)
```

**Step 3: Search for any other `shell=True` usages in `agent_tui.py`.**

```bash
grep -n "shell=True" scripts/agent_tui.py
```

Apply the same remediation to every instance found.

---

## Task 2: Fix `tool_executor.py` Shell Injection and Blacklist (C-5)

### File: `scripts/utils/tool_executor.py`

**Step 1: Read `scripts/utils/tool_executor.py` in full.**

**Step 2: Replace the blacklist-based `exec_command` with a whitelist approach.**

Find the `exec_command` method. Replace the body:

```python
import shlex
import re

# Allowed first-token executables. Extend as needed.
_ALLOWED_EXEC = frozenset({
    'make', 'python', 'python3', 'pip', 'pip3',
    'npm', 'npx', 'node',
    'git',
    'ruff', 'pytest', 'mypy',
    'ls', 'cat', 'echo', 'pwd', 'which',
    'curl', 'wget',
})

def exec_command(self, command: str, confirm: bool = True) -> str:
    """Execute a shell command safely.

    Uses list-based Popen (no shell interpretation).
    Only executables in _ALLOWED_EXEC are permitted.
    Returns stdout+stderr as a string.
    """
    try:
        args = shlex.split(command)
    except ValueError as exc:
        return f"Error: Failed to parse command: {exc}"

    if not args:
        return "Error: Empty command."

    executable = args[0]
    if executable not in self._ALLOWED_EXEC:
        return (
            f"Error: Executable '{executable}' is not in the permitted list. "
            f"Allowed: {sorted(self._ALLOWED_EXEC)}"
        )

    if confirm and not self.confirm("EXECUTE", command):
        return "Cancelled by user."

    try:
        result = subprocess.run(  # noqa: S603
            args,
            shell=False,       # explicit — no shell interpretation
            cwd=self.repo_root,
            capture_output=True,
            text=True,
            timeout=120,
        )
        output = result.stdout + result.stderr
        return output if output else "(no output)"
    except subprocess.TimeoutExpired:
        return "Error: Command timed out after 120 seconds."
    except FileNotFoundError:
        return f"Error: Executable '{executable}' not found on PATH."
    except OSError as exc:
        return f"Error: OS error running command: {exc}"
```

**Step 3: Verify the original blacklist is removed.** Search for `dangerous =` and
remove that block entirely.

---

## Task 3: Fix Path Traversal in `tool_executor.py` (M-2)

### File: `scripts/utils/tool_executor.py`

**Step 1: Find the `write_file` method (around line 42).**

Current code:
```python
full_path = os.path.abspath(os.path.join(self.repo_root, rel_path))
if not full_path.startswith(self.repo_root):
    return "Error: Path traversal detected. Access denied."
```

**Step 2: Replace with `pathlib`-based resolution that handles symlinks.**

```python
from pathlib import Path

def write_file(self, rel_path: str, content: str, confirm: bool = True, allow_overwrite: bool = False) -> str:
    """Write content to a file within the repository root.

    Resolves symlinks before checking containment to prevent traversal attacks.
    """
    repo_root = Path(self.repo_root).resolve()

    # Resolve the target path (follows symlinks)
    try:
        target = (repo_root / rel_path).resolve()
    except OSError as exc:
        return f"Error: Cannot resolve path: {exc}"

    # Verify the resolved path is within the repository root
    try:
        target.relative_to(repo_root)
    except ValueError:
        return f"Error: Path traversal detected. '{rel_path}' resolves outside repository."

    if target.exists() and not allow_overwrite:
        return f"Error: File already exists at '{target}'. Pass allow_overwrite=True to overwrite."

    if confirm and not self.confirm("WRITE FILE", str(target)):
        return "Cancelled by user."

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    return f"Written: {target}"
```

---

## Task 4: Fix `makefile:run` IPC Handler in Copernicus (C-5)

### File: `copernicus/electron/main.ts`

**Step 1: Read `copernicus/electron/main.ts` and find the `makefile:run` handler.**

It currently does:
```typescript
ipcMain.handle('makefile:run', (_event, target) => {
  const child = spawn('make', [target], { cwd: ROOT_PATH, shell: true })
  ...
})
```

**Step 2: Add target validation and remove `shell: true`.**

```typescript
// Allowlist of permitted Makefile targets
const ALLOWED_MAKE_TARGETS = new Set([
  'dev', 'dev-backend', 'dev-frontend',
  'test', 'test-e2e',
  'build', 'lint', 'clean',
  'deploy', 'db-deploy', 'db-migrate',
  'agent', 'dashboard',
  'backlog', 'import-data',
])

ipcMain.handle('makefile:run', (_event, target: unknown) => {
  // Validate type
  if (typeof target !== 'string') {
    return { error: 'Invalid target type' }
  }

  // Validate against allowlist
  const sanitised = target.trim()
  if (!ALLOWED_MAKE_TARGETS.has(sanitised)) {
    console.warn(`[security] Blocked make target: ${sanitised}`)
    return { error: `Target '${sanitised}' is not permitted` }
  }

  return new Promise((resolve) => {
    const child = spawn('make', [sanitised], {
      cwd: ROOT_PATH,
      shell: false,   // FIXED: no shell interpretation
    })
    // ... rest of the existing output handling logic unchanged
  })
})
```

Apply the same pattern to the `system:make` handler.

**Step 3: Verify TypeScript compiles.**

```bash
cd copernicus && npx tsc --noEmit 2>&1 | head -30
```

---

## Task 5: Fix Circular Import in `scaffold_story.py` (M-4)

### File: `scripts/utils/scaffold_story.py`

**Step 1: Read `scripts/utils/scaffold_story.py` in full.**

Find the import:
```python
from scripts.utils import generate_backlog
```

**Step 2: Determine what `generate_backlog` is used for in this file.**

If it is called after story creation to regenerate the backlog, it can be invoked
as a subprocess instead of a module import:

```python
# REMOVE: from scripts.utils import generate_backlog

# ADD (at point of use):
import subprocess
subprocess.run(
    ['python', 'scripts/utils/generate_backlog.py'],
    cwd=PROJECT_ROOT,
    check=False,
)
```

If `generate_backlog` provides a function called directly, restructure as a
relative import by converting the directory to a proper package (add `__init__.py`
if missing) and import:

```python
# Replace:
from scripts.utils import generate_backlog

# With:
from pathlib import Path
import importlib.util

_GB_PATH = Path(__file__).parent / 'generate_backlog.py'
_spec = importlib.util.spec_from_file_location('generate_backlog', _GB_PATH)
generate_backlog = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(generate_backlog)
```

Choose whichever approach matches the actual usage pattern.

**Step 3: Verify `scaffold_story.py` runs without ImportError.**

```bash
python scripts/utils/scaffold_story.py --help 2>&1 | head -10
```

Should show usage, not a traceback.

---

## Completion Checklist

- [ ] `grep -rn "shell=True" scripts/` returns zero results (or only nosec-annotated, documented exceptions)
- [ ] `grep -n "shell: true" copernicus/electron/main.ts` returns zero results
- [ ] `tool_executor.py` uses whitelist-based `exec_command` with `shell=False`
- [ ] `write_file` uses `Path.resolve()` and `relative_to()` for traversal check
- [ ] `makefile:run` and `system:make` IPC handlers validate against `ALLOWED_MAKE_TARGETS`
- [ ] `scaffold_story.py --help` runs without ImportError
- [ ] `python -m pytest tests/ -v` still passes

**Commit message:**
```
security(sprint-1): eliminate shell injection and path traversal vectors

- Replace shell=True Popen in agent_tui.py with validated list-based args (C-5)
- Replace blacklist exec_command with allowlist + shell=False in tool_executor (C-5)
- Fix symlink path traversal in tool_executor.write_file using Path.resolve() (M-2)
- Add ALLOWED_MAKE_TARGETS validation to makefile:run IPC handler (C-5)
- Fix circular import in scaffold_story.py (M-4)
```
