# story_734: E2E Story Creation

**Status:** READY
**Priority:** P0 — RC gate

## Narrative
**As a** Copernicus user,
**I want** to create a story through the UI and see it appear on the kanban,
**So that** the full story-creation path is verified end-to-end.

## Context

`stories:create` IPC creates a `.md` file in the workspace stories directory and returns the new story ID.
The kanban should re-render to show the new card. This tests the most common user action in Copernicus.

## Acceptance Criteria

### Create via IPC
1. Invoke `stories:create` via `window.evaluate()` with `{ title: "RC Test Story", type: "feature" }`
2. IPC returns `{ ok: true, data: { id: "story_XXX", ... } }` — captures the new story ID

### Disk Write
3. File `story_XXX.md` exists in `e2eHome/workspace/docs/stories/` after creation
4. File contains `**Status:** READY` (or equivalent initial status)

### Kanban Visibility
5. After `stories:sync`, the new story card appears: `window.getByTestId('story-card-story_XXX')` count > 0

### Delete / Cleanup
6. Invoke `stories:delete` with the captured ID — file removed from disk
7. After `stories:sync`, card no longer visible

### Screenshot
8. `window.screenshot({ path: screenshotPath('story-create-e2e'), fullPage: true })` after step 5

## Files in Scope
- `e2e/story-create.spec.ts` (new)

## Frozen Surfaces
- `stories:create`, `stories:sync`, `stories:delete` channel names

## Blocked By
- None

## Blocks
- story_737 (RC gate)

## Gate
```
npx playwright test e2e/story-create.spec.ts 2>&1 | tail -10
```

## Definition of Done
- [ ] `e2e/story-create.spec.ts` created
- [ ] `stories:create` returns ok: true with ID
- [ ] File written to disk
- [ ] Card visible on kanban
- [ ] Cleanup (delete + sync) verified
- [ ] Playwright test passes
