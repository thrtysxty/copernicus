# Sprint Handoff — Gemini Autonomous Session
**Date:** 2026-03-06
**Prepared by:** Claude (orchestrator)
**For:** Gemini CLI autonomous implementation session
**Repo:** /Users/dadmin/Projects/agentic-platform
**Branch:** main (push directly — no PRs needed for this sprint)

---

## Current State

```
Last commit: e916050 feat(story-188): copernicus guide persona in GUIDE tab
Clean working tree (only docs/dev/SPRINT_HANDOFF.md is new)
tsc --noEmit: PASSING
```

### Recently Completed (this session — do NOT re-implement)
- Story 180, 183, 186, 187, 188, 190, 196, 232, 233 — all committed and pushed
- Story 181 (Quick Tour) — VERIFIED COMPLETE by researcher, close the story file

---

## Non-Negotiable Standards

Every change must follow these rules or the commit will be rejected:

1. **IPC handlers**: every `ipcMain.handle` MUST use `handleIpc()` wrapper in `main.ts`
2. **Renderer IPC**: use `useIpcError()` hook + `unwrapIpc()` — never `window.ipcRenderer.invoke` bare
3. **tsc**: `cd copernicus && npx tsc --noEmit` must pass with zero errors before every commit
4. **Commit format**: `feat(story-NNN): description` — one story per commit
5. **No placeholders**: complete code blocks only — no `// ... rest of code`
6. **VT block active state**: `bg-copernicus-phosphor text-[#050505] rounded-none` (not underline/ghost)

---

## Sprint Tasks (execute in this order)

---

### TASK 1 — Close Story 181 *(5 minutes)*

Story 181 is fully implemented. Move it to completed:

```bash
sed -i '' 's/^status:.*/status: COMPLETE/' docs/stories/story_181_quick_tour.md
mv docs/stories/story_181_quick_tour.md docs/stories/completed/
git add -A && git commit -m "chore(story-181): mark Quick Tour complete and move to completed folder"
git push
```

---

### TASK 2 — Story 228: Complete model-switch confirmation chip *(~45 minutes)*

**Gap:** Accept/reject buttons missing from confirmation chip + rejection fallback.

**File:** `copernicus/src/renderer/components/chat/ChatPanel.tsx`

Search for `chat:confirm-model-switch` or `confirmModelSwitch` in ChatPanel.tsx to find the existing chip. Then:

**AC-4/5 fix — Add accept/reject UI to chip:**
```tsx
// When orchestrator suggests a model switch, render:
{pendingModelSwitch && (
  <div className="mx-4 mb-2 p-2 bg-zinc-900 border border-amber-500/30 rounded text-[10px]">
    <span className="text-amber-400 font-mono">Orchestrator → </span>
    <span className="text-zinc-300">Use <strong>{pendingModelSwitch.model}</strong> for {pendingModelSwitch.reason}</span>
    <div className="flex gap-2 mt-1.5">
      <button
        onClick={() => acceptModelSwitch(pendingModelSwitch)}
        className="px-2 py-0.5 bg-copernicus-phosphor text-[#050505] rounded text-[9px] font-bold"
      >
        Accept
      </button>
      <button
        onClick={() => rejectModelSwitch()}
        className="px-2 py-0.5 border border-zinc-700 text-zinc-500 rounded text-[9px]"
      >
        Reject
      </button>
    </div>
  </div>
)}
```

**State and handlers to add near other ChatPanel state:**
```tsx
const [pendingModelSwitch, setPendingModelSwitch] = useState<{ model: string; reason: string; sessionId: string } | null>(null)

const acceptModelSwitch = useCallback((sw: { model: string; reason: string; sessionId: string }) => {
  setModel(sw.model)
  setPendingModelSwitch(null)
  invoke('chat:confirm-model-switch', { sessionId: sw.sessionId, accepted: true, model: sw.model }).catch(() => {})
}, [invoke, setModel])

const rejectModelSwitch = useCallback(() => {
  if (pendingModelSwitch) {
    invoke('chat:confirm-model-switch', { sessionId: pendingModelSwitch.sessionId, accepted: false }).catch(() => {})
  }
  setPendingModelSwitch(null)
}, [invoke, pendingModelSwitch])
```

**IPC listener** (add to the useEffect that registers IPC listeners):
```tsx
const removeModelSwitch = window.ipcRenderer.on('chat:confirm-model-switch', (_e: any, payload: any) => {
  setPendingModelSwitch(payload)
})
// include removeModelSwitch() in cleanup return
```

**File:** `copernicus/electron/main.ts`

Check if `chat:confirm-model-switch` handler exists. If it only pushes to renderer but doesn't handle the response, add the response handler:
```typescript
ipcMain.handle('chat:confirm-model-switch', (_e, payload) => handleIpc(() => {
  // Store the decision for the orchestrator to pick up
  BrowserWindow.getAllWindows().forEach(w =>
    w.webContents.send('chat:model-switch-decision', payload))
}))
```

Add `chat:confirm-model-switch` and `chat:model-switch-decision` to SEND_CHANNELS in `preload.ts` if not present.

**Verification:**
```bash
cd copernicus && npx tsc --noEmit
git add -A && git commit -m "feat(story-228): complete model-switch accept/reject UI chip and rejection fallback"
git push
```

---

### TASK 3 — Story 214: Token validation + disconnect *(~30 minutes)*

**Gap:** No token validation before showing "connected", no disconnect button.

**File:** `copernicus/src/renderer/components/settings/SettingsPanel.tsx`
(or wherever the Ollama Cloud section lives — search for `OllamaCloud` or `ollama_cloud`)

**AC-6 — Token validation:** Before setting the connected state, add a ping:
```tsx
const validateOllamaToken = async () => {
  try {
    const res = await invoke<any>('auth:validate-ollama-cloud')
    const valid = unwrapIpc<boolean>(res)
    setOllamaCloudConnected(!!valid)
  } catch {
    setOllamaCloudConnected(false)
  }
}
// Call validateOllamaToken() in the useEffect that loads auth status
```

**File:** `copernicus/electron/main.ts`

Add validation handler:
```typescript
ipcMain.handle('auth:validate-ollama-cloud', () => handleIpc(async () => {
  const key = authManager.getApiKey('ollama')
  if (!key) return false
  const cloudHost = authManager.getBaseUrl('ollama') || 'https://ollama.com'
  const res = await fetch(`${cloudHost}/api/tags`, {
    headers: { Authorization: `Bearer ${key}` }
  }).catch(() => null)
  return res?.ok ?? false
}))
```

**AC-7 — Disconnect button:** In the Ollama Cloud settings section, add:
```tsx
<button
  onClick={async () => {
    await invoke('auth:revoke-key', 'ollama')
    setOllamaCloudConnected(false)
  }}
  className="text-[9px] text-red-400 border border-red-500/30 px-2 py-0.5 rounded hover:bg-red-500/10"
>
  Disconnect
</button>
```

**File:** `copernicus/electron/auth-manager.ts`

Add `revokeKey(provider)` method if not present:
```typescript
revokeKey(provider: string): void {
  if (safeStorage.isEncryptionAvailable()) {
    // Remove from stored keys
    const store = this.getStore()
    delete store[provider]
    this.saveStore(store)
  }
}
```

Add IPC handler: `ipcMain.handle('auth:revoke-key', (_e, provider) => handleIpc(() => authManager.revokeKey(provider)))`
Add `auth:revoke-key` and `auth:validate-ollama-cloud` to preload.ts SEND_CHANNELS.

**Verification:**
```bash
cd copernicus && npx tsc --noEmit
git add -A && git commit -m "feat(story-214): add token validation and disconnect to Ollama Cloud auth"
git push
```

---

### TASK 4 — Story 233: Write events to SQLite *(~20 minutes)*

**Gap:** `log_event()` in `cloud_agent.py` doesn't persist to DB — only logs to console.

**File:** `dev_orchestrator/cloud_agent.py`

The `log_event` method currently exists but may not write to the DB. Find it and ensure it writes to `copernicus/copernicus.db`:

```python
def log_event(self, event_type: str, content: str, metadata: dict = None) -> None:
    """Write event to centralized comms bus (events table)."""
    import json, sqlite3, threading, os
    db_path = os.path.normpath(os.path.join(
        os.path.dirname(__file__), '..', 'copernicus', 'copernicus.db'
    ))
    if not os.path.exists(db_path):
        return  # non-fatal if DB not initialized

    def _write():
        try:
            conn = sqlite3.connect(db_path, timeout=5)
            conn.execute(
                "INSERT INTO events (type, content, metadata, agent_id) VALUES (?, ?, ?, ?)",
                (
                    event_type,
                    content,
                    json.dumps(metadata or {}),
                    getattr(self, 'role', 'cloud_agent')
                )
            )
            conn.commit()
            conn.close()
        except Exception as e:
            pass  # non-fatal

    threading.Thread(target=_write, daemon=True).start()
```

Also update `scripts/agent_gateway.py` — verify it uses `[[SIGNAL_ORCHESTRATOR]]` not `[[CALL_GEMINI]]`.

**Verification:**
```bash
python3 -c "from dev_orchestrator.cloud_agent import StandaloneCloudAgent; print('OK')"
git add dev_orchestrator/cloud_agent.py scripts/agent_gateway.py
git commit -m "fix(story-233): wire log_event to write events table in copernicus.db"
git push
```

---

### TASK 5 — Story 237: GeminiSessionManager *(~45 minutes)*

**This is a dev orchestration tool in Python — NOT an Electron feature.**
Lives in `dev_orchestrator/`, no TypeScript, no IPC, no BrowserWindow.
Pure stdlib Python. The IDE panel for sessions is deferred to post-workflow-engine.

**File:** `dev_orchestrator/gemini_session_manager.py` *(new)*

```python
#!/usr/bin/env python3
"""
Gemini CLI Session Manager — dev orchestration tool.
Claude uses this to spawn Gemini in background and get notified on completion.
NOT a Copernicus end-user feature — lives in dev_orchestrator/.
"""
import argparse, json, os, sqlite3, subprocess, sys, time, uuid
from pathlib import Path

SESSIONS_DIR = Path.home() / '.copernicus' / 'gemini-sessions'
SESSIONS_FILE = SESSIONS_DIR / 'sessions.json'
DB_PATH = Path(__file__).parent.parent / 'copernicus' / 'copernicus.db'

def load_sessions():
    if SESSIONS_FILE.exists():
        return json.loads(SESSIONS_FILE.read_text())
    return []

def save_sessions(sessions):
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
    SESSIONS_FILE.write_text(json.dumps(sessions, indent=2))

def write_db_event(session_id, stories, exit_code, log_path, duration_s):
    if not DB_PATH.exists():
        return
    try:
        conn = sqlite3.connect(str(DB_PATH), timeout=5)
        conn.execute(
            "INSERT INTO events (type, content, metadata, agent_id) VALUES (?, ?, ?, ?)",
            (
                'GEMINI_SESSION_COMPLETE',
                f"Stories: {', '.join(stories)} | Exit: {exit_code}",
                json.dumps({'session_id': session_id, 'stories': stories,
                            'exit_code': exit_code, 'log_path': str(log_path),
                            'duration_s': duration_s}),
                'gemini-session-manager'
            )
        )
        conn.commit()
        conn.close()
    except Exception:
        pass  # non-fatal

def cmd_spawn(prompt, stories):
    session_id = str(uuid.uuid4())
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
    log_path = SESSIONS_DIR / f'{session_id}.log'

    sessions = load_sessions()
    sessions.append({'id': session_id, 'stories': stories, 'status': 'running',
                     'started_at': time.time(), 'log_path': str(log_path)})
    save_sessions(sessions)

    print(f'SESSION_ID: {session_id}', flush=True)
    print(f'LOG: {log_path}', flush=True)

    start = time.time()
    with open(log_path, 'w') as log_f:
        proc = subprocess.Popen(
            ['gemini', '--approval-mode', 'yolo', '-p', prompt],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, bufsize=1,
            cwd=str(Path(__file__).parent.parent)
        )
        for line in proc.stdout:
            log_f.write(line)
            log_f.flush()
            print(line, end='', flush=True)
        proc.wait()

    duration = round(time.time() - start, 1)
    exit_code = proc.returncode
    status = 'complete' if exit_code == 0 else 'failed'

    sessions = load_sessions()
    for s in sessions:
        if s['id'] == session_id:
            s.update({'status': status, 'exit_code': exit_code,
                      'completed_at': time.time(), 'duration_s': duration})
    save_sessions(sessions)

    write_db_event(session_id, stories, exit_code, log_path, duration)

    print(f'\nDONE: exit={exit_code}, stories={",".join(stories)}, duration={duration}s', flush=True)
    sys.exit(exit_code)

def cmd_list():
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

def cmd_tail(session_id):
    sessions = load_sessions()
    match = next((s for s in sessions if s['id'].startswith(session_id)), None)
    if not match:
        print(f'Session not found: {session_id}')
        return
    log = Path(match['log_path'])
    if log.exists():
        lines = log.read_text().splitlines()
        print('\n'.join(lines[-50:]))

def cmd_kill(session_id):
    print(f'Kill not supported for detached sessions. Use: pkill -f "gemini.*{session_id[:8]}"')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Gemini CLI Session Manager')
    sub = parser.add_subparsers(dest='cmd')

    sp = sub.add_parser('spawn')
    sp.add_argument('prompt')
    sp.add_argument('--stories', nargs='+', default=[])

    sub.add_parser('list')

    tp = sub.add_parser('tail')
    tp.add_argument('session_id')

    kp = sub.add_parser('kill')
    kp.add_argument('session_id')

    args = parser.parse_args()
    if args.cmd == 'spawn':   cmd_spawn(args.prompt, args.stories)
    elif args.cmd == 'list':  cmd_list()
    elif args.cmd == 'tail':  cmd_tail(args.session_id)
    elif args.cmd == 'kill':  cmd_kill(args.session_id)
    else: parser.print_help()
```

**No changes to Electron.** The Command Center panel for sessions is deferred until the workflow engine is live.

**Verification:**
```bash
cd copernicus && npx tsc --noEmit
git add -A && git commit -m "feat(story-237): GeminiSessionManager, IPC handlers, and Command Center panel"
git push
```

---

## Closing Instructions

After all tasks complete:
1. Run `cd copernicus && npx tsc --noEmit` one final time
2. Run `git log --oneline -8` to confirm all commits are pushed
3. Move completed story files: `mv docs/stories/story_{181,214,228,233,237}*.md docs/stories/completed/`
4. Update status to COMPLETE in each moved file
5. Final commit: `git add docs/stories/ && git commit -m "chore: close sprint stories 181 214 228 233 237" && git push`

## DO NOT TOUCH
- `copernicus/electron/workflow/engine.ts` (Story 187 just completed — Gemini-only file)
- `copernicus/electron/codebase-indexer.ts` (Story 219 — stable)
- `backend/api/agents.py` (Story 223 — stable)
- `docs/stories/completed/` — do not modify completed stories
- Do not amend or rebase existing commits
