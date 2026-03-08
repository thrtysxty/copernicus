# COPERNICUS Codebase Audit — Consolidated Findings
**Sources:** devstral-2:123b + deepseek-v3.1:671b independent reviews, 2026-03-07
**Files reviewed:** 197 source files (197 .py/.ts/.tsx across backend/, copernicus/, scripts/, src/agentic/, dev_orchestrator/)

---

## Severity Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 5 |
| HIGH | 8 |
| MEDIUM | 11 |
| LOW | 5 |

---

## CRITICAL

### C-1 — SQL Injection (`backend/api/stories.py`, `backend/api/agents.py`)
Direct string interpolation in SQL queries: `f"UPDATE stories SET {', '.join(update_fields)} WHERE id = ?"`. No parameterized query protection in `context_handoff` endpoints. Risk: full DB compromise.
→ Story 247

### C-2 — Path Traversal (`backend/api/agents.py`, `copernicus/electron/main.ts`)
Unsanitized file paths from user input (`data.get('filePath')`). No validation on `dirPath` parameters in file operations. Risk: arbitrary file read/write.
→ Story 248

### C-3 — Command Injection (`backend/api/agents.py`, `copernicus/electron/main.ts`, `dev_orchestrator/cloud_agent.py`)
`subprocess.run()` with unsanitized user input. `execFileSync()` calls with dynamic commands. PTY manager constructs shell commands without sanitization. Risk: remote code execution.
→ Story 248

### C-4 — Missing Input Validation (`backend/api/` — all endpoints)
No validation of `session_id`, `model_name`, or other parameters. No schema enforcement at API boundaries. Risk: malicious payloads accepted silently.
→ Story 250

### C-5 — Insecure Environment Handling (`backend/security/env-sanitizer.ts`)
`buildSafeEnv` passes arbitrary env vars through `allowList` without regex validation. CORS wildcard for localhost origins, no WebSocket origin validation.
→ Story 249

---

## HIGH

### H-1 — God Object: `main.ts` (1200+ lines)
Single file handles auth, file I/O, workflows, terminals, IPC, settings. Violates every SOLID principle. Impossible to test or maintain.
→ Story 251

### H-2 — God Component: `ChatPanel.tsx` (1000+ lines)
Single React component with mixed concerns: chat UI, GUIDE tab, Copernicus persona, websocket state, IPC, rendering.
→ Story 252

### H-3 — Inconsistent Error Handling (global)
Empty catch blocks: `catch { /* non-fatal */ }`. Silent failures throughout Python and TypeScript. No structured error propagation. Some endpoints use try-catch; others don't.
→ Story 255

### H-4 — Global State Pollution / Race Conditions
`stateLedger` singleton with mutable global state. Multiple Zustand stores managing overlapping state without coordination. Race conditions guaranteed under concurrent agent sessions.
→ Story 253 (DB side), Story 258 (store side)

### H-5 — Foreign Key Constraints Not Enforced (`copernicus/electron/db/schema.ts`)
Schema defines FK relationships but `PRAGMA foreign_keys = ON` not set. Data integrity cannot be maintained.
→ Story 253

### H-6 — Incomplete Implementation (`backend/api/agents.py`)
`ContextManager.get_items()` returns bare `return` — no value, no error, silently broken. Provider factory has no error handling for initialization failures.
→ Story 256

### H-7 — Tight Coupling (global)
`backend/app.py` directly imports and registers all blueprints with no DI. Components import each other in cycles.
→ Story 251 (TS side), Story 257 (Python side)

### H-8 — Mixed Paradigms / DB Access from Both Processes
SQLite accessed from both Electron main process and Flask backend. No coordination. Flask + Electron communicating via HTTP+WebSockets with no clear service boundary.
→ Story 253

---

## MEDIUM

### M-1 — Type Safety Violations (global)
Rampant `any` types in TypeScript. No proper interfaces for cross-process IPC data. Runtime type checking instead of compile-time.
→ Story 254

### M-2 — Memory Leaks (global)
Event listeners never cleaned up. DB connections not pooled. React components unmount without cleanup (`useEffect` missing return).
→ Story 257

### M-3 — Dead Code / Unused Imports (global)
Unused methods, imports, and commented-out code across all files. Orphaned features from prior implementations.
→ Story 256

### M-4 — SQLite Performance (`copernicus/electron/db/`, `backend/`)
No connection pooling. Frequent full-table scans without indexes. N+1 query patterns in story management. No WAL mode enabled.
→ Story 253

### M-5 — Blocking Operations in Electron Main Process (`copernicus/electron/main.ts`)
Synchronous file operations block the main process. No worker threads for CPU-intensive tasks. UI freezes guaranteed during heavy ops.
→ Story 258

### M-6 — Zustand Re-render Performance (`copernicus/src/renderer/store/`)
Stores contain complex nested objects causing unnecessary re-renders. No memoization or selective subscription patterns.
→ Story 258

### M-7 — Magic Strings (global)
Model names, event types, IPC channel names as bare string literals throughout Python and TypeScript. No central constants.
→ Story 256

### M-8 — Missing Provider Abstraction (`backend/providers/`)
Each provider implements its own streaming logic. No base class. Code duplication across anthropic/openai/google providers.
→ Story 259

### M-9 — No Retry / Recovery in `cloud_agent.py`
`cloud_agent.py` has no retry logic. Single failure aborts the entire session with no recovery path.
→ Story 259

### M-10 — CORS Overly Permissive (`backend/app.py`)
`origins=['http://localhost:3000', 'app://copernicus']` — no origin validation for WebSocket connections.
→ Story 249

### M-11 — Hardcoded Debug Exposure
`VITE_DEV_SERVER_URL` exposed. Debug tooling conditionally included but not fully gated.
→ Story 249

---

## Story Map

| Story | Title | Priority | Epic |
|-------|-------|----------|------|
| 247 | SQL Injection Remediation | P0 | 007 |
| 248 | Path Traversal & Command Injection Hardening | P0 | 007 |
| 249 | CORS & Env Sanitizer Hardening | P0 | 007 |
| 250 | Backend Input Validation Middleware | P1 | 007 |
| 251 | Decompose `main.ts` God Object | P1 | 008 |
| 252 | Decompose `ChatPanel.tsx` | P1 | 008 |
| 253 | SQLite Hardening (FK, pooling, indexes, WAL) | P1 | 008 |
| 254 | TypeScript Strict Mode & `any` Audit | P1 | 008 |
| 255 | Unified Error Handling Infrastructure | P1 | 008 |
| 256 | Dead Code Sweep & Incomplete Implementations | P2 | 008 |
| 257 | Memory Leak & Resource Cleanup | P2 | 008 |
| 258 | Blocking Ops → Async + Worker Threads | P2 | 008 |
| 259 | Provider Base Class & `cloud_agent` Retry | P2 | 008 |
