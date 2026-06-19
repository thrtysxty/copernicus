---
title: 'story_735: Coverage Gate'
status: READY
priority: P1
type: Unknown
epic: null
assigned_to: (unassigned)
workflow_id: (none)
date: ''
flagged: false
blocked_by: []
blocks:
  - story_737
--- 

# story_735: Coverage Gate

**Status:** READY
**Priority:** P1 — RC quality gate

## Narrative
**As a** Copernicus maintainer,
**I want** enforced coverage minimums in CI,
**So that** critical paths cannot regress without failing the gate.

## Context

Backend uses pytest-cov (already installed). Frontend uses vitest with `--coverage`.
This story adds thresholds and a `make ci-coverage` target that fails on a miss.

## Acceptance Criteria

### Backend (pytest)
1. `.coveragerc` sets:
   - `[report] fail_under = 65`
   - `[run] source = backend`
   - `omit = backend/tests/*, */migrations/*`
2. `make test` already runs with `--cov` — no change needed to test command
3. `python -m pytest backend/tests/ --cov=backend --cov-fail-under=65` passes

### Frontend (vitest)
4. `vitest.config.ts` or `vite.config.ts` adds coverage thresholds:
   - `lines: 60, functions: 60, branches: 55`
   - `reporter: ['text', 'lcov']`
5. `npm run test -- --coverage` passes with thresholds satisfied

### Makefile
6. `make ci-coverage` target added:
   ```
   ci-coverage:
       python -m pytest backend/tests/ --cov=backend --cov-fail-under=65 -q
       npm run test -- --coverage --reporter=verbose
   ```
7. `make ci-coverage` exits 0

## Files in Scope
- `.coveragerc`
- `vitest.config.ts` or `vite.config.ts` (coverage section only)
- `Makefile` (add `ci-coverage` target)

## Frozen Surfaces
- `make test` — do not change existing target behavior
- Existing vitest test files

## Blocked By
- None

## Blocks
- story_737 (RC gate)

## Gate
```
make ci-coverage 2>&1 | tail -15
```

## Definition of Done
- [ ] `.coveragerc` with `fail_under = 65`
- [ ] vitest config has coverage thresholds
- [ ] `make ci-coverage` exits 0
