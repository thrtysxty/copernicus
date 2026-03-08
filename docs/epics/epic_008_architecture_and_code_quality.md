# Epic 008: Architecture & Code Quality

**Status:** APPROVED FOR IMPLEMENTATION
**Priority:** P1
**Theme:** Technical Debt Reduction

## Narrative
Audit identified god objects, memory leaks, type safety violations, blocking I/O, and missing abstractions across the stack. This epic systematically reduces technical debt to bring the codebase to production quality.

## Goals
1. Break up monolithic files into focused, testable modules
2. Establish consistent error handling and resource cleanup patterns
3. Enforce TypeScript strict mode and eliminate `any`
4. Optimize SQLite usage (FK enforcement, indexes, WAL, pooling)
5. Move blocking operations off the main process

## User Stories
- **Story 251:** Decompose `main.ts` God Object (1200+ lines → modules)
- **Story 252:** Decompose `ChatPanel.tsx` (1000+ line component → sub-components)
- **Story 253:** SQLite Hardening (FK constraints, WAL mode, indexes, N+1 fixes)
- **Story 254:** TypeScript Strict Mode & `any` Audit
- **Story 255:** Unified Error Handling Infrastructure (Python + TS)
- **Story 256:** Dead Code Sweep & Incomplete Implementations
- **Story 257:** Memory Leak & Resource Cleanup (event listeners, DB connections)
- **Story 258:** Blocking Ops → Async + Worker Threads
- **Story 259:** Provider Base Class & `cloud_agent` Retry Logic

## Definition of Done
- `main.ts` under 300 lines; each extracted module has a single responsibility
- `ChatPanel.tsx` under 250 lines; sub-components independently testable
- SQLite schema has `PRAGMA foreign_keys = ON` and WAL mode; all queries indexed
- `tsc --strict` passes with zero `any` suppressions added by this epic
- All catch blocks log or re-throw; no silent swallowing
- Zero unused imports in any file touched
