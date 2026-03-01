# AGENTS.md — COPERNICUS IDE

## Project Identity
COPERNICUS is a multi-pane Electron IDE built on React 18 + TypeScript.
Main process: Node.js (Electron main). Renderer: React (no Node APIs).
Database: better-sqlite3 (main process only). IPC: contextBridge allowlist.

## Repository Layout
```
copernicus/
  electron/          ← Electron main-process code (Node.js, TypeScript)
    db/              ← StateLedger (schema.ts, state-ledger.ts)
    workflow/        ← WorkflowEngine (engine.ts, types.ts, states.ts)
    llm/             ← LLMService (service.ts)
    models/          ← ModelRegistry (model-registry.ts)
    auth-manager.ts  ← AuthManager singleton
    fs-manager.ts    ← FSManager singleton
    pty-manager.ts   ← PTYManager singleton
    stories.ts       ← StoriesManager singleton
    main.ts          ← Entry point; all ipcMain.handle() registrations
    preload.ts       ← contextBridge; SEND_CHANNELS + RECEIVE_CHANNELS
  src/renderer/      ← React renderer (no Node.js APIs)
    App.tsx          ← Root; layout, FlippablePanel, activity bar
    components/      ← Feature components
    store/           ← Zustand stores (layout.ts, agentStore.ts, etc.)
docs/stories/        ← Story .md files
AGENTS.md            ← This file
```

## Build & Verification Commands
```bash
# Install (run once per environment)
cd copernicus && npm install

# Type-check only (use this to verify your changes compile)
cd copernicus && npx tsc --noEmit

# Full build
cd copernicus && npm run build

# Run tests
cd copernicus && npm test
```

IMPORTANT: Never start a dev server (`npm run dev`, `electron .`) in a Jules
task — long-running processes cause tasks to time out.

## IPC Contract (CRITICAL — read before adding any IPC channel)

All IPC channels must be declared in BOTH places or the renderer cannot call them:
1. `copernicus/electron/main.ts` — `ipcMain.handle('channel:name', handler)`
2. `copernicus/electron/preload.ts` — add `'channel:name'` to `SEND_CHANNELS` Set

For channels pushed main→renderer (no invoke): add to `RECEIVE_CHANNELS` instead.

`invoke()` in the renderer maps to `ipcMain.handle()` in main.
`window.ipcRenderer.on()` in the renderer maps to `win.webContents.send()` in main.

Never use `ipcRenderer.send/sendSync` — the allowlist only permits `invoke` and `on`.

## TypeScript Conventions
- Use `import type` for type-only imports.
- Prefer explicit return types on public methods.
- `Record<string, any>` is acceptable only for `node.data` in workflow nodes.
- No `require()` in renderer files. Main-process `require()` is acceptable.
- All SQLite operations go through `StateLedger` methods — never `stateLedger.db.prepare()` directly from outside the class.
- New `StateLedger` methods go in `state-ledger.ts`, new table definitions go in `schema.ts`.

## Electron Security Rules
- Renderer has `contextIsolation: true`, `nodeIntegration: false`. Never change this.
- Renderer communicates with main ONLY via `window.ipcRenderer` (the contextBridge).
- Never import Electron or Node.js modules in renderer files (src/renderer/**).
- `fs`, `path`, `child_process` are main-process only.

## React + Zustand Conventions
- Layout state lives in `copernicus/src/renderer/store/layout.ts` (Zustand).
- New persistent state fields: add to `LayoutState` interface + `create()` initial state + setter action.
- Components use `useLayoutStore(s => s.field)` — never destructure the full store.
- Tailwind only — no inline style objects except for dynamic values (transform, color from JS variable).
- Component files use PascalCase. Hook files use camelCase with `use` prefix.

## Performance Scope — Raspberry Pi 3B+ Rule

The `/pi_check` audit and Pi 3B+ performance baseline apply **only** to:
- `src/agentic/` — Python orchestration CLI tools
- `backend/` — Flask API handlers
- `scripts/` — CLI utilities

**The following are explicitly exempt** — they run exclusively on the developer's
desktop machine (Electron renderer, GPU-accelerated canvas, WebGL):
- `copernicus/src/renderer/components/workflow/WorkflowCanvas.tsx` — SVG canvas with live node animation
- `copernicus/src/renderer/components/Editor/UICanvas.tsx` and `ui-builder/UIBuilderCanvas.tsx` — iframe HTML preview
- `copernicus/src/renderer/components/capex/CapexDashboard.tsx` and any reporting/charting components
- Any component using `<canvas>`, WebGL, or requestAnimationFrame

Do not apply Pi performance constraints (bundle size warnings, animation limits,
re-render budgets) to these exempted paths. Use whatever rendering approach
produces the best desktop UX.

## IPC Error Handling — Mandatory Pattern

Every `ipcMain.handle` in `main.ts` **must** wrap its body in `handleIpc()`:

```typescript
// ✅ Required
ipcMain.handle('foo:bar', (_e, arg) => handleIpc(() => manager.doThing(arg)))

// ❌ Forbidden — raw throws produce unreadable Electron error strings in the renderer
ipcMain.handle('foo:bar', (_e, arg) => manager.doThing(arg))
```

Every renderer component that calls IPC **must** use the `useIpcError` hook:

```typescript
// ✅ Required
const invoke = useIpcError()
const result = await invoke<MyType>('foo:bar', arg)

// ❌ Forbidden — errors silently swallowed
await window.ipcRenderer.invoke('foo:bar', arg)
```

`handleIpc` is defined in `copernicus/electron/main.ts`. `useIpcError` is in
`copernicus/src/renderer/hooks/useIpcError.ts`. Both already exist — use them.

## Forbidden Patterns
- `fs.writeFileSync(path, content)` on story `.md` files — use `writeFileAtomic()` from `stories.ts`.
- `window.ipcRenderer.send('toast:show', ...)` — no such channel. Use `useToastStore.getState().addToast(msg, type)`.
- `buildSafeEnv(process.env)` — wrong signature. Use `buildSafeEnv(agentId, allowList)`.
- Importing `StateLedger` class in renderer files.
- Adding a new IPC channel to `main.ts` without also adding it to `preload.ts SEND_CHANNELS`.
- Hardcoding model IDs as string literals outside `model-registry.ts`.
- Bare `ipcMain.handle` without `handleIpc()` wrapper.
- Bare `window.ipcRenderer.invoke()` in renderer components — always use `useIpcError`.

## Story Format
Stories in `docs/stories/` follow this header format:
```
**Status:** APPROVED FOR IMPLEMENTATION
**Assigned To:** Jules
**Blocked By:** Story NNN
```
When you complete a story's implementation, do not modify the story `.md` file.
The Kanban board updates status via IPC.

## Definition of Done for every story
1. `cd copernicus && npx tsc --noEmit` passes with zero errors.
2. All new `ipcMain.handle()` channels are in `preload.ts SEND_CHANNELS`.
3. No forbidden patterns introduced.
4. Files listed in story's Documentation Impact section are the only files changed
   (plus any files those naturally require — tests, type extensions, etc.).
