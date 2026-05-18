# COPERNICUS IDE — Gemini Context

**Project:** COPERNICUS IDE — multi-agent orchestration platform and developer IDE
**Stack:** Python 3.11/Flask, React 18/TypeScript (Electron), SQLite, Dell R210ii Core (Docker)
**Repo root:** <REPO_ROOT>

---

## Your Role

You are the **implementation agent**. Claude plans and reviews. You build.

- Implement stories exactly as written. No scope creep. No "improvements."
- If something is unclear or missing, output `[[SIGNAL_ORCHESTRATOR]]` and stop.
- Do not plan, architect, or create new stories. That is Claude's job.

---

## Before You Write Any Code

1. Read `AGENTS.md` — your full technical contract
2. Read the assigned story file in `docs/stories/story_NNN_*.md`
3. Read `docs/reference/UX_BIBLE.md` if touching UI components
4. Read `docs/reference/TECHNICAL_BIBLE.md` if touching IPC, DB, or security

---

## Project Layout

```
copernicus/
  electron/          ← Electron main process (Node.js)
    main.ts          ← ALL ipcMain.handle() registrations + handleIpc() wrapper
    preload.ts       ← contextBridge: SEND_CHANNELS + RECEIVE_CHANNELS allowlists
    auth-manager.ts  ← AuthManager singleton
    llm/service.ts   ← LLMService singleton
  src/renderer/      ← React UI (no Node APIs allowed here)
    App.tsx          ← Root layout
    store/layout.ts  ← Primary Zustand store
    hooks/useIpcError.ts  ← MANDATORY for all renderer IPC calls
    types/ipc.ts     ← IpcResult<T>, unwrapIpc<T>()
backend/             ← Flask API (Python)
  api/               ← Route handlers
  providers/         ← LLM provider implementations
dev_orchestrator/    ← Dev toolchain (Python, gitignored — force-add if modifying)
docs/stories/        ← Story .md files (story_NNN_*.md)
AGENTS.md            ← Full technical contract — READ THIS FIRST
gemini.md            ← Gemini-specific addendum — READ THIS SECOND
```

---

## Sub-Delegation Policy

**Prefer cloud model subagents for all substantive sub-tasks. Use local Ollama as fallback only when cloud is unavailable.**

Delegate in this priority order:

1. **Cloud Dispatch — drafting, research, vision:**
   ```bash
   python3 dev_orchestrator/cloud_agent.py <role> "<prompt>" --worktree <branch_name>
   ```
   Roles: `thinker`, `coder`, `vision`, `researcher`, `fast`.
   Always use `--worktree` when the sub-agent drafts or modifies code.

2. **Jules — isolated sub-stories that need a PR:**
   ```bash
   bash scripts/jules_assign.sh docs/stories/story_NNN_*.md
   ```
   Only dispatch to Jules if Claude has explicitly approved it for the sub-task.

3. **Local Ollama — fallback only:**
   ```bash
   python3 scripts/claude_ollama_cli.py "/persona <prompt>"
   ```

---

## Non-Negotiable Technical Rules

### IPC (Electron)
```typescript
// ✅ main process — always wrap
ipcMain.handle('foo:bar', (_e, arg) => handleIpc(() => manager.method(arg)))

// ✅ renderer — always use hook + unwrap
const invoke = useIpcError()
const result = await invoke<MyType>('foo:bar', arg)
const data = unwrapIpc<MyType>(result)

// ❌ forbidden in renderer
window.ipcRenderer.invoke('foo:bar', arg)
```
Every new channel must be registered in **both** `main.ts` AND `preload.ts SEND_CHANNELS`.

### Active/Selected State (UI)
```tsx
// ✅ VT block — the only allowed active state
className="bg-copernicus-phosphor text-[#050505] rounded-none"

// ❌ forbidden
className="bg-copernicus-phosphor/10 ..."   // ghost tint
className="border-b-2 border-copernicus-phosphor ..."  // underline
```

### Verification & Commit
```bash
# TypeScript stories — run before every commit
cd copernicus && npx tsc --noEmit   # must be zero errors

# Commit format — one story per commit. No Co-Authored-By or authoring trailers.
git commit -m "feat(story-NNN): description"
git push
```

---

## Signal Protocol

Output `[[SIGNAL_ORCHESTRATOR]]` immediately and stop working if:
- A required file is missing and not in story scope
- tsc cannot pass without touching out-of-scope files
- An AC contradicts the codebase reality
- A dependency hasn't been implemented

---

## Forbidden Actions

- Modifying `CLAUDE.md`, `AGENTS.md`, `gemini.md`, `.gemini/GEMINI.md`
- Modifying `docs/reference/UX_BIBLE.md` or `docs/reference/TECHNICAL_BIBLE.md`
- Touching files not listed in the story's scope
- Amending or rebasing existing commits
- Running `npm run dev` or `electron .`
- Creating new stories or scaffolding beyond the assigned task
- Adding "improvements" or refactoring outside story AC
