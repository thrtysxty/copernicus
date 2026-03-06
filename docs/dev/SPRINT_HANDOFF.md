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

### TASK 5 — Story 237: GeminiSessionManager *(~90 minutes)*

Full implementation from scratch — this is the largest task.

**File:** `copernicus/electron/gemini-session-manager.ts` *(new)*

```typescript
import { spawn, ChildProcess } from 'node:child_process'
import { createWriteStream, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import log from './utils/logger'

export interface GeminiSession {
  id: string
  storyIds: string[]
  pid: number
  status: 'running' | 'complete' | 'failed'
  startedAt: number
  completedAt?: number
  exitCode?: number
  logPath: string
}

class GeminiSessionManager {
  private sessions = new Map<string, GeminiSession>()
  private processes = new Map<string, ChildProcess>()

  private broadcast(channel: string, payload: object) {
    BrowserWindow.getAllWindows().forEach(w => {
      if (!w.isDestroyed()) w.webContents.send(channel, payload)
    })
  }

  spawn(prompt: string, storyIds: string[]): GeminiSession {
    const id = randomUUID()
    const logDir = join(app.getPath('userData'), 'gemini-sessions')
    const { mkdirSync } = require('node:fs')
    mkdirSync(logDir, { recursive: true })
    const logPath = join(logDir, `${id}.log`)
    const logStream = createWriteStream(logPath, { flags: 'a' })

    const child = spawn('gemini', ['--approval-mode', 'yolo', '-p', prompt], {
      cwd: app.getAppPath().replace('/app.asar', ''),
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    const session: GeminiSession = {
      id, storyIds, pid: child.pid ?? 0,
      status: 'running', startedAt: Date.now(), logPath
    }
    this.sessions.set(id, session)
    this.processes.set(id, child)

    const onLine = (line: string) => {
      logStream.write(line + '\n')
      this.broadcast('gemini:session-output', { id, line: line.toString() })
    }

    child.stdout?.on('data', d => d.toString().split('\n').filter(Boolean).forEach(onLine))
    child.stderr?.on('data', d => d.toString().split('\n').filter(Boolean).forEach(onLine))

    child.on('exit', (code) => {
      const s = this.sessions.get(id)
      if (s) {
        s.status = code === 0 ? 'complete' : 'failed'
        s.exitCode = code ?? -1
        s.completedAt = Date.now()
      }
      logStream.end()
      this.processes.delete(id)
      this.broadcast('gemini:session-status', { id, storyIds, status: s?.status, exitCode: code })
      log.info(`[GeminiSession] ${id} exited with code ${code}`)
    })

    this.broadcast('gemini:session-status', { id, storyIds, status: 'running' })
    return session
  }

  listSessions(): GeminiSession[] {
    return Array.from(this.sessions.values())
  }

  killSession(id: string): void {
    this.processes.get(id)?.kill('SIGTERM')
    const s = this.sessions.get(id)
    if (s) { s.status = 'failed'; s.exitCode = -1; s.completedAt = Date.now() }
  }

  getSessionLog(id: string): string {
    const s = this.sessions.get(id)
    if (!s || !existsSync(s.logPath)) return ''
    return readFileSync(s.logPath, 'utf8')
  }
}

export const geminiSessionManager = new GeminiSessionManager()
```

**File:** `copernicus/electron/main.ts`

Import and register handlers:
```typescript
import { geminiSessionManager } from './gemini-session-manager'

ipcMain.handle('gemini:spawn', (_e, prompt: string, storyIds: string[]) =>
  handleIpc(() => geminiSessionManager.spawn(prompt, storyIds)))

ipcMain.handle('gemini:list-sessions', () =>
  handleIpc(() => geminiSessionManager.listSessions()))

ipcMain.handle('gemini:kill', (_e, id: string) =>
  handleIpc(() => geminiSessionManager.killSession(id)))

ipcMain.handle('gemini:get-log', (_e, id: string) =>
  handleIpc(() => geminiSessionManager.getSessionLog(id)))
```

**File:** `copernicus/electron/preload.ts`

Add to SEND_CHANNELS: `'gemini:spawn'`, `'gemini:list-sessions'`, `'gemini:kill'`, `'gemini:get-log'`
Add to RECEIVE_CHANNELS: `'gemini:session-status'`, `'gemini:session-output'`

**File:** `copernicus/src/renderer/components/commandcenter/GeminiSessions.tsx` *(new)*

```tsx
import { useState, useEffect, useCallback } from 'react'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc } from '../../types/ipc'
import { Play, Square, ChevronDown, ChevronRight } from 'lucide-react'

interface GeminiSession {
  id: string; storyIds: string[]; status: 'running' | 'complete' | 'failed'
  startedAt: number; completedAt?: number; exitCode?: number; logPath: string
}

export function GeminiSessions() {
  const invoke = useIpcError()
  const [sessions, setSessions] = useState<GeminiSession[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [logs, setLogs] = useState<Record<string, string[]>>({})

  const refresh = useCallback(() => {
    invoke<any>('gemini:list-sessions').then(r => {
      setSessions(unwrapIpc<GeminiSession[]>(r) ?? [])
    }).catch(() => {})
  }, [invoke])

  useEffect(() => {
    refresh()
    const removeSt = window.ipcRenderer.on('gemini:session-status', () => refresh())
    const removeOut = window.ipcRenderer.on('gemini:session-output', (_e: any, { id, line }: any) => {
      setLogs(prev => ({ ...prev, [id]: [...(prev[id] ?? []).slice(-99), line] }))
    })
    return () => { removeSt(); removeOut() }
  }, [refresh])

  const kill = async (id: string) => {
    await invoke('gemini:kill', id).catch(() => {})
    refresh()
  }

  const toggleExpand = async (id: string) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!logs[id]) {
      const r = await invoke<any>('gemini:get-log', id).catch(() => null)
      const text = unwrapIpc<string>(r) ?? ''
      setLogs(prev => ({ ...prev, [id]: text.split('\n').filter(Boolean).slice(-50) }))
    }
  }

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Gemini Sessions</span>
        <span className="text-[9px] text-zinc-700">{sessions.filter(s => s.status === 'running').length} running</span>
      </div>

      {sessions.length === 0 && (
        <p className="text-[10px] text-zinc-600">No sessions yet.</p>
      )}

      {sessions.map(s => (
        <div key={s.id} className="bg-black/30 border border-zinc-800 rounded overflow-hidden">
          <div
            className="flex items-center justify-between px-2 py-1.5 cursor-pointer hover:bg-zinc-900/50"
            onClick={() => toggleExpand(s.id)}
          >
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${
                s.status === 'running' ? 'bg-amber-400 animate-pulse' :
                s.status === 'complete' ? 'bg-green-400' : 'bg-red-400'
              }`} />
              <span className="text-[9px] font-mono text-zinc-500">{s.id.slice(0, 8)}</span>
              <span className="text-[9px] text-zinc-400">{s.storyIds.join(', ')}</span>
            </div>
            <div className="flex items-center gap-2">
              {s.status === 'running' && (
                <button onClick={e => { e.stopPropagation(); kill(s.id) }}
                  className="p-0.5 text-zinc-600 hover:text-red-400">
                  <Square size={10} />
                </button>
              )}
              {expanded === s.id ? <ChevronDown size={10} className="text-zinc-600" /> : <ChevronRight size={10} className="text-zinc-600" />}
            </div>
          </div>

          {expanded === s.id && (
            <div className="px-2 pb-2">
              <pre className="text-[8px] font-mono text-zinc-500 bg-black/40 rounded p-2 max-h-32 overflow-y-auto whitespace-pre-wrap">
                {(logs[s.id] ?? []).join('\n') || '(no output)'}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

Wire `<GeminiSessions />` into the Command Center view (wherever CommandCenter renders — add it as a section).

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
