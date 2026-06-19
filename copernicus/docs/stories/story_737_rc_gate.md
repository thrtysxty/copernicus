---
title: 'story_737: RC Gate — `make rc-check`'
status: READY
priority: P0
type: Unknown
epic: null
assigned_to: (unassigned)
workflow_id: (none)
date: ''
flagged: false
blocked_by:
  - story_721
  - story_733
  - story_734
  - story_735
  - story_736
blocks: []
--- 

# story_737: RC Gate — `make rc-check`

**Status:** READY
**Priority:** P0 — release gate

## Narrative
**As a** Copernicus maintainer,
**I want** a single `make rc-check` command that runs all gates,
**So that** the release candidate status is unambiguous: one command, exit 0 = green.

## Context

This is the capstone story for the Copernicus v1 RC. It adds no new tests — it wires
existing gates into a single ordered runner with a pass/fail summary. All upstream stories
(721-736) must be complete before this gate can pass.

## RC Definition

Copernicus v1 RC is GREEN when:
1. `npx tsc --noEmit` — zero TypeScript errors
2. `make test` (pytest) — all backend tests pass
3. `npm run test` (vitest) — all IPC/unit tests pass
4. `make ci-coverage` — backend ≥65%, frontend ≥60%
5. `make test-e2e` (Playwright) — all E2E specs pass (story wizard, kanban drag, agent run, chat, story create)
6. `make dist` — DMG produced and mountable

## Acceptance Criteria

### Makefile Target
1. `make rc-check` added to Makefile, runs gates in this order:
   1. `npx tsc --noEmit`
   2. `python -m pytest backend/tests/ -q`
   3. `npm run test -- --run`
   4. `make ci-coverage`
   5. `npx playwright test`
2. Each step prints a clear header: `=== [N/6] TSC ===`, `=== [2/6] pytest ===`, etc.
3. On first failure, print `RC CHECK FAILED at step N` and exit non-zero
4. On full pass, print `RC CHECK PASSED — Copernicus v1 ready` and exit 0

### Gate
5. `make rc-check` exits 0 when all 6 gates pass

## Files in Scope
- `Makefile` (add `rc-check` target)

## Frozen Surfaces
- All individual gate commands — `rc-check` calls them, does not redefine them

## Blocked By
- story_721, story_722 (security tests)
- story_733 (chat E2E)
- story_734 (story create E2E)
- story_735 (coverage gate)
- story_736 (DMG build)

## Blocks
- None — this is the RC capstone

## Gate
```
make rc-check 2>&1 | tail -10
```

## Definition of Done
- [ ] `make rc-check` target in Makefile
- [ ] Runs all 6 gates in order with headers
- [ ] Exits 0 on full pass, non-zero on first failure
- [ ] `make rc-check` passes on clean codebase
