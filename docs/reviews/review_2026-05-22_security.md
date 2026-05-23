# Code Review: Copernicus

**Reviewed:** 2026-05-22
**Reviewer:** minimax-m2.7 (automated)
**Stack:** Electron + TypeScript, Flask + SQLite, React
**Files reviewed:** `backend/app/stories.py`, `backend/app/docs.py`, `electron/ipc/security-handlers.ts`, `electron/ipc/file-handlers.ts`, `electron/ipc/terminal-handlers.ts`, `electron/ipc/hub-handlers.ts`, `electron/ipc/register-all-handlers.ts`, `electron/utils/handle-ipc.ts`, backend tests

Stories authored from this review: 732, 733, 734, 735

---

## BLOCK — Fix before shipping

### BLOCK-1: `stories.py` — No input validation, empty strings accepted → story 732

**File:** `backend/app/stories.py:23-24`

```python
title = data.get('title', '')
description = data.get('description', '')
```

`get()` with default `''` means both title and description can be empty strings and pass straight through to the INSERT. No length checks, no required fields beyond the JSON body existing.

**Fix sketch:**
```python
title = data.get('title', '')
description = data.get('description', '')
if not title or not description:
    return jsonify({'error': 'title and description are required'}), 400
if len(title) > 500 or len(description) > 10000:
    return jsonify({'error': 'Field too long'}), 400
```

---

### BLOCK-2: `terminal-handlers.ts` — Docker container ID unsanitized in logs command → story 733

**File:** `electron/ipc/terminal-handlers.ts:103`

```typescript
ptyManager.createEphemeral(termId, `docker logs -f ${id}`, fsManager.getRootPath(), win);
```

`id` comes from `runtime:manage-container` IPC arg (line 98). If a malicious renderer passes `foo; rm -rf /`, the command becomes `docker logs -f foo; rm -rf /`. `shell: false` helps but Docker CLI itself parses semicolons.

**Fix sketch:**
```typescript
if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('INVALID_CONTAINER_ID');
ptyManager.createEphemeral(termId, `docker logs -f ${id}`, ...);
```

---

### BLOCK-3: `docs.py` — Duplicate path validation with divergent logic → story 734

**File:** `backend/app/docs.py:80-87`

`is_safe_path` and `sanitize_path` have different null byte checks (`'%00' in path.lower()` vs `'%00' in path`). A path could pass one check but not the other, making the security boundary unpredictable.

**Fix sketch:** Consolidate to one authoritative function — `sanitize_path` only.

---

### BLOCK-4: `file-handlers.ts` — `assertSafePath` behavior unconfirmed → story 735

**File:** `electron/ipc/file-handlers.ts:23-46`

`assertSafePath` is called but it's unclear whether it throws (safe) or silently passes (unsafe) on bad input. If it silently passes, an unsafe path gets staged.

---

## WARN

### WARN-1: `stories.py` — DELETE returns success for non-existent story
DELETE by ID checks `rowcount` — correct. But no test for the 404 path exists.

### WARN-2: `hub-handlers.ts` — Silent JSON parse failures in cost summary loop
Lines 193-195, 231, 262: `catch (e) {}` swallows budget JSON corruption silently. Should log.

### WARN-3: `handle-ipc.ts` — Wraps all errors including programmer errors
`handleIpc` returns `{ok: false}` for both runtime and programmer errors. TypeError gets same treatment as a real failure — makes debugging harder.

### WARN-4: `register-all-handlers.ts` — `globalDeps: any` typed throughout
No compile-time checking on handler dependencies. Missing dep only fails at call time.

---

## NOTE

- `stories.py` — No rate limiting or quota
- `docs.py` — `get_doc` is a stub, always returns 404 (path validation is real but unused)
- SQL injection tests cover CREATE/READ; UPDATE path not explicitly tested
- 40+ IPC handlers — no manifest, opaque to new contributors

---

## Test Coverage Assessment

**Backend (`backend/tests/`):**
- Route tests: ✅ 8 tests for stories CRUD
- Security tests: ✅ 6 SQL injection tests, parameterized queries confirmed
- **Missing:** No tests for `docs.py` path validation; no UPDATE SQL injection test

**Electron (`electron/`):**
- `ipc-envelope.test.ts`, `stories.test.ts`, `handle-ipc.test.ts`, `hub-ipc.test.ts` exist
- **Missing:** No tests for `terminal-handlers` regex validation, `file-handlers` path validation, or `handle-ipc` error suppression

---

## Summary

| Area | Status |
|------|--------|
| SQL injection (backend) | ✅ Parameterized, tested |
| Path traversal (docs) | ✅ Validated, but redundant logic |
| IPC input validation | ⚠️ Partial — terminal Docker args unvalidated |
| Shell injection | ✅ `shell: false` used, but Docker args need sanitization |
| Test coverage (backend) | ✅ Good on stories routes and SQL injection |
| Test coverage (Electron) | ⚠️ Thin on handlers |
| Error handling | ⚠️ Silent catch-all masks programmer errors |

**Recommendation:** Fix BLOCK items before first external deployment.
