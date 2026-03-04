# COPERNICUS IDE — Technical Implementation Bible
**Version:** 1.0 | **Date:** 2026-03-01 | **Authority:** Architect

This document is the authoritative specification for every technical pattern
used in COPERNICUS IDE. All agents (Claude, Gemini, Jules) implementing any
story must read and comply with this document. Non-compliance is a blocking
defect at code review.

---

## 0. The 80% Rule — Mandatory Pre-Implementation Protocol

**Before writing a single line of code, every agent must:**

1. Read ALL files that the story says will be modified
2. Read ALL files imported by those files (one level deep)
3. Read the relevant section of this TECHNICAL_BIBLE
4. Read the relevant section of UX_BIBLE (if touching UI)
5. Confirm the complete list of changes with the expected diff before starting

**Time allocation:** 80% research/planning, 20% implementation.

If you cannot answer ALL of the following before writing code, keep reading:
- What exact functions/methods will I add or change?
- What exact types/interfaces will I add or change?
- Which other files import the types I am changing?
- What IPC channels does this story add or modify?
- Does any change require a migration guard?

This is not optional. The code review has repeatedly caught agents who started
writing before understanding the existing code. The cost of reading is zero.
The cost of a wrong type change cascading across 13 files is a hotfix story.

---

## 1. Process Architecture

```
Electron Main Process (Node.js)
├── main.ts              — Entry point, all ipcMain.handle registrations
├── preload.ts           — contextBridge allowlist (SEND_CHANNELS + RECEIVE_CHANNELS)
├── auth-manager.ts      — AuthManager singleton
├── fs-manager.ts        — FSManager singleton
├── pty-manager.ts       — PTYManager singleton
├── stories.ts           — StoriesManager singleton
├── github-manager.ts    — GithubManager singleton
├── settings-store.ts    — SettingsStore singleton
├── devtime-manager.ts   — DevtimeManager singleton
├── touch-bar.ts         — Touch Bar builder
├── lsp/lsp-manager.ts   — LspManager singleton (Story 176)
├── workflow/
│   ├── engine.ts        — WorkflowEngine singleton
│   ├── types.ts         — WFNode, WFEdge, WorkflowGraph, NodeData interfaces
│   ├── states.ts        — VALID_TRANSITIONS state machine
│   └── templates.ts     — WORKFLOW_TEMPLATES
├── llm/service.ts       — LLMService
├── models/model-registry.ts — ModelRegistry singleton
├── db/
│   ├── schema.ts        — Database schema (tables, migrations)
│   └── state-ledger.ts  — StateLedger singleton
└── security/index.ts    — SecurityManager IPC registrations

Renderer Process (React/TypeScript — NO Node.js APIs)
├── App.tsx              — Root component, layout, useEffect listeners
├── store/layout.ts      — Zustand store (persisted)
├── components/          — Feature components
└── types/ipc.ts         — IpcResult<T>, unwrapIpc<T>
```

**Hard rule:** The renderer has **zero** access to Node.js APIs. Everything
goes through IPC. There is no `require('fs')` in renderer code. Ever.

---

## 2. IPC Standards — Non-Negotiable

### 2.1 Main Process: Every handler uses `handleIpc()`

```typescript
// ✅ Correct — every ipcMain.handle uses handleIpc()
ipcMain.handle('foo:bar', (_e, arg) => handleIpc(() => someManager.doThing(arg)))

// ❌ Wrong — raw throw arrives at renderer as unreadable Electron error string
ipcMain.handle('foo:bar', (_e, arg) => someManager.doThing(arg))

// ❌ Wrong — custom try/catch with non-standard error shape
ipcMain.handle('foo:bar', async (_e, arg) => {
  try { return await someManager.doThing(arg) }
  catch (err) { return { error: String(err) } }  // wrong envelope
})
```

`handleIpc()` is defined once in `main.ts`. There is exactly one definition.
The file `copernicus/electron/utils/ipc-handler.ts` is deleted (Story 178) —
do not import from it.

**`handleIpc` signature:**
```typescript
async function handleIpc<T>(fn: () => T | Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: string }>
```

### 2.2 Renderer: Every invoke uses `useIpcError` hook

```typescript
// ✅ Correct
const invoke = useIpcError()
const result = await invoke<MyType>('foo:bar', arg)

// ❌ Wrong — errors silently swallowed, no type safety
await window.ipcRenderer.invoke('foo:bar', arg)
await (window as any).ipcRenderer.invoke('foo:bar', arg)
```

**Exception:** `ipcRenderer.on()` (push channel listeners) may use
`window.ipcRenderer.on` directly — they are not invoke calls and are not
wrapped by `handleIpc`. They MUST be cleaned up in the useEffect return:

```typescript
useEffect(() => {
  const handler = (_e: any, data: MyPush) => { ... }
  window.ipcRenderer.on('foo:push', handler)
  return () => { window.ipcRenderer.removeListener('foo:push', handler) }
}, [deps])
```

Missing cleanup on push listeners is a memory leak and will cause duplicate
handlers after hot reload.

### 2.3 Envelope Unwrapping

`handleIpc()` wraps return values in `{ ok: true, data: T }`. The `useIpcError`
hook passes this through as-is. Components must unwrap:

```typescript
// ✅ Correct — use the shared utility
import { unwrapIpc } from '../../types/ipc'
const result = await invoke<MyType>('foo:bar', arg)
const data = unwrapIpc<MyType>(result)

// ✅ Also acceptable inline
const raw = await invoke<any>('foo:bar', arg)
const data = (raw as any)?.data ?? raw

// ❌ Wrong — treats the envelope object itself as the data
const result = await invoke<MyType>('foo:bar', arg)
setItems(result)  // result is { ok: true, data: MyType[] }, not MyType[]
```

`unwrapIpc<T>` is in `copernicus/src/renderer/types/ipc.ts`:
```typescript
export function unwrapIpc<T>(result: unknown): T {
  return ((result as any)?.data ?? result) as T
}
```

### 2.4 Channel Registry

All channels must be registered in `preload.ts` before they can be used.

- **`INVOKE_CHANNELS`** — channels used with `.invoke()` (renderer → main, awaits response)
- **`SEND_CHANNELS`** — channels used with `.send()` from main to renderer (push, no response)

Channels in neither list are blocked by contextBridge and will silently fail.

**Before adding a new IPC channel:**
1. Add to the correct list in `preload.ts`
2. Register `ipcMain.handle()` in `main.ts` with `handleIpc()`
3. Verify the channel name is unique (grep for it)

---

## 3. Store Architecture

### 3.1 Layout Store (`copernicus/src/renderer/store/layout.ts`)

The single persisted Zustand store. Uses `persist` middleware with
`name: 'copernicus-layout-storage'`. All state is persisted to localStorage
unless explicitly excluded.

**State categories:**
```typescript
// View / navigation
activeView: StoryboardView
spotlightPane: PaneId | null
isFlipped: { sidebar: boolean; chat: boolean }
settingsOpen: boolean

// Kanban
columns: KanbanColumn[]          // 9 DEFAULT_COLUMNS, migrated on mount
activeStoryId: string | null     // null by default — NEVER hardcode a story ID
drawerStoryId: string | null

// Editor
centerMode: CenterMode           // 'code' | 'image' | 'binary' | 'preview' | 'builder'
activeFilePath: string | null
activeFileContent: string
activeFileLanguage: string

// Workflow
activeWorkflowTemplate: string | null

// Terminal
terminalOpen: boolean
activeTerminalId: string
terminals: TerminalSession[]

// Appearance
phosphorColor: PhosphorColor
fontSize: number
uiDensity: 'normal' | 'compact'
animationsEnabled: boolean

// Telemetry
capexTotal: number
reviewEnabled: boolean
```

**Rules:**
- `activeStoryId` initial value is `null` — never `'STORY_089'` or any hardcoded ID
- `columns` must always have length ≥ 9. The migration guard in KanbanBoard runs
  on mount: if `columns.length < 9`, reset to `DEFAULT_COLUMNS`.
- Do NOT add new top-level state to the layout store for every feature. If the
  state is local to a component (not shared), use `useState`.

### 3.2 When to use store vs. local state

| Use store | Use local state |
|---|---|
| Shared between ≥ 2 components | Only used by one component |
| Persisted across sessions | Ephemeral (search query, input value) |
| Drives routing/view changes | UI-only feedback (loading spinner) |

---

## 4. Manager Singleton Pattern

Every Electron-side service is a class exported as a singleton:

```typescript
export class FooManager {
  // ... methods
}
export const fooManager = new FooManager()
```

### 4.1 FSManager — Tilde Expansion (Story 211)
All file paths passed to `fsManager` methods MUST support tilde expansion (`~`) for the user's home directory. This is handled internally by `fsManager.resolvePath(path)`.

**Rule:** Never manually expand tildes in the renderer. Pass the raw string from inputs; the manager will resolve it.

---

## 5. Agent Tool Execution — The Ollama Shim (Mandatory)

As of March 2026, all agentic tool execution (file operations, RAG search, MCP calls) MUST be routed through the **Ollama Tool Shim** (`scripts/ollama_tool_shim.py`).

### 5.1 Protocol
1.  **Gateway:** Agents do not call `fs:read-file` or `codebase:search` directly if they are executing a task. They call the shim.
2.  **Hybrid Orchestration:**
    *   **High-Intel:** Cloud-hosted models (via `OLLAMA_CLOUD_HOST`) are used for planning and complex logic.
    *   **Tactical:** Local sidekick (Ollama on 192.168.1.185) is used for quick completions and formatting.
3.  **Strict Execution:** The shim enforces the "Industrial Sub-agent" persona, preventing conversational filler and ensuring JSON-only tool outputs.

---

## 6. LSP Guardrail — Mandatory for All Agents

As of Story 176, the workspace runs `typescript-language-server`. Every agent
that writes or edits TypeScript files MUST follow this protocol:

### 5.1 After writing any TypeScript file

Immediately after every file write, call `lsp:check-file`:

```typescript
const check = await invoke('lsp:check-file', {
  uri: `file://${absoluteFilePath}`,
  content: fileContent,
})
const errors = unwrapIpc<{ uri: string; diagnostics: any[] }>(check)
  .diagnostics.filter((d: any) => d.severity === 1)

if (errors.length > 0) {
  // READ the errors, understand the cascade, FIX the affected files
  // Do NOT proceed to the next file until this file's errors resolve
  // Do NOT declare the task complete with open errors
}
```

Severity scale: `1 = Error`, `2 = Warning`, `3 = Info`, `4 = Hint`

Only `severity === 1` (Error) blocks completion. Warnings are advisory.

### 5.2 Before declaring the task complete

Call `lsp:workspace-check` and confirm `errorCount === 0`:

```typescript
const wsCheck = await invoke('lsp:workspace-check')
const { errorCount, files } = unwrapIpc<WorkspaceCheckResult>(wsCheck)

if (errorCount > 0) {
  // files contains { uri, diagnostics[] } for every file with errors
  // Fix ALL errors before marking done
}
```

### 5.3 Why this matters

A single interface field rename in `types.ts` cascades type errors into every
file that imports it. Without `lsp:workspace-check`, the agent finishes and
reports success while the workspace has broken TypeScript. The next developer
(or CI) will hit the errors. This guardrail catches them at write time.

### 5.4 LSP Guardrail is advisory when LSP is unavailable

If the LSP server is not running (e.g., no workspace set), both IPC channels
return empty results. The agent must not be blocked by LSP downtime. The
guardrail is a best-effort check, not a hard blocker on the file write itself.

---

## 6. File Write Protocol

Any time an agent (or the user via Monaco) writes a TypeScript/JavaScript file:

1. Call `invoke('fs:save-file', { path, content })`
2. The `fs:save-file` handler internally calls `lspManager.notifyFileChanged(uri, content)`
3. The LSP updates its type-graph
4. Agent calls `lsp:check-file` to verify no errors introduced
5. `textDocument/publishDiagnostics` push is forwarded to renderer → Monaco markers update

The sequence is automatic for steps 2–3 (main.ts wires it). Steps 4–5 are the
agent's responsibility.

---

## 7. Database Conventions

### 7.1 Schema location

All table definitions live in `copernicus/electron/db/schema.ts`. Every table
referenced in any manager MUST exist in schema.ts.

### 7.2 Migration pattern

When adding a column to an existing table, use `ALTER TABLE ADD COLUMN` wrapped
in try/catch (SQLite does not support `ADD COLUMN IF NOT EXISTS`):

```typescript
try {
  db.exec(`ALTER TABLE my_table ADD COLUMN new_col TEXT DEFAULT ''`)
} catch (_) {
  // Column already exists — ignore
}
```

Never drop and recreate a table for a migration. Users have data.

### 7.3 Naming conventions

- Tables: `snake_case` plural (e.g., `model_calls`, `jules_sessions`)
- Columns: `snake_case` (e.g., `created_at`, `story_id`)
- Primary keys: `id INTEGER PRIMARY KEY AUTOINCREMENT` unless UUID is required

---

## 8. Agent Dispatch Protocol

### 8.1 Roles

| Agent | Role | Scope |
|---|---|---|
| **Claude (Architect)** | Plans, governs, writes stories | Produces story `.md` files with exact ACs. Does NOT implement. |
| **Claude (Implementer)** | Implements stories assigned to Claude | Reads story + this bible + UX bible before writing code |
| **Gemini** | Implements stories assigned to Gemini | Same reading requirement. Follows AC spec exactly. |
| **Jules** | Async PR-based implementation | Reads `AGENTS.md` automatically. Follows the prompt extracted from story ACs. |

### 8.2 Story Specification Standards

When the Architect writes a story, every AC must specify:

1. **Exact file path** — `copernicus/src/renderer/components/KanbanBoard.tsx`
2. **Exact function/method name** — `rotateColumn(id: string): void`
3. **Exact type signature** — full TypeScript interface if new types are added
4. **Exact store actions** — which Zustand actions to call, not "update the store"
5. **Exact IPC channel** — if new, includes preload registration requirement
6. **Files NOT to modify** — explicit exclusion list prevents scope creep

**Vague ACs are rejected.** An AC that says "update the header" without
specifying which element, which file, which line range, and what the result
looks like — is incomplete and must be rewritten before dispatch.

### 8.3 Agent Boundaries

**Claude → Gemini handoff:**
- Claude delivers: complete story `.md` with exact AC spec, relevant file reads, type signatures, IPC channel list
- Gemini receives: story only. Gemini reads the referenced files independently (80% rule).
- Gemini must NOT: refactor code not mentioned in the story, rename variables for style, add features not in ACs, change file structure

**Claude → Jules handoff:**
- Jules receives a deterministic prompt derived from story ACs (via `jules:dispatch-session`)
- Jules reads `AGENTS.md` from repo root automatically
- Jules creates a PR — the PR must pass `npx tsc --noEmit` before it is reviewed
- Jules must NOT be given ambiguous prompts ("improve X") — only concrete, testable ACs

**Gemini/Jules → Claude handoff (code review):**
- Code review checks: ACs met, no forbidden patterns, tsc clean, LSP workspace-check passes
- Code review does NOT fix bugs — it rejects the PR and sends it back

### 8.4 Dispatch Deduplication

Before dispatching a story to Jules:
1. Check `jules_sessions` table for existing session with same `story_id` and status `pending` or `running`
2. If found: return existing session, do not create a new one
3. `prompt_hash` (SHA-1 of AC body) prevents re-dispatch of identical prompts

### 8.5 Pre-Implementation Checklist (agent self-check)

Before writing any code, the implementing agent must be able to answer YES to all:

- [ ] I have read every file the story says I will modify
- [ ] I have read every file that imports types I will change
- [ ] I know the exact line numbers where I will insert/replace code
- [ ] I have verified the IPC channels I need exist in `preload.ts`
- [ ] I know which `handleIpc()` wrapper I will use (main.ts version)
- [ ] I have confirmed `activeStoryId` initial state is `null`, not a hardcoded ID
- [ ] I will call `lsp:check-file` after every TypeScript file write
- [ ] I will call `lsp:workspace-check` before declaring done
- [ ] I have read the relevant UX_BIBLE section for any UI changes

---

## 9. Forbidden Patterns — Complete List

The following patterns are **blocking defects** at code review. Any PR
containing them will be rejected without further review.

### 9.1 IPC

```typescript
// ❌ Raw ipcRenderer.invoke — forbidden in renderer
await window.ipcRenderer.invoke('foo:bar', arg)
await (window as any).ipcRenderer.invoke('foo:bar', arg)

// ❌ ipcMain.handle without handleIpc — forbidden in main
ipcMain.handle('foo:bar', (_e, arg) => someManager.doThing(arg))

// ❌ Custom try/catch with non-standard error envelope
ipcMain.handle('foo:bar', async () => {
  try { ... } catch (e) { return { error: String(e) } }
})

// ❌ Missing preload registration — channel will be blocked by contextBridge
// (any channel not in INVOKE_CHANNELS or SEND_CHANNELS)
```

### 9.2 Renderer patterns

```typescript
// ❌ Hardcoded initial story ID
activeStoryId: 'STORY_089'  // must be null

// ❌ Hardcoded props instead of store values
<CenterPanelRouter filePath={null} content="" language="typescript" />

// ❌ No-op onClick handler for a button that exists
onClick={() => {}}

// ❌ Inline placeholder text in production JSX
<div>CANVAS_PREVIEW_ACTIVE</div>
<div>TODO: implement</div>

// ❌ Duplicate useEffect fetching same data
useEffect(() => { invoke('settings:load').then(setRate) }, [])  // x2

// ❌ Array index as React key when array can reorder
items.map((item, i) => <Row key={i} />)  // use item.id

// ❌ overflow-hidden max-w-0 inside overflow-hidden parent for hover reveal
// (clips pointer events — use opacity-0/100 instead)
<div className="overflow-hidden max-w-0 group-hover/X:max-w-[50px]">
  <button>...</button>  // unreachable via click
</div>
```

### 9.3 Main process patterns

```typescript
// ❌ Runtime require() instead of top-level import
function doThing() {
  const { ptyManager } = require('./pty-manager')  // wrong
}

// ❌ Two implementations of handleIpc
// There is ONE handleIpc in main.ts. Do not create another in utils/.

// ❌ Dead code: exported singleton never imported elsewhere
// (InteropDispatcher was the example — deleted in Story 178)

// ❌ registerHandlers() method defined but never called
// Either call it from main.ts or delete it

// ❌ ALTER TABLE without try/catch migration guard
db.exec('ALTER TABLE foo ADD COLUMN bar TEXT')  // will throw if column exists
```

### 9.4 CSS / Tailwind

```typescript
// ❌ Non-existent Tailwind class
className="vertical-text"   // does not exist — use inline style

// ❌ Header without stoplight clearance
<header className="flex ...">  // must include pl-20 on macOS

// ❌ rotateY / 3D CSS on panels containing <webview>
className="rotateY-180"  // webview punches through 3D transforms

// ❌ Missing transition on interactive elements
<button className="hover:bg-white/10">  // must include transition-colors
```

### 9.5 TypeScript

```typescript
// ❌ any cast to work around type error without understanding root cause
const data = (res as any).whatever

// ❌ @ts-ignore or @ts-expect-error without explanation comment

// ❌ eslint-disable without explanation
// eslint-disable-next-line react-hooks/exhaustive-deps  ← requires comment
```

---

## 10. Performance Scope

### Pi 3B+ constraints apply ONLY to:
- `src/agentic/` — Python orchestration CLI
- `backend/` — Flask API handlers
- `scripts/` — CLI utilities

### Explicitly exempt (desktop Electron, GPU-accelerated):
- `copernicus/src/renderer/components/workflow/WorkflowCanvas.tsx`
- `copernicus/src/renderer/components/Editor/UICanvas.tsx` and `ui-builder/UIBuilderCanvas.tsx`
- `copernicus/src/renderer/components/capex/` (all charts and reports)
- Any component using `<canvas>`, WebGL, SVG animation, or `requestAnimationFrame`

Do not apply bundle size warnings, animation limits, or re-render budgets to
exempt paths. Optimize for desktop UX.

---

## 11. Story File Format

All stories live in `docs/stories/`. Scaffold with:
```bash
python3 scripts/utils/scaffold_story.py "Story Title"
```

Required sections:

```markdown
# Story NNN: Title

**Status:** DRAFT | APPROVED FOR IMPLEMENTATION | IN PROGRESS | REVIEW | COMPLETE
**Priority:** P0 | P1 | P2 | P3
**Epic:** 004 — COPERNICUS IDE
**Authored By:** /architect
**Assigned To:** —
**Blocked By:** —
**Blocks:** —
**Date:** YYYY-MM-DD

## Narrative
As a [user], I want [feature], so that [value].

## Context
[Background, root cause, what currently exists]

## Acceptance Criteria

### AC-1 — [Short title]
**File:** `exact/path/to/file.ts`

[Exact description with code snippets for all non-trivial changes]

### AC-N...

## Files to Modify
| File | Change |
|------|--------|

## Files NOT to Modify
[Explicit exclusion list]

## Forbidden Patterns
[Story-specific additions to the global list]

## Blocks
— (or story numbers)

## Blocked By
— (or story numbers)

## Documentation Impact
[Files to update]

## Definition of Done
[Measurable, binary checklist — must include tsc --noEmit and LSP check]
```

**Story completeness gates (architect must verify before APPROVED):**
- Every AC names an exact file path
- Every AC includes code snippets for non-trivial changes
- "Files NOT to Modify" section is present and non-empty
- Definition of Done includes `npx tsc --noEmit` passes
- Definition of Done includes `lsp:workspace-check errorCount === 0` (for TS stories)

---

## 12. Pre-Commit Checklist

Before any commit on any branch:

- [ ] `cd copernicus && npx tsc --noEmit` — zero errors
- [ ] `lsp:workspace-check` — `errorCount === 0`
- [ ] No `console.log` added (use `console.error` or `console.warn` with context)
- [ ] No `// TODO` or `// FIXME` in new code
- [ ] No placeholder text in JSX (`CANVAS_PREVIEW_ACTIVE`, etc.)
- [ ] All new IPC channels registered in `preload.ts`
- [ ] All new `ipcMain.handle` calls use `handleIpc()`
- [ ] All new renderer invoke calls use `useIpcError` hook
- [ ] No new `activeStoryId: 'STORY_XXX'` hardcoded strings
- [ ] New buttons have real `onClick` handlers, not `() => {}`
- [ ] Hover-reveal buttons use `opacity-0/100` pattern, not `max-w-0/overflow-hidden`
- [ ] Push listener `useEffect` returns cleanup that calls `removeListener`
- [ ] `BACKLOG.md` regenerated: `python3 scripts/utils/generate_backlog.py`

---

## 13. Code Review Criteria

Code review (whether Claude, human, or automated) checks ONLY the following:

1. **ACs met** — every AC in the story is demonstrably implemented
2. **Forbidden patterns absent** — grep for patterns in §9
3. **TypeScript clean** — `tsc --noEmit` passes with zero errors
4. **LSP clean** — `lsp:workspace-check` returns `errorCount === 0`
5. **No scope creep** — only files listed in "Files to Modify" are changed
6. **No dead code introduced** — no new exported symbols that are never imported
7. **No regression** — files in "Files NOT to Modify" are unchanged

Code review does **not** fix bugs. It rejects and returns to implementer.
A rejection must include: which AC failed, which line, what the correct
behavior should be. No vague rejections.

---

## 14. IPC Channel Reference

### INVOKE_CHANNELS (renderer → main, awaited)

| Channel | Handler | Description |
|---|---|---|
| `app:get-user-guide` | main.ts | Returns user guide text |
| `app:set-root-path` | main.ts | Sets workspace root |
| `app:open-external` | main.ts | Opens URL in system browser |
| `auth:status` | main.ts | Returns `AuthConfig[]` |
| `auth:get-api-key` | main.ts | Returns decrypted API key |
| `auth:resolve-openai-config` | main.ts | Returns OpenAI-compat config |
| `models:list` | main.ts | Returns all registered models |
| `models:active` | main.ts | Returns active model |
| `models:set-active` | main.ts | Sets active model |
| `models:list-ollama` | main.ts | Lists Ollama models |
| `stories:list` | main.ts | Returns all stories |
| `stories:create` | main.ts | Creates a new story |
| `stories:set-field` | main.ts | Updates a story field |
| `stories:update` | main.ts | Full story update |
| `stories:hydrate` | main.ts | Reads story markdown |
| `stories:is-repo-targeted` | main.ts | Returns boolean |
| `story:scaffold` | main.ts | Scaffolds story file |
| `fs:read-file` | main.ts | Reads file content |
| `fs:save-file` | main.ts | Writes file + notifies LSP |
| `fs:list-dir` | main.ts | Lists directory |
| `fs:open-file` | main.ts | Native file picker |
| `chat:send` | main.ts | Sends LLM message |
| `db:log-event` | main.ts | Logs event to DB |
| `db:get-events` | main.ts | Gets events from DB |
| `db:add-memory` | main.ts | Adds memory entry |
| `db:search-memory` | main.ts | Searches memories |
| `db:log-intent` | main.ts | Logs intent |
| `db:get-intents` | main.ts | Gets intents |
| `ledger:stats-update` | main.ts | Returns session stats |
| `ledger:session-stats` | main.ts | Session statistics |
| `ledger:recent-calls` | main.ts | Recent model calls |
| `ledger:all-time-cost` | main.ts | Lifetime cost |
| `makefile:list` | main.ts | Lists Makefile targets |
| `makefile:run` | main.ts | Runs a make target |
| `terminal:spawn-agent` | main.ts | Spawns agent terminal |
| `workflow:run` | main.ts | Runs a workflow |
| `workflow:status` | main.ts | Returns workflow status |
| `workflow:reset` | main.ts | Resets workflow |
| `workflow:list-templates` | main.ts | Lists templates |
| `workflow:get-template` | main.ts | Gets a template |
| `workflow:ollama-status` | main.ts | Ollama reachability |
| `lsp:status` | main.ts | LSP server status |
| `lsp:request` | main.ts | JSON-RPC request to LSP |
| `lsp:notify` | main.ts | JSON-RPC notification |
| `lsp:check-file` | main.ts | Per-file diagnostic pull |
| `lsp:workspace-check` | main.ts | Full workspace diagnostics |
| `settings:load` | main.ts | Loads all settings |
| `settings:set` | main.ts | Sets a setting value |
| `github:list-repos` | main.ts | Lists GitHub repos |
| `github:create-repo` | main.ts | Creates GitHub repo |
| `github:user` | main.ts | GitHub user info |
| `jules:dispatch-session` | main.ts | Dispatches story to Jules |
| `jules:session-status` | main.ts | Jules session status |
| `security:get-env-allowlist` | main.ts | Gets env allowlist |
| `security:add-env-var` | main.ts | Adds env var |
| `security:remove-env-var` | main.ts | Removes env var |
| `security:get-sandbox-enabled` | main.ts | Sandbox status |
| `security:set-sandbox-enabled` | main.ts | Enables/disables sandbox |
| `canvas:execute-js` | main.ts | Executes JS in canvas |
| `canvas:send-input` | main.ts | Sends input to canvas |
| `browser:launch` | main.ts | Playwright launch |
| `browser:navigate` | main.ts | Playwright navigate |
| `browser:screenshot` | main.ts | Playwright screenshot |
| `browser:click` | main.ts | Playwright click |
| `browser:fill` | main.ts | Playwright fill |
| `browser:evaluate` | main.ts | Playwright evaluate |
| `browser:close` | main.ts | Playwright close |
| `env:get-versions` | main.ts | Returns runtime versions |
| `splash-ready` | main.ts | Splash screen signal |

### SEND_CHANNELS / RECEIVE_CHANNELS (main → renderer, push)

| Channel | Description |
|---|---|
| `lsp:diagnostics` | LSP publishDiagnostics push |
| `ledger:stats-update` | Token/cost push after model call |
| `app:workspace-changed` | Workspace root changed |
| `app:critical-error` | Critical error notification |
| `terminal-incoming` | PTY data from main |
| `terminal:spawn` | New terminal tab created |
| `terminal:remove` | Terminal tab closed |
| `terminal:set-busy` | Terminal busy state |
| `terminal-closed` | Terminal process exited |
| `terminal-blocked` | GitGuard blocked command |
| `terminal:activate-tab` | Focus a terminal tab |
| `chat:token` | Streaming token from LLM |
| `chat:done` | Stream complete |
| `chat:error` | Stream error |
| `workflow:status-update` | Workflow node state changed |
| `stories:updated` | Story list changed |
| `jules:session-update` | Jules session status changed |
| `telemetry:update-touchbar` | Touch Bar telemetry push |
| `layout:set-view` | Touch Bar → set active view |
| `layout:toggle-flip` | Touch Bar → flip panel |
| `layout:toggle-spotlight` | Touch Bar → toggle spotlight |
| `layout:toggle-ui-builder` | Touch Bar → toggle UI builder |
| `layout:open-palette` | Open command palette |
| `security:alert` | Security threat detected |

**Any channel not in this table must be added to `preload.ts` before use.**

---

## 15. OAuth Authentication — Web Credential Flow

COPERNICUS uses **OAuth 2.0 PKCE** for all provider authentication.
No API keys are entered by the user. Precedent: Claude Code uses this same
flow for Anthropic auth today.

### Requirements (app registration, done once per provider)

| Provider | OAuth Client Type | Redirect URI |
|---|---|---|
| Anthropic | Public client (PKCE, no secret) | `copernicus://auth/anthropic/callback` |
| Google | Public client (PKCE, no secret) | `copernicus://auth/google/callback` |

Client IDs are **bundled in the app** — not entered by the user, not stored
in settings. No client secrets.

### Custom Protocol Handler

```typescript
// main.ts — register on app ready
app.setAsDefaultProtocolClient('copernicus')

// Handle the OAuth callback redirect
app.on('open-url', (_event, url) => {
  if (url.startsWith('copernicus://auth/')) {
    authManager.handleOAuthCallback(url)
  }
})
```

### Flow

1. User clicks "Sign in with Claude / Google" in wizard
2. App constructs OAuth URL with PKCE code challenge + `copernicus://` redirect
3. `shell.openExternal(oauthUrl)` — opens system browser
4. User authenticates in browser
5. Provider redirects to `copernicus://auth/<provider>/callback?code=...`
6. macOS routes the custom URL to the running COPERNICUS process
7. `authManager.handleOAuthCallback()` exchanges code for access + refresh tokens
8. Tokens stored via `safeStorage.encryptString()` — never written to disk in plaintext

### Token Refresh

Tokens are refreshed silently on expiry. If refresh fails (session revoked),
`auth:status` returns `authenticated: false` and the renderer shows a
re-auth prompt via `useIpcError`.

### `auth:get-api-key` deprecation note

The existing `auth:get-api-key` IPC channel returns the stored access token
for OAuth providers — the name is legacy. Treat the return value as an
opaque bearer token, not necessarily an API key string.

### Forbidden

- Storing tokens in `localStorage`, `sessionStorage`, or any renderer-accessible store
- Prompting the user for an API key for Anthropic or Google
- Hardcoding tokens or client secrets anywhere in the codebase
- Using `BrowserWindow` / webview to embed the OAuth login page
  (Google blocks embedded OAuth; use `shell.openExternal` only)
