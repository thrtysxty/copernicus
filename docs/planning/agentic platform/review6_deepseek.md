# Code Review 6 — DeepSeek (Systems / DB / Security)
**Sprint:** Stories 273–279 + hardening fixes
**Date:** 2026-03-09

---

## Findings

**[HIGH]** `copernicus/electron/db/state-ledger.ts:384-415` — The table rebuild executes `PRAGMA foreign_keys = OFF` outside a transaction, then drops and recreates `stories`. `better-sqlite3`'s `exec()` with multiple statements is not atomic — if the process crashes between `DROP TABLE stories` and `ALTER TABLE stories_rebuilt RENAME TO stories`, the database loses all story data permanently with no recovery path. → Wrap the entire rebuild block in `this.db.transaction(() => { ... })()`. Note: `PRAGMA foreign_keys` must be set outside the transaction (SQLite limitation), so the safe pattern is: set pragma → open transaction → DDL → commit → restore pragma.

**[HIGH]** `copernicus/electron/auth-manager.ts:161` — The Ollama URL priority chain now reads `settingsStore` at call time (per Story 274 intent), but looking at the committed code the chain still reads only env vars: `process.env.OLLAMA_LOCAL_URL || process.env.OLLAMA_BASE_URL || process.env.OLLAMA_CLOUD_URL`. Story 274 (Ollama Settings Panel) was dispatched to Jules and has not merged yet — `settingsStore.get('ollama.localUrl')` is not in the chain. This means the in-app settings UI (when it lands) will not be read by `AuthManager`. → Story 274 must add `settingsStore.get<string>('ollama.localUrl')` at the top of this chain before the env var fallbacks.

**[MEDIUM]** `copernicus/electron/ipc/file-handlers.ts` — `BrowserWindow.getAllWindows()[0]` correctly fixes the stale closure but introduces a new subtle issue: if called before any window exists (e.g. during early startup IPC), `getAllWindows()[0]` is `undefined` and the handler returns `null` silently. This is handled by the `if (!w) return null` guard — correct. However, if multiple windows are open (e.g. dev tools detached), `getAllWindows()[0]` may not be the main window. → Use `BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]` for more reliable window targeting.

**[MEDIUM]** `scripts/utils/review_gate.sh:8` — `set -e` causes the script to exit on any non-zero exit code. `npx tsc --noEmit` returning errors will exit with code 1, triggering `set -e` and skipping the IPC pattern check output summary. The script does print the tsc output before exiting, but the final "Review Gate PASSED" line is never printed on failure. This is correct behaviour but the error output from tsc may be truncated if it's large. → Consider `set -eo pipefail` and pipe tsc output through `head -50` to limit noise.

**[MEDIUM]** `scripts/utils/findings_to_stories.py:38` — `subprocess.run([sys.executable, str(scaffold), title])` passes the finding text directly as a CLI argument. If a finding contains shell metacharacters or very long text, this could fail or produce malformed story titles. The `subprocess.run` list form (not shell=True) is safe from shell injection, but argument length limits apply. The `[:120]` truncation at line 25 mitigates but doesn't eliminate the risk. → Also strip quotes and newlines from finding text before passing as argument.

**[LOW]** `copernicus/electron/db/state-ledger.ts:370-371` — Migration order: `RENAME COLUMN epic_id TO epic` runs before `ADD COLUMN epic TEXT`. On a fresh database that never had `epic_id`, RENAME fails (swallowed), ADD succeeds — correct. On a migrated DB that already has `epic` (RENAME was applied in a previous run), RENAME fails (column doesn't exist), ADD fails (column already exists) — both swallowed, correct. Logic is sound. However, documenting this implicit order dependency would prevent future migration ordering bugs. → Add inline comment explaining the intent and order dependency.

**[LOW]** `backend/app.py` — `allow_unsafe_werkzeug=True` is correct for flask-socketio 5.x in development. In production (Docker on Dell R210ii), a proper WSGI server (gunicorn + eventlet) should be used instead of the Werkzeug dev server. → Confirm `make deploy` uses gunicorn/eventlet and not the dev server.

**[INFO]** `copernicus/electron/auth-manager.ts:287` — `const ollamaUrl = process.env.OLLAMA_LOCAL_URL || ...` — the variable is assigned and then immediately checked with `if (ollamaUrl)`. Since the chain has `'http://localhost:11434'` as final fallback, `ollamaUrl` is always truthy. The `if` check is dead code. → Either remove the `if` or remove the string fallback to make the check meaningful.
