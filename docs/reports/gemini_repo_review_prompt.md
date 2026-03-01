# COPERNICUS IDE — Full Repository Review & Audit Prompt
# For: Gemini (gemini-2.5-pro or equivalent)
# Prepared by: /architect
# Date: 2026-02-28

---

You are performing a **full-repo engineering audit** of the COPERNICUS IDE — an
Electron/React/TypeScript desktop IDE for multi-agent orchestration. The repo root
is `/Users/dadmin/Projects/agentic-platform`. Output every finding in the structured
format specified at the bottom of this prompt. Do not truncate findings. Do not skip
files because they "look fine" — enumerate what you checked.

---

## PHASE 1 — TypeScript Compilation

Run from `copernicus/`:

```bash
npx tsc --noEmit 2>&1
```

Report:
- Total error count
- Every error: file path, line, code (TS####), message
- Every warning that would block a production build

---

## PHASE 2 — Build Verification

Run from `copernicus/`:

```bash
npm run build 2>&1
```

Report:
- Exit code
- Any Vite/Rollup/electron-builder errors
- Bundle size warnings (chunks > 500KB)
- Missing asset or import errors

---

## PHASE 3 — Test Suite

Run from `copernicus/`:

```bash
npx vitest run 2>&1
```

Report:
- Total / passed / failed / skipped
- Every failing test: file, test name, error message, stack trace (first 5 lines)
- Coverage % if available

---

## PHASE 4 — IPC Channel Audit

**Goal:** Verify every `ipcMain.handle` and `ipcMain.on` in `main.ts` has a
corresponding entry in `preload.ts` SEND_CHANNELS or LISTEN_CHANNELS, and vice versa.

Files to cross-reference:
- `copernicus/electron/main.ts`
- `copernicus/electron/preload.ts`

Extract two lists:
1. All `ipcMain.handle('channel-name', ...)` and `ipcMain.on('channel-name', ...)` → **registered channels**
2. All entries in `SEND_CHANNELS` and `LISTEN_CHANNELS` in `preload.ts` → **allowed channels**

Report:
- Channels registered in main but MISSING from preload (renderer cannot invoke them)
- Channels in preload but with NO handler in main (dead allowlist entries)
- Channels used in renderer components (`window.ipcRenderer.invoke/send/on`) that are
  not in preload (search `copernicus/src/renderer/**/*.tsx`)

---

## PHASE 5 — Renderer Component Audit

Walk every `.tsx` file in `copernicus/src/renderer/`. For each file report:

### 5a — Bare IPC violations
Any `window.ipcRenderer.invoke(...)` or `window.ipcRenderer.send(...)` that is NOT
routed through `useIpcError` hook. These violate Story 163 standing rule.

Pattern to find: `window.ipcRenderer.invoke` outside of `useIpcError.ts` itself.

### 5b — Unhandled promise chains
Any `.then(` without a `.catch(` or `try/catch` wrapping the awaited call.

### 5c — React hook dependency array violations
Run ESLint exhaustive-deps rule mentally or via:
```bash
npx eslint copernicus/src/renderer --rule '{"react-hooks/exhaustive-deps": "warn"}' 2>&1
```
Report any `useEffect`/`useCallback`/`useMemo` with missing or incorrect deps.

### 5d — Missing key props
Any `.map(` rendering JSX without a `key=` prop.

### 5e — TypeScript `any` usage
Count and list every explicit `any` type annotation in renderer files. Flag files
with more than 5 occurrences.

---

## PHASE 6 — Electron Main Process Audit

Walk `copernicus/electron/`. For each `.ts` file:

### 6a — Unguarded IPC handlers
Any `ipcMain.handle` NOT wrapped in `handleIpc()`. These violate Story 163 standing rule.

### 6b — Synchronous blocking calls in IPC handlers
Any `fs.readFileSync`, `execSync`, `Database.prepare(...).get()` called directly
inside an async IPC handler without being offloaded. Flag if the call could block
> ~50ms (e.g. reading large files, running shell commands).

### 6c — Security: path traversal risk
In `fs-manager.ts` and any `fs:*` handler: verify every file path is validated
against the project root with `path.resolve` + prefix check. Report any handler
that accepts a raw user-supplied path without sanitization.

### 6d — Security: secret leakage
Search for any hardcoded API keys, tokens, or credentials:
```bash
grep -rn "sk-ant\|sk-\|AIza\|ghp_\|Bearer " copernicus/electron/ --include="*.ts"
```
Report every match.

### 6e — Memory leaks: IPC listener accumulation
Any `ipcMain.on(...)` that registers a listener but has no corresponding
`ipcMain.removeListener` or `.once()`. Specifically look for listeners registered
inside `createWindow()` that fire on every invocation.

---

## PHASE 7 — Database Schema & StateLedger Audit

File: `copernicus/electron/db/schema.ts` + `state-ledger.ts`

Check:
- Every table in `SCHEMA` has a corresponding `this.db.exec(SCHEMA.tableName)` in `init()`
- Every public method has correct parameter binding (no string interpolation in SQL — only `?` or named params)
- Any raw `.prepare(...).run(userInput)` where `userInput` comes from renderer IPC without validation
- The `model_calls` table `created_at` column: verify the `idx_model_calls_session` index uses `created_at DESC`
- Confirm `WAL` journal mode is set before table creation

---

## PHASE 8 — Store & State Audit

Walk `copernicus/src/renderer/store/`.

For each Zustand store file:
- List all state keys and their TypeScript types
- Identify any state that is never read by any component (dead state)
- Identify any actions that mutate state outside of Zustand's `set()` (direct mutation)
- Check `persist` middleware: verify only serializable values are persisted (no functions, no class instances)
- Verify `layout.ts` contains: `uiBuilderOpen`, `toggleUIBuilder()`, `activeWorkflowTemplate`,
  `columns: KanbanColumn[]`, `StoryboardView` type includes all 5 views
  (`blueprint | studio | engine-room | capex | workflow`)

---

## PHASE 9 — Dependency Audit

Run from `copernicus/`:

```bash
npm audit --audit-level=moderate 2>&1
npm outdated 2>&1
```

Also check `package.json`:
- Verify `recharts` is in `dependencies` (not `devDependencies`)
- Verify `react-rnd` is in `dependencies`
- Verify `better-sqlite3` is in `dependencies`
- Flag any package with a known CVE at high/critical severity
- Flag any package pinned to an exact version that has a newer minor available

---

## PHASE 10 — File & Directory Structure Audit

Walk the full project tree and verify:

### 10a — Expected files exist
Check these files exist and are non-empty:
```
copernicus/electron/db/schema.ts
copernicus/electron/db/state-ledger.ts
copernicus/electron/llm/service.ts
copernicus/electron/models/model-registry.ts
copernicus/electron/auth-manager.ts
copernicus/electron/pty-manager.ts
copernicus/electron/fs-manager.ts
copernicus/electron/workflow/engine.ts
copernicus/electron/workflow/types.ts
copernicus/electron/touch-bar.ts
copernicus/electron/touch-bar-types.ts
copernicus/electron/preload.ts
copernicus/electron/main.ts
copernicus/src/renderer/store/layout.ts
copernicus/src/renderer/store/toastStore.ts
copernicus/src/renderer/hooks/useIpcError.ts
copernicus/src/renderer/components/capex/CapexDashboard.tsx
copernicus/src/renderer/components/capex/chart-theme.ts
copernicus/src/renderer/components/workflow/WorkflowCanvas.tsx
copernicus/src/renderer/components/Terminal/TerminalTabs.tsx
copernicus/src/renderer/components/jules/JulesPanel.tsx
copernicus/src/renderer/components/settings/SettingsPanel.tsx
copernicus/src/renderer/components/settings/sections/HardwareSection.tsx
copernicus/src/renderer/components/Editor/ui-builder/UIBuilderCanvas.tsx
copernicus/src/renderer/components/Editor/ui-builder/UIComponentInspector.tsx
copernicus/src/renderer/components/Editor/ui-builder/render.ts
copernicus/src/renderer/components/Editor/ui-builder/types.ts
copernicus/src/renderer/types/ipc.ts
copernicus/src/renderer/types/touch-bar.ts
```

### 10b — Orphaned files
List any `.tsx`/`.ts` file in `src/renderer/` that is not imported by any other file
(dead code). Check via:
```bash
# For each file, check if its export name appears in any other file
grep -rl "ComponentName" copernicus/src/renderer/
```
Flag files with zero import references.

### 10c — Duplicate logic
Identify any functions defined more than once with identical or near-identical bodies
across different files (e.g. multiple `formatTokens`, `formatTime`, `truncate` helpers).

---

## PHASE 11 — Performance Scan

### 11a — Re-render risk
In `copernicus/src/renderer/`:
- Identify components that subscribe to entire Zustand store (`useLayoutStore()` with
  no selector) — these re-render on any store change
- Identify `useEffect` with empty `[]` deps that invoke IPC (potential stale closure)
- Identify inline object/array/function literals passed as props (new reference each render)

### 11b — Bundle weight
After build completes, report chunks larger than 300KB and identify which imports
are responsible (recharts, monaco-editor, xterm, etc.)

---

## PHASE 12 — Git Hygiene

Run from repo root:

```bash
git status --short 2>&1
git stash list 2>&1
git log --oneline -20 2>&1
```

Report:
- Any untracked files that look like they should be committed (`.ts`, `.tsx`, `.json`)
- Any untracked files that look like they should be gitignored (`.db`, `.dmg`, `.blockmap`)
- Stashes that exist (forgotten work)
- Commit messages that don't follow the established format

---

## OUTPUT FORMAT

Produce a single Markdown document with this structure:

```markdown
# COPERNICUS IDE — Repo Audit Report
**Date:** YYYY-MM-DD
**Auditor:** Gemini
**Commit:** <git rev-parse HEAD>

---

## Summary Table

| Phase | Check | Status | Issues Found |
|-------|-------|--------|--------------|
| 1 | TypeScript | ✅ PASS / ❌ FAIL | N errors |
| 2 | Build | ... | ... |
...

---

## Phase 1 — TypeScript
[Full findings]

## Phase 2 — Build
[Full findings]

...

## Recommended Fix Order
1. [Highest severity issue] — [file:line] — [reason]
2. ...
```

Do not summarize or skip sections. Every phase must appear even if the result is
"No issues found." Output the full report to:
`/Users/dadmin/Projects/agentic-platform/docs/reports/repo_audit_<YYYYMMDD>.md`

And print the summary table to stdout.
