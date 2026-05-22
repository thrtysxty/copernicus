# User Story 730: Remove console.log/warn/error from Renderer

**Status:** APPROVED FOR IMPLEMENTATION
**Priority:** P2
**Type:** Code Quality

## Blocks:
(none)

## Blocked By:
(none)

## Goal

Remove or replace the 10 `console.log/warn/error` calls found in the renderer with the existing `log` utility (from `electron-log` or the renderer's `log` import). Production builds should not emit raw console output.

## Files in Scope

Determined by running:
```bash
grep -rn "console\.log\|console\.warn\|console\.error" copernicus/src/renderer/ --include="*.tsx" --include="*.ts" | grep -v "node_modules" | grep -v ".test.ts"
```

## Acceptance Criteria

1. `grep -rn "console\.log\|console\.warn\|console\.error" copernicus/src/renderer/ --include="*.tsx" --include="*.ts" | grep -v "node_modules" | grep -v ".test.ts"` returns empty (zero matches)
2. Each removed `console.*` call is either deleted (if debug-only noise) or replaced with the renderer's `log` utility (`import log from 'electron-log/renderer'` or the project's existing log import pattern)
3. Check what import is already used in that file first — match the existing log import pattern; do not introduce a new import if the file already has one
4. `npx tsc --noEmit` passes with zero errors after changes
5. No behavior change — only logging destination changes

## Notes

- Check each call site: if it's a genuine error that should be visible, keep it as `log.error()`; if it's debug output, delete it
- Do not add `eslint-disable` comments — fix the underlying call
