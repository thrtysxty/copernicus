# Epic 007: Security Hardening

**Status:** APPROVED FOR IMPLEMENTATION
**Priority:** P0 — BLOCKING
**Theme:** Production Security

## Narrative
Audit findings from devstral-2:123b and deepseek-v3.1:671b identified 5 CRITICAL security vulnerabilities. Zero new features ship until these are resolved.

## Goals
1. Eliminate all SQL injection vectors in the Flask backend
2. Harden all file path and subprocess operations against injection
3. Tighten CORS, env sanitizer, and debug exposure
4. Enforce input validation at every API boundary

## User Stories
- **Story 247:** SQL Injection Remediation — `backend/api/stories.py`, `backend/api/agents.py`
- **Story 248:** Path Traversal & Command Injection — `backend/api/agents.py`, `copernicus/electron/main.ts`, `dev_orchestrator/cloud_agent.py`
- **Story 249:** CORS & Env Sanitizer Hardening — `backend/app.py`, `backend/security/env-sanitizer.ts`
- **Story 250:** Backend Input Validation Middleware — all `backend/api/` endpoints

## Definition of Done
- Zero SQL string interpolation in query construction
- All subprocess calls use argument lists (no shell=True with user input)
- All file paths validated against allowlisted roots
- Pydantic models validate every API request body
- `cd copernicus && npx tsc --noEmit` passes; `pytest backend/tests/` passes
