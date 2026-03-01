# User Story: Blueprint & Kanban Logic Refinement (ID: 627)

## Actor
The End User and Developer.

## Goal
Standardize Kanban workflow behavior and ensure professional naming conventions across the Blueprint system.

## Acceptance Criteria
- [ ] Blueprint Editor: Clicking the "Blueprint Editor" button correctly rotates the story/card into a full-pane editor mode and collapses columns, instead of just navigating back to Kanban.
- [ ] Kanban Swimlanes: Implement a default set of 9 professional swimlanes (e.g., Planning, UI Design, Development, Testing, etc.) as originally planned.
- [ ] Blueprint Rotation: Fixing the column rotate button so it doesn't just move columns to the end of the line, but performs the expected rotation/flip.

## Documentation Impact
- Update `KANBAN_WORKFLOW.md` to reflect the new swimlane names and Blueprint Editor interactions.
- Ensure the `USER_GUIDE.md` section on Stories reflects the Editor Mode transition.

## Canonical Paths
- Kanban Component: `copernicus/src/renderer/components/Kanban.tsx`
- Blueprint Editor: `copernicus/src/renderer/components/BlueprintEditor.tsx`
- Swimlane Config: `copernicus/src/renderer/store/kanban.ts`
