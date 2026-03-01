# Story 627 — Blueprint & Kanban Logic Refinement

**Status:** APPROVED FOR IMPLEMENTATION
**Assigned To:** Jules
**Blocked By:** —
**Sprint:** B — Parallel with Story 624
**Priority:** P1

---

## Goal

Fix the Blueprint Editor mode so it opens a full-pane story editor (not a navigation
event), correct the column rotate behaviour, and replace the 6-column initialiser with
9 professional swimlanes.

---

## Environment Setup

```bash
cd copernicus && npm install
npx tsc --noEmit   # verify zero errors before touching anything
```

---

## Context

**There is no `BlueprintEditor.tsx` component.** Do not create one.
The correct entry point for story editing is:
`copernicus/src/renderer/components/planning/StoryDetail.tsx`

Kanban column state lives in:
`copernicus/src/renderer/store/layout.ts` → `columns: KanbanColumn[]`

The existing `handleOpenInEditor()` in `StoryDetail.tsx` calls `stories:hydrate`
which opens the story `.md` file in Monaco and then calls `setDrawerStory(null)` —
closing the drawer entirely. The user expects full-pane story editing within the
Blueprint view, not a handoff to Monaco.

---

## Acceptance Criteria

### AC-1: Blueprint Editor Button — Full-Pane Mode

**File:** `copernicus/src/renderer/components/planning/StoryDetail.tsx`

Replace the current `handleOpenInEditor` behaviour:

**Current (wrong):**
```typescript
const handleOpenInEditor = async () => {
  await invoke('stories:hydrate', storyId)
  setDrawerStory(null)              // ← closes drawer, loses story context
}
```

**Required:**
The "Editor" button must expand `StoryDetail` to fill the right panel and collapse the
Kanban columns. Implement by calling:
```typescript
setSpotlight('telemetry')  // spotlights the right panel (full height)
```
Do **not** call `setDrawerStory(null)`. Do **not** call `stories:hydrate`.
The textarea edit mode (`setIsEditing(true)`) should activate automatically when
spotlight is engaged — add `useEffect` that sets `isEditing = true` when
`spotlightPane === 'telemetry'` and `storyId` is set.

Add an "Exit Editor" button (visible only when spotlit) that calls:
```typescript
setSpotlight(null)
setIsEditing(false)
```

### AC-2: Kanban — 9 Professional Swimlanes

**File:** `copernicus/src/renderer/store/layout.ts`

Replace the current 6-column `columns` initialiser with 9 professional lanes:

```typescript
columns: [
  { id: 'Planning',    status: 'PLANNING',    color: 'bg-slate-500/5 border-slate-500/20',   accent: 'bg-slate-500' },
  { id: 'UI Design',   status: 'DESIGN',      color: 'bg-purple-500/5 border-purple-500/20', accent: 'bg-purple-500' },
  { id: 'Blueprint',   status: 'READY',       color: 'bg-blue-500/5 border-blue-500/20',     accent: 'bg-blue-500' },
  { id: 'Development', status: 'IN PROGRESS', color: 'bg-yellow-500/5 border-yellow-500/20', accent: 'bg-yellow-500' },
  { id: 'Testing',     status: 'TESTING',     color: 'bg-orange-500/5 border-orange-500/20', accent: 'bg-orange-500' },
  { id: 'QA / Review', status: 'REVIEW',      color: 'bg-amber-500/5 border-amber-500/20',   accent: 'bg-amber-500' },
  { id: 'Documenting', status: 'DOCUMENTING', color: 'bg-cyan-500/5 border-cyan-500/20',     accent: 'bg-cyan-500' },
  { id: 'Staging',     status: 'STAGING',     color: 'bg-teal-500/5 border-teal-500/20',     accent: 'bg-teal-500' },
  { id: 'Done',        status: 'COMPLETE',    color: 'bg-green-500/5 border-green-500/20',   accent: 'bg-green-500' },
],
```

**IMPORTANT:** This changes the default initialiser only. Persisted state (from
`localStorage` via Zustand `persist`) will retain the old 6 columns for existing
installations. Add a migration guard: if `columns.length < 9`, reset to the new
default:

```typescript
// In the persist config's `onRehydrateStorage` or a useEffect in App.tsx on first load:
if (useLayoutStore.getState().columns.length < 9) {
  useLayoutStore.getState().setColumns(DEFAULT_COLUMNS)
}
```

Export a `DEFAULT_COLUMNS` constant from `layout.ts` for use in the migration guard.

### AC-3: Column Rotate — Correct Behaviour

**File:** `copernicus/src/renderer/components/KanbanBoard.tsx`

The current rotate/arrow button calls `rotateColumn()` from the layout store, which
moves the column to the end of the array. The user expects this button to **cycle the
column to the next position** (wrapping), not append it to the end.

Inspect the current `rotateColumn` implementation in `layout.ts`. If it moves the
column to the absolute end, change it to move it one position forward (and wrap to
position 0 when it's already last):

```typescript
// In layout.ts actions:
rotateColumn: (id: string) => set((state) => {
  const cols = [...state.columns]
  const idx = cols.findIndex(c => c.id === id)
  if (idx === -1) return state
  const [col] = cols.splice(idx, 1)
  const nextIdx = (idx + 1) % (cols.length + 1)
  cols.splice(nextIdx, 0, col)
  return { columns: cols }
}),
```

If `rotateColumn` does not exist yet, add it to `LayoutState` interface, add it to
the actions in `create()`, and wire the button in `KanbanBoard.tsx` to call it.

---

## Files to Modify

| File | Change |
|------|--------|
| `copernicus/src/renderer/components/planning/StoryDetail.tsx` | Full-pane spotlight mode; remove `stories:hydrate` from editor button |
| `copernicus/src/renderer/store/layout.ts` | 9-lane default; `DEFAULT_COLUMNS` export; `rotateColumn` action; migration guard hook |
| `copernicus/src/renderer/components/KanbanBoard.tsx` | Wire rotate button to `rotateColumn`; migration guard call on mount |

## Files NOT to Modify

- `copernicus/electron/main.ts` — no new IPC needed.
- `copernicus/electron/preload.ts` — no new channels.
- Do NOT create `BlueprintEditor.tsx` or any new component file.

---

## Definition of Done

1. `cd copernicus && npx tsc --noEmit` passes with zero errors.
2. `DEFAULT_COLUMNS` is exported from `layout.ts` and has exactly 9 entries.
3. Migration guard in `KanbanBoard.tsx` resets columns for existing users.
4. `StoryDetail` Editor button spotlights the panel; does not close the drawer.
5. Column rotate advances the column one position (wraps).
6. No forbidden patterns introduced.

---

## Blocks

— (no downstream blockers)

## Blocked By

— (no dependencies)

## Documentation Impact

- `docs/KANBAN_WORKFLOW.md` — Document the 9 professional swimlanes and their status values.
- `docs/USER_GUIDE.md` — Blueprint Editor full-pane mode and how to exit it.
