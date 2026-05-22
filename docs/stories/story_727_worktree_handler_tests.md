# User Story 727: Worktree Handler Tests

**Status:** APPROVED FOR IMPLEMENTATION
**Priority:** P1 — Core flow coverage
**Phase:** Sprint 1 — Core Flow Tests

## Story Number

727

## Narrative
**As a** Copernicus developer,
**I want** unit tests for the worktree IPC handlers,
**So that** the branch/worktree lifecycle — the foundation of agent dispatch — is protected from regressions.

## Context

`electron/ipc/worktree-handlers.ts` manages git worktrees for agent sessions:
- Create a worktree on a feature branch
- List active worktrees
- Remove a worktree after merge
- Get worktree status

There are no tests for this handler. It is exercised only by E2E tests today. Unit tests
let us catch regressions without spinning up the full Electron app.

## Acceptance Criteria

### Test File
1. **`electron/ipc/worktree-handlers.test.ts` created** — follows the pattern of
   `electron/ipc/story-handlers.test.ts` (mock the manager, test the IPC contract).
2. **`WorktreeManager` (or equivalent) mocked** — tests must not touch the filesystem or git.

### Discovery Step
3. **Read `electron/ipc/worktree-handlers.ts` first** — identify the actual IPC channels
   registered and the manager methods they call. Build tests against the real implementation.

### Create / List Tests
4. **`worktree:create` happy path** — call with `{ storyNumber: 1, branchName: 'story/001' }`,
   assert `{ ok: true, data: { path: <string>, branch: 'story/001' } }`.
5. **`worktree:create` duplicate** — if a worktree already exists for that branch, assert
   `{ ok: false, error: <message> }` (no throw).
6. **`worktree:list`** — mock returns 2 worktrees, assert response contains both with correct shape.

### Remove Tests
7. **`worktree:remove` happy path** — call with valid path/branch, assert `{ ok: true }` and
   manager's remove method was called with correct args.
8. **`worktree:remove` nonexistent** — assert `{ ok: false, error: <message> }`.

### Status Test
9. **`worktree:status`** (if channel exists) — assert shape of returned status object.

### Gate
10. **`make tsc` passes**.
11. **All tests green** — `npx vitest run electron/ipc/worktree-handlers.test.ts`.

## IPC Channels Used
- `worktree:create`
- `worktree:list`
- `worktree:remove`
- `worktree:status` (if registered)

## DB Schema Changes
- None

## Files in Scope
- `electron/ipc/worktree-handlers.test.ts` (new)
- No production code changes

## Frozen Surfaces
- `electron/ipc/worktree-handlers.ts` — do not modify; only test

## Blocks:
- Story 719 (E2E agent run) — worktree tests should pass before E2E dispatch test

## Blocked By:
- Story 709 (IPC envelope tests) — logically prior, not a hard dependency

## Definition of Done
- [ ] `electron/ipc/worktree-handlers.test.ts` created with 6+ passing tests
- [ ] `make tsc` zero errors
- [ ] All mocked — no filesystem or git access in tests
