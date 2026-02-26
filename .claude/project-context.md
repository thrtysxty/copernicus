# COPERNICUS Industrial Agentic OS — Project Context

**Last Updated:** 2026-02-25
**Current Phase:** SPRINT 005 — PARALLEL FEATURE DEVELOPMENT
**Status:** Active development. Rebranding from BENWAY → COPERNICUS is COMPLETE.

---

## ⚠️ CRITICAL PATH CORRECTION — READ FIRST

The project was previously named **BENWAY**. That name is **dead**. The directory
`benway/` no longer exists anywhere in this repository.

**ALL IDE work happens in `copernicus/`.**

| ❌ WRONG (old benway path) | ✅ CORRECT (copernicus path) |
|---------------------------|------------------------------|
| `benway/electron/main.ts` | `copernicus/electron/main.ts` |
| `benway/electron/preload.ts` | `copernicus/electron/preload.ts` |
| `benway/src/renderer/` | `copernicus/src/renderer/` |
| `benway/src/renderer/App.tsx` | `copernicus/src/renderer/App.tsx` |
| `benway/package.json` | `copernicus/package.json` |
| `copernicus/src/main/` | `copernicus/electron/` (main process lives here) |

If any task references a `benway/` path — **stop and substitute `copernicus/`**.
Do NOT create a `benway/` directory. Do NOT write files under `benway/`.

---

## THE TECHNICAL MANDATE

COPERNICUS is a state-first Industrial Agentic IDE. Every action must be
deterministic, persisted to the State Ledger, and verified through the
Industrial Pipeline. "Measure Twice, Cut Once."

---

## DEVELOPMENT ENVIRONMENT

### Canonical File Paths

| Component | Path |
|-----------|------|
| Electron main process | `copernicus/electron/main.ts` |
| Electron preload | `copernicus/electron/preload.ts` |
| Auth manager | `copernicus/electron/auth-manager.ts` |
| Settings store | `copernicus/electron/settings-store.ts` |
| PTY manager | `copernicus/electron/pty-manager.ts` |
| FS manager | `copernicus/electron/fs-manager.ts` |
| Devtime manager | `copernicus/electron/devtime-manager.ts` |
| Workflow engine | `copernicus/electron/workflow/engine.ts` |
| Renderer root | `copernicus/src/renderer/` |
| App component | `copernicus/src/renderer/App.tsx` |
| Layout store | `copernicus/src/renderer/store/layout.ts` |
| Command registry | `copernicus/src/renderer/commands/registry.ts` |
| Chat panel | `copernicus/src/renderer/components/chat/ChatPanel.tsx` |
| useIpcError hook | `copernicus/src/renderer/hooks/useIpcError.ts` |
| State ledger | `copernicus/electron/db/state-ledger.ts` |
| State ledger DB | `~/.copernicus/copernicus.db` |
| Log file | `~/.copernicus/logs/copernicus.log` |

### Tooling & Commands
```bash
cd copernicus
npm install          # install dependencies
npm run dev          # Vite dev server + Electron
npx tsc --noEmit     # TypeScript check — must exit 0 before every PR
npm run test         # Vitest
npm run build        # production build
```

### Stack
- Electron + Vite + React 18 + TypeScript (strict mode)
- Tailwind CSS + phosphor aesthetic (`--phosphor` CSS custom property)
- SQLite (better-sqlite3) via `copernicus/electron/db/state-ledger.ts`
- electron-log (console.* re-routed to `~/.copernicus/logs/copernicus.log`)

---

## CODING STANDARDS (enforced by architect — non-negotiable)

1. **IPC only via contextBridge** — renderer uses `window.electronAPI.*`; never import
   electron directly in renderer code
2. **useIpcError hook** for ALL `invoke()` calls in renderer
3. **fs-manager returns `{ ok, data }` or `{ ok: false, error }`** — always check `ok`
4. **No external chart libraries** — SVG only (Chart.js/Recharts violate Pi baseline)
5. **No fuse.js** — hand-rolled fuzzy scorer
6. **No DnD libraries** — up/down buttons for reordering
7. **Phosphor aesthetic**: `bg-black`, `font-mono`, `var(--phosphor)` for accent —
   never hardcode `#4ADE80`
8. **New IPC channels**: add to BOTH `SEND_CHANNELS` in preload.ts AND `ipcMain.handle`
   in main.ts — symmetric registration required

---

## ACTIVE SPRINT

Sprint 005 parallel dev brief: `docs/planning/sprint_005_parallel_dev_brief.md`

Active stories (all APPROVED FOR IMPLEMENTATION):
- Story 120 — Workflow Canvas View
- Story 121 — Parallel Agent Review Gate
- Story 122 — Codebase Semantic Index (Wave 2, gates on Story 125)
- Story 123 — CAPEX Intelligence Dashboard
- Story 124 — Command Palette Overlay
- Story 125 — Dell R210ii Ollama Inference Service

Completed stories: `docs/stories/completed/` (45 files)

---

## INDUSTRIAL PIPELINE

Jules follows this pipeline for every story:
1. **Read** the story file in `docs/stories/` — ALL acceptance criteria are mandatory
2. **Read** all referenced existing files before writing anything
3. **Implement** — one file at a time, smallest change that satisfies the AC
4. **TypeScript check** — `cd copernicus && npx tsc --noEmit` must exit 0
5. **Commit** — conventional commits: `feat(scope): description`

---

*This file is read by agents at session start. The path table above is authoritative.
If in doubt about any path — read the actual filesystem, do not guess.*
