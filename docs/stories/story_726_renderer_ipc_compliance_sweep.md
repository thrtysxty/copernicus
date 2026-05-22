# User Story 726: Renderer IPC Compliance Sweep

**Status:** APPROVED FOR IMPLEMENTATION
**Priority:** P1 — Open source release gate
**Phase:** Sprint 1 — Code Quality

## Story Number

726

## Narrative
**As a** Copernicus maintainer,
**I want** every renderer component that calls IPC to use `useIpcError` + `unwrapIpc`,
**So that** errors surface consistently in the UI and contributors see a single canonical pattern.

## Context

Per `ipc-standards.md`, renderer IPC calls must use:
```typescript
// ✅ correct
import { unwrapIpc } from '../../types/ipc'
const invoke = useIpcError()
const result = await invoke<MyType>('foo:bar', arg)
const data = unwrapIpc<MyType>(result)

// ❌ wrong — errors silently swallowed or fragile
await window.ipcRenderer.invoke('foo:bar', arg)
const badData = (result as any)?.data ?? result
```

## Acceptance Criteria

### Discovery
1. **Scan `src/renderer/` for bare invocations**:
   ```bash
   grep -rn "ipcRenderer\.invoke\|electronAPI\.invoke\|window\.electron" src/renderer/ --include="*.tsx" --include="*.ts"
   ```
   List every non-compliant call site.
2. **Scan for raw result unwrapping** — grep for `?.data` patterns that bypass `unwrapIpc`.

### Fix
3. **Replace each bare `invoke` with `useIpcError` pattern** — add the hook import, replace the
   call, wrap the result in `unwrapIpc`. One component at a time.
4. **Add `useIpcError` import** if missing: `import { useIpcError } from '../hooks/useIpcError'`
   (verify the actual path by checking where the hook is defined).
5. **Preserve existing error handling** — if a component has try/catch around the old call,
   keep error handling in place; `useIpcError` augments it, doesn't replace it.

### Verification
6. **`make tsc` passes**.
7. **Vitest no regressions**.
8. **Zero remaining bare invocations**:
   ```bash
   grep -rn "ipcRenderer\.invoke" src/renderer/ --include="*.tsx" --include="*.ts"
   ```
   Must return empty.

## IPC Channels Used
- All channels called from renderer

## DB Schema Changes
- None

## Files in Scope
- `src/renderer/**/*.tsx` and `*.ts` — any file with non-compliant IPC calls

## Frozen Surfaces
- Component layout and UI logic — do not change rendered output
- `src/renderer/types/ipc.ts` — do not modify
- `src/renderer/hooks/useIpcError.ts` — do not modify

## Blocks:
- None

## Blocked By:
- Story 725 (handler compliance) — recommended first but not a hard dependency

## Definition of Done
- [ ] All renderer IPC calls use `useIpcError` + `unwrapIpc`
- [ ] `make tsc` zero errors
- [ ] Vitest no regressions
- [ ] Grep gate returns empty
