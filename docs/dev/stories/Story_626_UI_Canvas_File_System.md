# User Story: Interactive UI Canvas & File System Integration (ID: 626)

## Actor
The End User and Developer.

## Goal
Improve user interaction and functionality of the UI Builder, File System integration, and Chat features.

## Acceptance Criteria
- [ ] UI Builder Canvas: Add header, rotate, and shrink buttons. Ensure the canvas can be removed after flipping.
- [ ] File Tree: Files in project/repo folder trees are clickable and load correctly in the Editor.
- [ ] Chat: File attach button is functional.
- [ ] Chat: Rotation (flip) functionality is fixed.
- [ ] Chat: Header glowing context indicator is made permanent (cannot be removed) or properly documented.
- [ ] Workflow Editor: Maintain object/click focus so users can interact with the editor pane.
- [ ] Workflow Editor: Fix overflow for Save/Reset/Run buttons.
- [ ] Workflow Editor: "Bound to story" field is made editable.

## Documentation Impact
- Update `UI_BUILDER.md` to document the new canvas controls and removal process.
- Update `USER_GUIDE.md` for Chat and File Tree interactions.

## Canonical Paths
- UI Builder Component: `copernicus/src/renderer/components/UIBuilder.tsx`
- File Tree Component: `copernicus/src/renderer/components/FileTree.tsx`
- Chat Component: `copernicus/src/renderer/components/Chat.tsx`
- Workflow Editor Component: `copernicus/src/renderer/components/WorkflowEditor.tsx`
