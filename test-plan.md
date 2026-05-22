# Copernicus — Full End-to-End Test Coverage Plan

## Project
Copernicus IDE — `/Users/dadmin/Projects/copernicus/`
Stack: Python 3.11/Flask backend, Electron 33 + React 18 + TypeScript frontend, SQLite (better-sqlite3 + sqlite-vec).

## Existing Test Infrastructure
- `tests/` — 4 Python pytest files (1004 lines total): `test_jules_daemon.py`, `test_otel_collector.py`, `test_otel_recovery.py`, `test_story_validator.py`
- `make test` — runs pytest
- `make test-e2e` — Playwright E2E
- `make tsc` — TypeScript zero-error gate
- Zero frontend/component/IPC tests currently
- Partial coverage plan at `/Users/dadmin/Projects/copernicus-coverage-plan.md`

## Full Scope

### 1. Backend (Python/Flask)
- `backend/api/` — agents.py, docs.py, health.py, llm.py, orchestration.py, registry.py, settings.py, stories.py
- `backend/providers/` — base.py, factory.py, anthropic.py, openai.py, google.py, ollama.py
- `backend/middleware/` — auth.py
- `backend/routes/` — webhook_routes.py
- `backend/utils/` — errors.py, hmac_verify.py, path_guard.py, replay_cache.py, validate.py
- `backend/app.py`, `backend/socket_manager.py`

### 2. Frontend / Electron (TypeScript)
- `electron/` — main.ts, ipc handlers, auth-manager, backend-manager, config.ts, state-ledger
- `src/renderer/` — React components, hooks, stores
- IPC contract: all `ipcMain.handle` uses `handleIpc()` → `{ ok, data }` / `{ ok: false, error }`. Renderer uses `unwrapIpc()`. Every IPC channel needs a contract test.

### 3. Integration
- Flask routes with real SQLite in-memory DB
- WebSocket events via `socket_manager.py`
- Provider streaming under mock conditions

### 4. E2E (Playwright)
- Current `make test-e2e` setup — identify missing critical user flows

### 5. CI Automation
- Assess `.github/workflows/` if present
- Identify coverage threshold enforcement gaps

## Deliverable

Read ALL relevant source files. Produce a complete, actionable plan covering:

1. **Coverage baseline** — what is currently tested and what each test actually verifies
2. **Full gap inventory** — every untested module/component/IPC channel, with risk level
3. **Tooling recommendations** — pytest-cov for Python, vitest or jest for TS/React, Playwright for E2E, coverage thresholds
4. **Implementation roadmap** — ordered list of test files to write, with filename, what to test, tools/mocks needed
5. **CI configuration** — what the GitHub Actions workflow should look like to gate on coverage
6. **Estimated effort** — rough hours per test file

Write the complete output to `/Users/dadmin/Projects/copernicus-test-plan.md`.
Include at the bottom: UTC timestamp of completion and total time taken (start timing from when you begin reading files).

---

*Generated: 2026-05-21*

*Note: This is a template. The actual comprehensive plan with full module analysis, risk assessments, and implementation details will be generated after reading the codebase.*
