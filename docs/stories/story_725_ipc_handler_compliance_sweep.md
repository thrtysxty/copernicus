# User Story 725: IPC Handler Compliance Sweep

**Status:** APPROVED FOR IMPLEMENTATION
**Priority:** P1 — Open source release gate
**Phase:** Sprint 1 — Code Quality

## Story Number

725

## Narrative
**As a** Copernicus maintainer,
**I want** every `ipcMain.handle` call in `electron/` wrapped in `handleIpc()`,
**So that** error envelopes are consistent and contributors can trust the IPC contract.

## Context

Per `ipc-standards.md`, every handler registration must use `handleIpc()`:
```typescript
// ✅ correct
ipcMain.handle('foo:bar', (_e, arg) => handleIpc(() => manager.doThing(arg)))

// ❌ wrong — raw throw arrives at renderer as unreadable Electron error string
ipcMain.handle('foo:bar', (_e, arg) => manager.doThing(arg))
```

Before open-sourcing, all handlers must comply. Non-compliant handlers are both a bug
and a bad example for contributors.

## Acceptance Criteria

### Discovery
1. **Scan `electron/ipc/` for non-compliant registrations** — grep for `ipcMain.handle` calls
   NOT followed by `handleIpc(`. List every file and line.
2. **Document findings** — add a comment block at the top of this story's PR description:
   `Found N non-compliant handlers in X files`.

### Fix
3. **Wrap each non-compliant handler** — change raw callbacks to use `handleIpc()`:
   ```typescript
   ipcMain.handle('foo:bar', (_e, arg) => handleIpc(() => manager.doThing(arg)))
   ```
4. **Preserve business logic exactly** — do not change what the handler does, only how it's wrapped.
5. **Import `handleIpc`** in any file that gains the wrapper and doesn't already import it.

### Verification
6. **`make tsc` passes** — zero new type errors.
7. **`npx vitest run electron/ipc/`** — no test regressions.
8. **Zero remaining non-compliant registrations**:
   ```bash
   grep -rn "ipcMain.handle" electron/ipc/ | grep -v "handleIpc" | grep -v ".test.ts"
   ```
   Must return empty.

## IPC Channels Used
- All channels in `electron/ipc/`

## DB Schema Changes
- None

## Files in Scope
- `electron/ipc/*.ts` (any file with non-compliant handlers)
- No test file changes
- No production logic changes

## Frozen Surfaces
- Handler business logic — do not change behavior
- `electron/utils/handle-ipc.ts` — do not modify

## Blocks:
- None

## Blocked By:
- None

## Definition of Done
- [ ] All `ipcMain.handle` calls use `handleIpc()` wrapper
- [ ] `make tsc` zero errors
- [ ] Vitest no regressions
- [ ] Grep gate returns empty
