#!/usr/bin/env python3
"""
Gemini CLI Session Manager — dev orchestration tool.

Claude uses this to spawn Gemini in background and get notified on completion.
NOT a Copernicus end-user feature — lives in dev_orchestrator/.

Usage:
  python3 dev_orchestrator/gemini_session_manager.py spawn "prompt" --stories 228 214
  python3 dev_orchestrator/gemini_session_manager.py list
  python3 dev_orchestrator/gemini_session_manager.py tail <session_id>
  python3 dev_orchestrator/gemini_session_manager.py kill <session_id>
"""
import argparse, json, shutil, sqlite3, subprocess, sys, time, uuid
from pathlib import Path

GEMINI_BIN = shutil.which('gemini') or 'gemini'

SESSIONS_DIR = Path.home() / '.copernicus' / 'gemini-sessions'
SESSIONS_FILE = SESSIONS_DIR / 'sessions.json'
DB_PATH = Path(__file__).parent.parent / 'copernicus' / 'copernicus.db'


def load_sessions() -> list:
    if SESSIONS_FILE.exists():
        try:
            return json.loads(SESSIONS_FILE.read_text())
        except Exception:
            return []
    return []


def save_sessions(sessions: list) -> None:
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
    tmp = SESSIONS_FILE.with_suffix('.tmp')
    tmp.write_text(json.dumps(sessions, indent=2))
    tmp.replace(SESSIONS_FILE)


def write_db_event(session_id: str, stories: list, exit_code: int, log_path: Path, duration_s: float) -> None:
    if not DB_PATH.exists():
        return
    try:
        conn = sqlite3.connect(str(DB_PATH), timeout=5)
        conn.execute(
            "INSERT INTO events (type, content, metadata, agent_id) VALUES (?, ?, ?, ?)",
            (
                'GEMINI_SESSION_COMPLETE',
                f"Stories: {', '.join(stories)} | Exit: {exit_code}",
                json.dumps({
                    'session_id': session_id,
                    'stories': stories,
                    'exit_code': exit_code,
                    'log_path': str(log_path),
                    'duration_s': duration_s,
                }),
                'gemini-session-manager',
            )
        )
        conn.commit()
        conn.close()
    except Exception:
        pass  # non-fatal


REPO_ROOT = Path(__file__).parent.parent
PERSONAS_DIR = REPO_ROOT / '.gemini' / 'personas'

DEV_ORCHESTRATOR_FOOTER = """
---

## Orchestrator Role — MANDATORY

You are the **orchestrator**. You do NOT write implementation code or analysis directly.

### Delegate ALL substantive work to a sub-agent:
```bash
# Implementation (writes files):
python3 dev_orchestrator/cloud_agent.py <role> "<prompt>" --worktree <branch_name>

# Research / planning (read-only — output goes to docs):
python3 dev_orchestrator/cloud_agent.py <role> "<prompt>" \
  > "docs/planning/agentic platform/<descriptive_snake_case_name>.md"
```
Research and planning tasks MUST be saved to `docs/planning/agentic platform/` with a descriptive filename.
Omit `--worktree` for any task that does not write source files.

### Role selection — match the model to the task:
| Role | Best for |
|------|----------|
| `thinker` | Epic breakdown, architecture decisions, complex reasoning, design trade-offs |
| `coder` | Writing or modifying source files, refactoring, test generation |
| `researcher` | Deep codebase search, API research, dependency analysis |
| `fast` | Quick lookups, single-question answers, format conversions |
| `vision` | UI screenshots, image analysis, design review |

### Rules
1. **Never write source files or long analysis yourself.** Think, decompose, then delegate.
2. **Match role to task** — an epic breakdown goes to `thinker`, not `coder`. A UI audit goes to `vision`.
3. **Always use `--worktree <branch_name>`** when the sub-agent will write or modify files.
4. **Run independent sub-tasks in parallel** — non-overlapping files or concerns = simultaneous sub-agent calls.
5. **After each sub-agent completes**, review output, run `tsc`/`make test` as needed, then accept or re-delegate.
6. **You handle**: reading files for context, running validation commands, `git add`/`git commit`, and final reporting.

### Worktree Lifecycle — MANDATORY cleanup before session ends
Every worktree you create MUST be removed before the session exits:

```bash
# 1. Commit work on the agent branch (inside the worktree)
git -C <worktree_path> add -A
git -C <worktree_path> commit -m "feat(...): ..."

# 2. Merge into main
git -C /Users/dadmin/Projects/agentic-platform merge <branch_name>

# 3. Remove the worktree (from repo root)
git worktree remove --force <worktree_path>

# 4. Delete the branch
git branch -d <branch_name>
```

**Never leave a worktree registered after the session completes.**
Run `git worktree list` at the end to confirm only the main worktree remains.
If a merge has conflicts, flag `NEEDS_MANUAL_RESOLUTION` in the events table but still run `git worktree remove --force` to deregister it.

### Tokens cost $0 — parallelise aggressively and always pick the right role.
"""


def load_persona(name: str) -> str:
    """Load persona markdown from .gemini/personas/<name>.md — empty string if missing."""
    path = PERSONAS_DIR / f'{name}.md'
    if path.exists():
        return path.read_text().strip() + '\n\n---\n\n'
    return ''


def cmd_spawn(prompt: str, stories: list, persona: str = 'dev', direct: bool = False) -> None:
    if not shutil.which(GEMINI_BIN):
        print('ERROR: gemini binary not found in PATH', file=sys.stderr)
        sys.exit(127)
    session_id = str(uuid.uuid4())
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
    log_path = SESSIONS_DIR / f'{session_id}.log'

    persona_text = load_persona(persona)
    if persona_text:
        print(f'PERSONA: {persona}', flush=True)
    if direct:
        print('MODE: direct (no orchestrator footer)', flush=True)
        prompt = persona_text + prompt
    else:
        prompt = persona_text + prompt + DEV_ORCHESTRATOR_FOOTER

    sessions = load_sessions()
    sessions.append({
        'id': session_id,
        'stories': stories,
        'status': 'running',
        'retry_count': 0,
        'started_at': time.time(),
        'log_path': str(log_path),
    })
    save_sessions(sessions)

    print(f'SESSION_ID: {session_id}', flush=True)
    print(f'LOG: {log_path}', flush=True)
    print('Launching gemini CLI... (startup may take 3-5 seconds before first output)', flush=True)

    start = time.time()
    try:
        proc = subprocess.Popen(
            [GEMINI_BIN, '--approval-mode', 'yolo', '-p', prompt],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            text=True,
            bufsize=1,
            cwd=str(Path(__file__).parent.parent),
        )
    except FileNotFoundError:
        sessions = load_sessions()
        for s in sessions:
            if s['id'] == session_id:
                s.update({'status': 'failed', 'exit_code': 127,
                          'completed_at': time.time(), 'duration_s': 0})
        save_sessions(sessions)
        print('ERROR: gemini binary not found on PATH', file=sys.stderr)
        sys.exit(127)

    try:
        with open(log_path, 'w') as log_f:
            for line in (proc.stdout or []):
                log_f.write(line)
                log_f.flush()
                print(line, end='', flush=True)
            proc.wait()
    except KeyboardInterrupt:
        proc.terminate()
        proc.wait()
        sessions = load_sessions()
        for s in sessions:
            if s['id'] == session_id:
                s.update({'status': 'killed', 'exit_code': -1,
                          'completed_at': time.time(), 'duration_s': round(time.time() - start, 1)})
        save_sessions(sessions)
        print('\nSession killed by user.', flush=True)
        sys.exit(1)

    duration = round(time.time() - start, 1)
    exit_code = proc.returncode
    status = 'complete' if exit_code == 0 else 'failed'

    sessions = load_sessions()
    for s in sessions:
        if s['id'] == session_id:
            s.update({
                'status': status,
                'exit_code': exit_code,
                'completed_at': time.time(),
                'duration_s': duration,
            })
    save_sessions(sessions)

    write_db_event(session_id, stories, exit_code, log_path, duration)

    print(f'\nDONE: exit={exit_code}, stories={",".join(stories)}, duration={duration}s', flush=True)
    sys.exit(exit_code)


def cmd_list() -> None:
    sessions = load_sessions()
    if not sessions:
        print('No sessions.')
        return
    for s in reversed(sessions[-20:]):
        status = s.get('status', '?')
        sym = '●' if status == 'running' else ('✓' if status == 'complete' else '✗')
        stories = ', '.join(s.get('stories', []))
        dur = f"{s.get('duration_s', '?')}s" if 'duration_s' in s else 'running'
        print(f"  {sym} {s['id'][:8]}  {stories:<20} {status:<10} {dur}")


def cmd_tail(session_id: str) -> None:
    sessions = load_sessions()
    match = next((s for s in sessions if s['id'].startswith(session_id)), None)
    if not match:
        print(f'Session not found: {session_id}')
        return
    log = Path(match['log_path'])
    if log.exists():
        lines = log.read_text().splitlines()
        print('\n'.join(lines[-50:]))
    else:
        print('Log file not found.')


def cmd_kill(session_id: str) -> None:
    # Sessions run as child processes of the caller — for detached sessions,
    # use pkill. We update the status in sessions.json as killed.
    sessions = load_sessions()
    match = next((s for s in sessions if s['id'].startswith(session_id)), None)
    if not match:
        print(f'Session not found: {session_id}')
        return
    short = match['id'][:8]
    print(f'To kill: pkill -f "gemini.*{short}" or pkill -f "{short}"')
    # Mark as killed in JSON
    for s in sessions:
        if s['id'].startswith(session_id) and s.get('status') == 'running':
            s['status'] = 'killed'
            s['completed_at'] = time.time()
    save_sessions(sessions)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Gemini CLI Session Manager — spawn and track background Gemini sessions'
    )
    sub = parser.add_subparsers(dest='cmd')

    sp = sub.add_parser('spawn', help='Spawn a Gemini session with a prompt')
    sp.add_argument('prompt', nargs='?', default=None, help='Prompt text (use --prompt-file to avoid shell escaping issues)')
    sp.add_argument('--prompt-file', help='Path to file containing the prompt (avoids shell quoting issues)')
    sp.add_argument('--stories', nargs='+', default=[], help='Story IDs being worked on')
    sp.add_argument('--persona', default='dev', help='Persona to inject (default: dev). File: .gemini/personas/<name>.md')
    sp.add_argument('--direct', action='store_true', help='Skip orchestrator footer — use for focused 1-3 file stories where Gemini should use its own file tools directly')

    sub.add_parser('list', help='List recent sessions')

    tp = sub.add_parser('tail', help='Tail the log for a session')
    tp.add_argument('session_id', help='Session ID prefix (first 8 chars ok)')

    kp = sub.add_parser('kill', help='Kill a running session')
    kp.add_argument('session_id', help='Session ID prefix')

    args = parser.parse_args()

    if args.cmd == 'spawn':
        if args.prompt_file:
            prompt = Path(args.prompt_file).read_text()
        elif args.prompt:
            prompt = args.prompt
        else:
            parser.error('spawn requires either a prompt argument or --prompt-file')
        cmd_spawn(prompt, args.stories, persona=args.persona, direct=args.direct)
    elif args.cmd == 'list':
        cmd_list()
    elif args.cmd == 'tail':
        cmd_tail(args.session_id)
    elif args.cmd == 'kill':
        cmd_kill(args.session_id)
    else:
        parser.print_help()
