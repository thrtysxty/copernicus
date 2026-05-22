# story_722: Worktree Handlers Security Tests

**Status:** APPROVED FOR IMPLEMENTATION

## Scope

- `src/tests/worktree-handlers.test.ts`

## Definition of Done

- Tests pass: `npm run test`
- Zero lint errors

## Acceptance Criteria

### Path Validation

- Path inputs validated against allowed roots
- `../` sequences rejected

### Shell Safety

- No shell metachar passthrough

### Worktree Creation

- worktree:create outside root → `{ ok: false }`
