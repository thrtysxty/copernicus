# Code Review 6 — Cogito (Architecture / IPC / TypeScript)
**Sprint:** Stories 273–279 + hardening fixes
**Date:** 2026-03-09

---

## Findings

**[HIGH]** `copernicus/src/renderer/components/Terminal/TerminalTabs.tsx:113,120` — `window.ipcRenderer.send('layout:toggle-flip', 'terminal')` and `window.ipcRenderer.send('layout:toggle-spotlight', 'terminal')` call `.send()` directly. The preload likely only exposes `.invoke()`, `.on()`, and possibly `.send()` — if `.send` is not in the contextBridge exposure, both buttons will throw `TypeError: window.ipcRenderer.send is not a function` at runtime. → Verify preload exposes `send`, or replace with `invoke('layout:toggle-flip', 'terminal').catch(() => {})`.

**[MEDIUM]** `copernicus/src/renderer/components/KanbanBoard.tsx:17` — `Story` interface still declares `epic_id: string | null` but the DB column was renamed to `epic` in the migration. The field name mismatch means any code reading `story.epic_id` from IPC responses will always get `undefined` (the response now has `story.epic`). → Update interface to `epic: string | null`.

**[MEDIUM]** `copernicus/src/renderer/components/KanbanBoard.tsx:389-398` — "New Story" button in the `ready-to-build` column footer calls `setCreation({ phase: 'form', type: 'Story' })`, but the creation form now renders inside the `planning` column (line 342). Clicking New Story in `ready-to-build` silently opens a form in a different column that may not be visible if the user has scrolled. The footer button should either be removed or the form should conditionally render in `ready-to-build` too. → Remove the footer button from `ready-to-build` or target the form to whichever column triggered creation.

**[MEDIUM]** `copernicus/src/renderer/components/KanbanBoard.tsx:127` — `ArchiveList` calls `invoke('stories:list', { status: 'ARCHIVED' })` but the `stories:list` IPC handler may not support a filter argument — it may return all stories. If the handler ignores the argument, archived stories won't be filtered and the entire story list is rendered in the archive section. → Verify `stories:list` handler supports `{ status }` filter, or use a dedicated `stories:list-archived` call.

**[LOW]** `copernicus/electron/db/state-ledger.ts:384` — The table rebuild runs all DDL in a single `db.exec()` string including `PRAGMA foreign_keys = OFF`. `better-sqlite3`'s `exec()` does not wrap multi-statement strings in a transaction — if execution is interrupted after `DROP TABLE stories` and before the rename, the table is lost. → Wrap the rebuild in `this.db.transaction(() => { ... })()` with the pragma calls outside the transaction boundary.

**[LOW]** `copernicus/src/renderer/components/KanbanBoard.tsx:175-179` — `fetchJulesSessions` calls `invoke<any>('jules:list-sessions')` and discards the result entirely. This is a side-effect-only fetch that triggers a re-render nowhere — it's dead code as written. Either remove it, or use the result to update state.

**[INFO]** `copernicus/src/renderer/components/layout/SplashScreen.tsx` — CRT timing compressed to 2.2s. On slow machines the first frame may still appear black for ~150ms. Acceptable but worth a note if users report blank splash on HDD-based systems.

**[INFO]** `copernicus/src/renderer/store/layout.ts` — `showArchive: false` initial state is not persisted across sessions (in-memory only, per story AC). Confirmed correct per AC-3.
