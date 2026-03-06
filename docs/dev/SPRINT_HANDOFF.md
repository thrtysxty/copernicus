# Sprint Handoff — Gemini Autonomous Session
**Date:** 2026-03-06
**Prepared by:** Claude (orchestrator)
**For:** Gemini CLI autonomous implementation session
**Repo:** /Users/dadmin/Projects/agentic-platform
**Branch:** main (push directly — no PRs needed for this sprint)

---

## Current State

```
Last commit: 3c5af39 feat(story-237): GeminiSessionManager Python CLI in dev_orchestrator
Clean working tree
tsc --noEmit: PASSING
```

### Completed This Session (do NOT re-implement)
- Stories 180, 183, 186, 187, 188, 190, 196, 232 — committed and pushed
- Story 233 — DONE: `log_event()` writes to events table in copernicus.db (commit b4b0cd6)
- Story 237 — DONE: `dev_orchestrator/gemini_session_manager.py` implemented (commit 3c5af39)
- Story 181 (Quick Tour) — VERIFIED COMPLETE by researcher

### Remaining (your tasks for this session)
- Story 181 — housekeeping close only (no code changes — just move the file)
- Story 228 — accept/reject chip UI (ChatPanel.tsx + main.ts + preload.ts)
- Story 214 — token validation + disconnect (SettingsPanel.tsx + main.ts + auth-manager.ts)

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

### TASK 1 — Close Story 181 *(2 minutes)*

Story 181 is fully implemented. Housekeeping only — no code changes:

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
(search for `OllamaCloud` or `ollama_cloud` to find the section)

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

## Closing Instructions

After all tasks complete:
1. Run `cd copernicus && npx tsc --noEmit` one final time
2. Run `git log --oneline -8` to confirm all commits are pushed
3. Move completed story files:
   ```bash
   sed -i '' 's/^status:.*/status: COMPLETE/' docs/stories/story_{214,228,233,237}*.md
   mv docs/stories/story_{214,228,233,237}*.md docs/stories/completed/
   git add docs/stories/ && git commit -m "chore: close sprint stories 214 228 233 237" && git push
   ```

---

## Dispatch Pattern (for reference)

To spawn a Gemini session and track it:
```bash
python3 dev_orchestrator/gemini_session_manager.py spawn "$(cat /tmp/prompt.md)" --stories 228 214
```
Run with `run_in_background: true` on the Bash tool (no `&` needed — the tool handles it).
On completion: `list` and `tail <id>` to inspect output.

---

## DO NOT TOUCH
- `copernicus/electron/workflow/engine.ts` (Story 187 just completed — stable)
- `copernicus/electron/codebase-indexer.ts` (Story 219 — stable)
- `backend/api/agents.py` (Story 223 — stable)
- `dev_orchestrator/cloud_agent.py` (Story 233 just completed — stable)
- `dev_orchestrator/gemini_session_manager.py` (Story 237 just completed — stable)
- `docs/stories/completed/` — do not modify completed stories
- Do not amend or rebase existing commits
