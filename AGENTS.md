# AGENTS.md — COPERNICUS IDE
**Read this entire file before writing a single line of code.**
**Jules: this file is your primary contract. Deviating from it causes PR rejection.**

---

## Role Boundaries — ENFORCED

Gemini's role is **Implement exactly what the story says**. Not plan. Not architect. Not expand scope.

### What Gemini DOES
- Reads the assigned story file completely before touching any code
- Implements the AC items listed — no more, no fewer
- Runs `cd copernicus && npx tsc --noEmit` before every commit
- Commits with the exact format: `feat(story-NNN): description` — no `Co-Authored-By` or authoring trailers
- Pushes on completion and exits

### What Gemini MUST NOT DO
- Create new stories, modify existing stories, or change story status
- Modify `CLAUDE.md`, `AGENTS.md`, `docs/reference/UX_BIBLE.md`, or `docs/reference/TECHNICAL_BIBLE.md`
- Plan architecture, propose alternative approaches, or scope-creep beyond the story AC
- Refactor code outside the files listed in the story's **Files to Modify** section
- Add "nice to have" improvements, comments, or cleanup beyond the story scope
- Make decisions that require human judgment — use `[[SIGNAL_ORCHESTRATOR]]` instead

### When to Stop and Signal
If you hit any of these, output `[[SIGNAL_ORCHESTRATOR]]` and stop:
- A required file doesn't exist and isn't in the story's files-to-modify list
- tsc cannot be made to pass without touching files outside story scope
- A story AC is ambiguous or contradicts the codebase reality
- A dependency story hasn't been implemented yet

**Do not guess. Do not improvise. Signal and stop.**

---

## Context Handoff (Story 229)

**Handoff Context** allows an agent to inherit the research and context of a previous agent during a model switch.

### How to use Handoff Context
- When switching from another model (e.g. Claude -> Gemini), the system will automatically inject a `[HANDOFF CONTEXT]` block into your initial prompt.
- **NEVER** re-perform the same codebase search if its results are already present in the handoff context.
- **ALWAYS** reference prior search findings from the handoff context to maintain task continuity.
- This mechanism reduces API costs and improves execution speed by skipping redundant research phases.

---

## Mandatory Pre-Reads

Before implementing any story, read these documents in full:

| Document | Purpose |
|----------|---------|
| `docs/reference/UX_BIBLE.md` | Authoritative UX/UI spec: layouts, colors, interactions, component patterns |
| `docs/reference/TECHNICAL_BIBLE.md` | Authoritative technical spec: IPC, security, agent dispatch, DB patterns |

These documents override anything you think you know about "standard" React or Electron patterns.
If your implementation contradicts either Bible, you are wrong — not the Bible.

---

## Project Identity

COPERNICUS is a multi-pane Electron IDE built on React 18 + TypeScript.
- **Main process:** Node.js (Electron main) — in `copernicus/electron/`
- **Renderer:** React (no Node APIs) — in `copernicus/src/renderer/`
- **Database:** better-sqlite3 (main process only)
- **IPC:** contextBridge allowlist (see `preload.ts`)
- **State:** Zustand stores in `src/renderer/store/`

---

## Repository Layout

```
copernicus/
  electron/
    db/
      schema.ts            ← SQLite table definitions (CREATE TABLE IF NOT EXISTS)
      state-ledger.ts      ← StateLedger class (all DB access goes here)
    workflow/
      engine.ts            ← WorkflowEngine singleton (workflowEngine)
      types.ts             ← WFNode, WFEdge, WorkflowGraph, NodeData interfaces
      states.ts            ← VALID_TRANSITIONS state machine
      templates.ts         ← WORKFLOW_TEMPLATES
    llm/
      service.ts           ← LLMService singleton
    models/
      model-registry.ts    ← ModelRegistry singleton
    auth-manager.ts        ← AuthManager singleton
    fs-manager.ts          ← FSManager singleton
    pty-manager.ts         ← PTYManager singleton
    stories.ts             ← StoriesManager singleton
    github-manager.ts      ← GithubManager singleton
    lsp-manager.ts         ← LSPManager singleton (Story 176)
    main.ts                ← Entry point; ALL ipcMain.handle() registrations
    preload.ts             ← contextBridge; SEND_CHANNELS + RECEIVE_CHANNELS
  src/renderer/
    App.tsx                ← Root: activity bar, header nav, panel layout
    components/
      chat/ChatPanel.tsx   ← Chat + FlippablePanel back face
      planning/
        KanbanBoard.tsx    ← Kanban board (columns + cards)
        StoryDetail.tsx    ← Story Drawer (opens on card click)
      Editor/
        MonacoEditor.tsx   ← Monaco code editor
        CenterPanelRouter.tsx ← Routes centerMode to correct view
      command/
        CommandCenter.tsx  ← Command Center view (Story 184)
      workflow/
        WorkflowCanvas.tsx ← SVG workflow canvas
      capex/
        CapexDashboard.tsx ← CapEx reporting
      settings/
        Settings.tsx       ← Settings panel + tabs
      github/
        GithubDashboard.tsx ← GitHub management
    store/
      layout.ts            ← Primary Zustand store (layout, views, kanban state)
      commandStore.ts      ← Command Center data store (Story 184)
      agentStore.ts        ← Agent state
    hooks/
      useIpcError.ts       ← MANDATORY hook for all IPC calls in renderer
    types/
      ipc.ts               ← IpcResult<T> type
docs/
  stories/                 ← Story .md files (story_NNN_*.md)
  reference/
    UX_BIBLE.md            ← UX specification
    TECHNICAL_BIBLE.md     ← Technical specification
    USER_WORKFLOW.md       ← First-time user journey
AGENTS.md                  ← This file
CLAUDE.md                  ← Project config (read by Claude Code)
```

---

## Build & Verification Commands

```bash
# Type-check — run this before every commit
cd copernicus && npx tsc --noEmit

# Install dependencies (run once per environment)
cd copernicus && npm install

# Full build
cd copernicus && npm run build

# Run e2e tests
cd copernicus && npm test
```

**NEVER run `npm run dev` or `electron .` in a Jules task** — long-running
processes cause Jules tasks to time out. Type-check is sufficient for verification.

---

## IPC Contract — Non-Negotiable

### The Two-Sided Rule

Every IPC channel must be declared in **both** places or it silently fails:

| Side | File | Declaration |
|------|------|-------------|
| Main process | `copernicus/electron/main.ts` | `ipcMain.handle('channel:name', ...)` |
| Renderer allowlist | `copernicus/electron/preload.ts` | `'channel:name'` in `SEND_CHANNELS` Set |
| Push (main→renderer) | `copernicus/electron/preload.ts` | `'channel:name'` in `RECEIVE_CHANNELS` Set |

**Checklist before adding a new IPC channel:**
1. Add `ipcMain.handle('new:channel', (_e, arg) => handleIpc(() => ...))` in `main.ts`
2. Add `'new:channel'` to `SEND_CHANNELS` in `preload.ts`
3. Use `useIpcError()` in the renderer component — never bare `window.ipcRenderer.invoke`

### `handleIpc()` wrapper — MANDATORY on main process

```typescript
// ✅ Required — wraps errors into { ok: false, error: string }
ipcMain.handle('foo:bar', (_e, arg) =>
  handleIpc(() => manager.doThing(arg)))

// ❌ Forbidden — raw throws produce unreadable Electron error strings
ipcMain.handle('foo:bar', (_e, arg) => manager.doThing(arg))
```

### `useIpcError()` hook — MANDATORY in renderer

```typescript
// ✅ Required
const invoke = useIpcError()
const result = await invoke<MyType>('foo:bar', arg)

// ❌ Forbidden — errors silently swallowed
const result = await window.ipcRenderer.invoke('foo:bar', arg)
```

### IPC Result Envelope — ALWAYS check `result.ok`

`handleIpc()` returns `{ ok: boolean, data?: T, error?: string }`.
The renderer **must** unwrap this — do not treat the envelope as the data.
Use the `unwrapIpc<T>()` utility from `src/renderer/types/ipc.ts` for standardized unwrapping.

```typescript
// ✅ Correct
const result = await invoke<Story[]>('stories:list')
if (!result.ok) { toast(result.error); return }
const stories = unwrapIpc<Story[]>(result) // ← actual data
```

// ❌ Wrong — result IS the envelope, not the data
const stories = await invoke<Story[]>('stories:list')
stories.map(...)  // ← crashes: stories is { ok: true, data: [...] }
```

`useIpcError()` already handles the `!result.ok` case by throwing a toast.
You still need to access `result.data` for the value.

---

## Active IPC Channels (complete list)

### Renderer → Main (`SEND_CHANNELS`)

```
stories:list        stories:create      stories:update
stories:set-field   stories:hydrate     stories:is-repo-targeted
auth:status         auth:get-api-key    auth:resolve-openai-config
models:list         models:active       models:set-active
models:list-ollama  fs:read-file        fs:save-file
fs:list-dir         fs:open-file        chat:send
db:log-event        db:get-events       db:add-memory
db:search-memory    makefile:list       makefile:run
terminal:spawn-agent terminal:stop-agent settings:load
settings:save       git:branch          git:status
workflow:run        workflow:status     workflow:reset      workflow:list-templates
workflow:get-template workflow:ollama-status
lsp:open-file       lsp:close-file      lsp:get-diagnostics
lsp:check-file      lsp:workspace-check
snapshot:save       snapshot:restore
browser:launch      browser:navigate    browser:screenshot
browser:click       browser:fill        browser:evaluate
browser:close       canvas:execute-js   canvas:send-input
app:workspace-changed  app:get-user-guide  app:open-external
jules:dispatch      jules:session-status jules:list-sessions
gemini:spawn        gemini:send-prompt   gemini:close
gemini:status
```

### Main → Renderer pushes (`RECEIVE_CHANNELS`)

```
telemetry:update-touchbar   stories:updated
workflow:node-status        lsp:diagnostics-update
command:telemetry-update    gemini:output
```

**If you need a channel NOT in this list, add it to both `main.ts` AND `preload.ts`.**

---

## TypeScript Conventions

- `import type` for type-only imports
- Explicit return types on public methods
- `Record<string, any>` is acceptable only for `node.data` in workflow nodes
- No `require()` in renderer files — ESM `import` only
- All SQLite operations go through `StateLedger` methods — never `stateLedger.db.prepare()` directly
- New `StateLedger` methods → `state-ledger.ts`, new tables → `schema.ts`
- Component files: PascalCase. Hook files: camelCase with `use` prefix

---

## Electron Security Rules — HARD CONSTRAINTS

| Rule | Why |
|------|-----|
| `contextIsolation: true` — do not change | Security boundary |
| `nodeIntegration: false` — do not change | Security boundary |
| No `import 'electron'` in `src/renderer/` | Renderer cannot access Node |
| No `import 'fs'` in `src/renderer/` | Renderer cannot access Node |
| No `import 'path'` in `src/renderer/` | Renderer cannot access Node |
| All DB access in main process only | `better-sqlite3` is synchronous, crashes renderer |

---

## React + Zustand Conventions

### Layout Store (`store/layout.ts`)

The primary store for all view/panel/layout state. Key fields:

```typescript
// View navigation
activeView: 'planner' | 'editor' | 'designer' | 'orchestrator' | 'command-center' | 'memory'
centerMode: 'code' | 'canvas' | 'binary'
openFilePath: string | null

// Kanban
columns: KanbanColumn[]           // 9 lanes — do not hard-code column ids
spotlightLane: string | null      // card spotlight (Story 180)
setSpotlightLane: (id: string | null) => void

// Tour
hasCompletedTour: boolean         // Story 181
tourHighlight: string | null      // pulsing activity bar icon
setHasCompletedTour: () => void
setTourHighlight: (id: string | null) => void

// Story Drawer
drawerStory: Story | null
setDrawerStory: (s: Story | null) => void
spotlightPane: string | null      // editor/chat panel spotlight
setSpotlightPane: (id: string | null) => void
```

**Never put Command Center telemetry data in layoutStore** — that lives in `commandStore.ts`.

### Rules

- Components use `useLayoutStore(s => s.field)` — never destructure the full store
- New persistent fields: add to `LayoutState` interface + initial state + setter
- Tailwind only — no inline `style={{}}` except for dynamic values (transforms, CSS vars)

---

## Active/Selected State Style — VT Terminal Block (UX Bible §1.4)

All active/selected states use the VT terminal selection block — a solid
phosphor-colored rectangle:

```tsx
// ✅ Correct — VT block active state
className={active
  ? 'bg-copernicus-phosphor text-[#050505] rounded-none'   // §1.4 VT selection block
  : 'text-zinc-500 hover:text-zinc-300'}

// ❌ Wrong — ghost tint (forbidden)
className={active
  ? 'bg-copernicus-phosphor/10 text-copernicus-phosphor rounded'
  : ...}

// ❌ Wrong — underline (forbidden)
className={active
  ? 'border-b-2 border-copernicus-phosphor text-copernicus-phosphor'
  : ...}
```

`bg-copernicus-phosphor` uses `var(--phosphor)` CSS variable, so it responds
to the user's theme setting (green/amber/white/blue) automatically.

---

## Kanban Columns — Current 9 Lanes

**Do not hard-code column IDs.** The columns come from the layout store.
The current canonical set:

| id | status | label |
|----|--------|-------|
| `planning` | `PLANNING` | Planning |
| `storyboarding` | `STORYBOARDING` | Storyboarding |
| `sprint-planning` | `SPRINT_PLANNING` | Sprint Planning |
| `development` | `IN_PROGRESS` | Development |
| `testing` | `TESTING` | Testing |
| `qa` | `QA` | QA |
| `documenting` | `DOCUMENTING` | Documenting |
| `ready-to-build` | `READY` | Ready to Build |
| `done` | `COMPLETE` | Done |

`+New Story` button: **`ready-to-build` column only**.
Column buttons (rotate/minimize): **removed** — spotlight is card-driven.

---

## How to Add a New Activity Bar View

1. Add the view id to the `ActiveView` union type in `layout.ts`
2. Add a button in the Activity Bar in `App.tsx` (use VT block active style §1.4)
3. Add `aria-label` and `aria-current="page"` to the button (§ accessibility)
4. Add the route in `App.tsx` center area: `{activeView === 'your-view' && <YourView />}`
5. Create `copernicus/src/renderer/components/your-view/YourView.tsx`

---

## How to Add a New IPC Channel

1. Implement the handler in the relevant manager class
2. In `main.ts`: `ipcMain.handle('namespace:verb', (_e, arg) => handleIpc(() => manager.method(arg)))`
3. In `preload.ts`: add `'namespace:verb'` to `SEND_CHANNELS` Set
4. In the renderer: use `const invoke = useIpcError()` then `invoke<ReturnType>('namespace:verb', arg)`
5. Run `cd copernicus && npx tsc --noEmit` — zero errors required

---

## Canvas Center Panel Routing

`CenterPanelRouter` maps `centerMode` to a component:

| `centerMode` | Condition | Component |
|--------------|-----------|-----------|
| `'canvas'` | Playwright session active | `PlaywrightFrame` |
| `'canvas'` | Image file open (`.png .jpg .svg` etc.) | `ImageViewer` |
| `'canvas'` | Default (no file / UIBuilder) | `UIBuilderCanvas` |
| `'code'` | Code file open | `MonacoEditor` |
| `'binary'` | Binary file | `BinaryBlocker` |

Designer view always sets `centerMode: 'canvas'`.
`classifyFile()` returns `'canvas'` for image types, `'code'` for text/code, `'binary'` for everything else.

---

## FlippablePanel — Mode Prop (Story 182)

```tsx
<FlippablePanel
  mode="flip"    // default — rotateY for non-webview back faces
  // OR
  mode="slide"   // translateX — REQUIRED when back face contains <webview>
  isFlipped={isFlipped}
  front={<FrontFace />}
  back={<BackFace />}
/>
```

**Never use `mode="flip"` (rotateY) when the back face contains `<webview>`.**
Webview elements punch through CSS 3D perspective transforms.

---

## Forbidden Patterns

These patterns cause immediate PR rejection:

| Pattern | Why Forbidden | Correct Alternative |
|---------|---------------|---------------------|
| Multiple `handleIpc` implementations | Only one canonical version is allowed | Import from `main.ts` or shared util |
| `ipcMain.handle('x', () => manager.doThing())` | No handleIpc wrapper | `handleIpc(() => manager.doThing())` |
| `window.ipcRenderer.invoke('x', arg)` | Bypasses useIpcError | `const invoke = useIpcError(); invoke('x', arg)` |
| `result.data` without checking `result.ok` | Crashes on error | Check `if (!result.ok)` first |
| `bg-copernicus-phosphor/10` for active state | Ghost tint forbidden | `bg-copernicus-phosphor text-[#050505] rounded-none` |
| `border-b-2 border-copernicus-phosphor` active indicator | Underline forbidden | VT block (see above) |
| `rotateY` in FlippablePanel with webview back face | Webview punches through | Use `mode="slide"` |
| `setInterval` for polling | Creates stale state, memory leaks | Subscribe to IPC push events |
| `stateLedger.db.prepare(...)` outside StateLedger | DB logic leaks | Add method to `state-ledger.ts` |
| `import 'fs'` in renderer | Security violation | Use `fs:*` IPC channels |
| `console.log` in any file | Unstructured, not persisted | Use `electron-log` (Story 192) |
| Hard-coded column ids (blueprint, ui-design, staging) | Stale columns | Use `columns` from layout store |
| `toggleColumnMinimize` or `rotateColumn` | Removed in Story 180 | Use `setSpotlightLane` |
| New story button on any column except `ready-to-build` | UX violation | Check `col.id === 'ready-to-build'` |
| `(res as any)?.data ?? res` | Fragile, non-standard | Use `unwrapIpc<T>(res)` |
| `window.ipcRenderer.send(...)` | Not in allowlist | Use `invoke()` |
| Tour messages stored in chat history | Spec violation | Ephemeral GUIDE tab only |
| `useLayoutStore` for Command Center data | Wrong store | Use `useCommandStore` |
| `<webview>` without `partition="persist:<name>"` | Session not persisted | Add partition attribute |
| `fs.writeFileSync` on story `.md` files | Race condition | Use `writeFileAtomic()` |
| Hardcoded model IDs outside `model-registry.ts` | Breaks model switching | Import from registry |
| New IPC channel not in `preload.ts SEND_CHANNELS` | Channel silently fails | Always update both files |

---

## Common Bugs to Avoid

These are real bugs from past implementation cycles:

### 1. IPC envelope unwrapping
```typescript
// Bug: treating the envelope as the data
const stories = await invoke<Story[]>('stories:list')
stories.forEach(...)  // ← CRASHES: stories = { ok: true, data: [...] }

// Fix
const result = await invoke<Story[]>('stories:list')
result.data?.forEach(...)  // ← correct
```

### 2. Missing SEND_CHANNELS entry
```typescript
// Bug: handler in main.ts but channel missing from preload.ts SEND_CHANNELS
// Result: renderer call silently returns undefined, no error thrown
// Fix: always grep preload.ts after adding a handler
```

### 3. rotateColumn / toggleColumnMinimize removed
```typescript
// Bug: calling rotateColumn() or toggleColumnMinimize() — these don't exist anymore
// Fix: use setSpotlightLane(columnId) for focus behaviour
```

### 4. vertical-text Tailwind class
```tsx
// Bug: <div className="vertical-text"> — this class doesn't exist in Tailwind
// Fix: use inline style
<div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
```

### 5. App.tsx header layout changes
```tsx
// Bug: modifying the <header> macOS traffic light area without pl-20 clearance
// The header needs pl-20 on macOS for stoplight button clearance
```

### 6. Zustand full store destructure
```typescript
// Bug: const { activeView, columns, setActiveView } = useLayoutStore()
// This subscribes to every state change — causes excessive re-renders
// Fix: const activeView = useLayoutStore(s => s.activeView)
```

---

## Pre-PR Checklist

Run ALL of these before submitting your pull request:

- [ ] `cd copernicus && npx tsc --noEmit` — **zero errors** (not warnings — zero)
- [ ] Every new `ipcMain.handle()` in `main.ts` uses `handleIpc()` wrapper
- [ ] Every new channel in `main.ts` is also in `preload.ts SEND_CHANNELS`
- [ ] Every renderer IPC call uses `useIpcError()` hook
- [ ] Every IPC result checked for `result.ok` before accessing `result.data`
- [ ] No `console.log` calls added (use electron-log when Story 192 ships)
- [ ] No new hardcoded column ids
- [ ] Active states use VT block pattern (`bg-copernicus-phosphor text-[#050505] rounded-none`)
- [ ] No forbidden patterns from the table above
- [ ] Story AC items are specifically called out — don't implement beyond scope
- [ ] Files changed match those listed in the story's Key Files / Documentation Impact

---

## Definition of Done (applies to every story)

1. `cd copernicus && npx tsc --noEmit` — **zero errors**
2. All new `ipcMain.handle()` channels present in `preload.ts SEND_CHANNELS`
3. No forbidden patterns introduced
4. Files changed match story scope (Key Files section)
5. Story-specific Definition of Done items all satisfied
6. No existing functionality regressed (Kanban loads, Chat works, Editor works)

---

## Specialist Models (Story 228)

The COPERNICUS platform uses a dynamic model selection strategy to optimize for intelligence and cost.

| Model ID | Tier | Context | Specialty |
|---|---|---|---|
| `deepseek-v3.2:cloud` | High | 128k | Architectural reasoning, complex logic |
| `glm-5:cloud` | High | 64k | Planning, multi-file orchestration |
| `devstral-small-2:24b` | Med | 32k | Precise TypeScript coding, refactoring |
| `qwen2.5-coder:1.5b` | Low | 8k | Fast formatting, JSON output, tactical tasks |

- **High-Tier Models** always require UI confirmation before activation if switching from a lower tier.
- **Model Reasoning** MUST be provided as a `[MODEL REASONING]` block before any tool or model dispatch.
- **Protocol:** See `docs/reference/TECHNICAL_BIBLE.md` §8.6.

---

## Story Format Reference

```markdown
# Story NNN: Title

**Status:** APPROVED FOR IMPLEMENTATION
**Priority:** P1
**Assigned To:** Jules
**Blocked By:** NNN (or —)
**Blocks:** NNN (or —)
```

When you complete a story: do NOT modify the story `.md` file status.
The Kanban board updates status via IPC on card move.

---

## Environment Setup Notes

- **Jules env snapshot:** `cd copernicus && npm install && npx tsc --noEmit`
- **Node version:** use whatever is default in the Jules environment
- **electron-rebuild** not needed — no native addons beyond `better-sqlite3`
  (which ships with prebuilt binaries)
