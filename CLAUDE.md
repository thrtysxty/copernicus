# CLAUDE.md
**Project:** Copernicus IDE
**Stack:** Python 3.11/Flask backend, Electron 33 + React 18 + TypeScript frontend, SQLite (better-sqlite3 + sqlite-vec)

## Development Commands
```bash
make setup       # First-time: install deps, create venv, copy config
make dev         # Start backend (5001) + frontend (Electron)
make tsc         # TypeScript type check (zero-error gate)
make lint        # ESLint
make test        # Python tests (pytest)
make test-e2e    # Playwright E2E tests
make clean       # Remove build artifacts
```

## Architecture
- **Backend:** Flask API at `:5001`. Routes in `backend/routes/`. Models in `backend/models/`.
- **Frontend:** Electron + Vite + React. Main process in `electron/`. Renderer in `src/renderer/`.
- **Database:** SQLite via better-sqlite3. Schema in `electron/db/state-ledger.ts`.
- **IPC:** All `ipcMain.handle` uses `handleIpc()` → `{ ok, data }` / `{ ok: false, error }`. Renderer uses `unwrapIpc()`.
- **Config:** All service URLs in `electron/config.ts` with env-var overrides.

## Code Standards
- TypeScript strict mode with `noEmit` gate — zero errors required
- All IPC goes through the envelope pattern (`handleIpc` / `unwrapIpc`)
- No hardcoded localhost URLs — use `config.ts`
- No `as any` in new code — use proper types or typed query helpers
