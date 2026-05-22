# User Story 728: Kanban — Story Search and Filter

**Status:** APPROVED FOR IMPLEMENTATION
**Priority:** P2 — Feature
**Phase:** Sprint 2 — Core UX

## Story Number

728

## Narrative
**As a** Copernicus user with many stories,
**I want** to filter the kanban board by typing a search term,
**So that** I can find a specific story without scrolling through all columns.

## Context

The kanban board renders all stories in their columns. As projects grow, finding a specific
story requires scanning. A live filter that narrows visible cards by title solves this.

Filter applies across all columns simultaneously. Cards not matching are hidden (not removed).
Clearing the filter restores all cards.

## Acceptance Criteria

### Filter Input
1. **Filter input rendered above the kanban board** — a single `<input type="text">` with
   placeholder "Filter stories…" and `data-testid="kanban-filter"`.
2. **Input is always visible** — does not collapse or require a click to reveal.
3. **Clear button** — when the filter has text, a clear (×) button appears inside the input.
   Clicking it clears the filter and restores all cards. `data-testid="kanban-filter-clear"`.

### Filter Behavior
4. **Case-insensitive substring match on story title** — typing "auth" hides all cards whose
   title does not contain "auth" (case-insensitive). Match is on title only, not description.
5. **Live filter** — updates on every keypress, no submit/enter required.
6. **Matching is per-column** — each column shows only its matching cards. Column headers
   remain visible even if a column has 0 matching cards.
7. **Empty filter = all cards visible** — when input is blank, full board is shown.

### Empty State
8. **No-match message per column** — if a column has cards but none match, show
   `"No matches"` in that column (subtle, not an error).

### State
9. **Filter state is local** — does not persist across sessions. A page reload clears it.
10. **Filter does not affect IPC** — filtering is purely client-side on the already-loaded
    story list. No new IPC calls on keypress.

### Accessibility
11. **`aria-label="Filter stories"`** on the input.
12. **Keyboard**: `Escape` clears the filter when the input is focused.

### Tests
13. **Unit test in `src/renderer/__tests__/KanbanFilter.test.tsx`** (or nearest test colocated
    with the component) — test: empty filter shows all cards, typing hides non-matching,
    clear button restores all, case-insensitive match.

## IPC Channels Used
- None (client-side filter only)

## DB Schema Changes
- None

## Files in Scope
- Kanban board component (find by searching `src/renderer/` for the kanban render)
- New filter subcomponent if extracted
- New test file colocated with the filter component (path TBD by implementation)

## Frozen Surfaces
- IPC layer — no new channels
- Story data shape — filter on existing `title` field only

## Blocks:
- None

## Blocked By:
- Story 710 (kanban flow tests) — not a hard dependency, but run 710 first

## Definition of Done
- [ ] Filter input visible above kanban board
- [ ] Live case-insensitive title filtering works
- [ ] Clear button (×) functions
- [ ] Escape key clears filter
- [ ] Unit tests pass
- [ ] `make tsc` zero errors
