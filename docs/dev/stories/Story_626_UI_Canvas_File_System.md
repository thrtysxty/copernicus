# Story 626 — Interactive UI Canvas & File System Integration

**Status:** APPROVED FOR IMPLEMENTATION
**Assigned To:** Gemini
**Blocked By:** —
**Sprint:** C — Parallel with Stories 629, 630
**Priority:** P1

---

## Goal

Fix file-tree click-to-open, Chat attach and flip, UIBuilderCanvas controls,
Workflow Editor focus and button overflow, and make the "bound to story" field editable.

---

## Environment Setup

```bash
cd copernicus && npm install
npx tsc --noEmit   # verify zero errors before touching anything
```

---

## Context

**Correct canonical paths** (all "(Verify)" entries from the stub were wrong):

| Component | Correct Path |
|-----------|-------------|
| UI Builder | `copernicus/src/renderer/components/Editor/ui-builder/UIBuilderCanvas.tsx` |
| File Tree | `copernicus/src/renderer/components/FileTree/FileTree.tsx` |
| Chat Panel | `copernicus/src/renderer/components/chat/ChatPanel.tsx` |
| Workflow Canvas | `copernicus/src/renderer/components/workflow/WorkflowCanvas.tsx` |
| Node Inspector | `copernicus/src/renderer/components/workflow/NodeInspector.tsx` |
| Center Router | `copernicus/src/renderer/components/Editor/CenterPanelRouter.tsx` |

All IPC calls in renderer components must use `useIpcError`. All new handlers in
`main.ts` must use `handleIpc()`.

---

## Acceptance Criteria

### AC-1: File Tree — Click-to-Open in Editor

**File:** `copernicus/src/renderer/components/FileTree/FileTree.tsx`
**File:** `copernicus/src/renderer/components/Editor/CenterPanelRouter.tsx`

File rows in the tree are currently rendered but `onClick` either does nothing or fires
without loading the file. Fix:
1. On file click, call `invoke('fs:read-file', filePath)` to get content.
2. Call `setCenterMode` from the layout store with the appropriate mode:
   - Text/code files → `'code'`
   - Images (`.png`, `.jpg`, `.gif`, `.svg`, `.webp`) → `'image'`
   - Known binary (`.pdf`, `.exe`, `.bin`, `.zip`) → `'binary'`
3. Store the active file path in layout store. Add `activeFilePath: string | null`
   to `LayoutState` and a `setActiveFilePath` action if not already present.
4. `CenterPanelRouter` reads `activeFilePath` and `centerMode` and renders the
   appropriate pane (`MonacoEditor`, `ImageViewer`, or `BinaryBlocker`).

Do not re-implement the file-classification logic if `CenterPanelRouter` already has
it — inspect first.

### AC-2: Chat — File Attach Button

**File:** `copernicus/src/renderer/components/chat/ChatPanel.tsx`

The attach button must:
1. Call `window.ipcRenderer.invoke('fs:open-file')` — wait, no. Use `useIpcError`:
   `await invoke<string | null>('fs:open-file')`. This channel already exists in
   `SEND_CHANNELS`.
2. If a path is returned, read the file content via `invoke('fs:read-file', path)`.
3. Append the file content as a quoted block to the chat textarea, or store it as
   an attachment reference shown as a chip above the input.

### AC-3: Chat — Flip / Rotate Functionality

**File:** `copernicus/src/renderer/components/chat/ChatPanel.tsx`

The Chat panel is wrapped in `FlippablePanel` (from `layout/FlippablePanel.tsx`).
The flip button inside `ChatPanel` should call `toggleFlip('chat')` from the layout
store. Inspect the current button's `onClick` — if it is missing or calls the wrong
paneId, fix it. Verify that `isFlipped['chat']` in the layout store is what
`FlippablePanel` reads to determine which face to show.

### AC-4: Chat — Context Indicator (Permanent)

**File:** `copernicus/src/renderer/components/chat/ChatPanel.tsx`
**File:** `copernicus/src/renderer/components/chat/ContextChip.tsx`

The glowing context indicator chip must not be dismissible by the user. Remove any
close/X button from `ContextChip`. If the chip renders conditionally on some state,
make that state non-nullable (always show the chip when a model is active).

### AC-5: Workflow Editor — Click Focus

**File:** `copernicus/src/renderer/components/workflow/WorkflowCanvas.tsx`

The Workflow Canvas SVG captures pointer events but the inspector/editor pane loses
focus when clicked. Ensure the SVG `<div>` wrapper has `tabIndex={-1}` so focus can
return to child input elements within the inspector when the user clicks into the
editor area. Specifically: clicking the NodeInspector inputs after clicking the canvas
should not lose the input cursor.

### AC-6: Workflow Editor — Save/Reset/Run Button Overflow

**File:** `copernicus/src/renderer/components/workflow/WorkflowCanvas.tsx`

The Save, Reset, and Run buttons overflow the canvas boundary. Place them in a fixed
toolbar strip at the top of the canvas container with `position: sticky` or a dedicated
`<div>` with `flex-shrink-0` above the SVG scroll area. Ensure they are always visible
without scrolling.

### AC-7: Workflow Editor — "Bound to Story" Editable

**File:** `copernicus/src/renderer/components/workflow/NodeInspector.tsx`

The `boundToStoryId` field currently displays as read-only text. Replace it with a
`<select>` or `<input>` that:
1. On mount, loads the story list via `invoke<Story[]>('stories:list')`.
2. Renders a `<select>` with story options (id + title).
3. On change, calls `invoke('workflow:update-node-data', { nodeId, field: 'boundToStoryId', value })`.

If `workflow:update-node-data` IPC does not exist, add it to `main.ts` with `handleIpc()`
and add to `SEND_CHANNELS` in `preload.ts`.

---

## Files to Modify

| File | Change |
|------|--------|
| `copernicus/src/renderer/components/FileTree/FileTree.tsx` | File click → `setCenterMode` + `setActiveFilePath` |
| `copernicus/src/renderer/store/layout.ts` | Add `activeFilePath` + `setActiveFilePath` if absent |
| `copernicus/src/renderer/components/Editor/CenterPanelRouter.tsx` | Route on `activeFilePath` + `centerMode` |
| `copernicus/src/renderer/components/chat/ChatPanel.tsx` | File attach; flip button fix; context chip permanent |
| `copernicus/src/renderer/components/chat/ContextChip.tsx` | Remove dismiss button |
| `copernicus/src/renderer/components/workflow/WorkflowCanvas.tsx` | Button overflow fix; `tabIndex` |
| `copernicus/src/renderer/components/workflow/NodeInspector.tsx` | Editable `boundToStoryId` |
| `copernicus/electron/main.ts` | Add `workflow:update-node-data` if absent |
| `copernicus/electron/preload.ts` | Add new channels if added |

## Files NOT to Modify

- Any file not listed above.

---

## Definition of Done

1. `cd copernicus && npx tsc --noEmit` passes with zero errors.
2. All new `ipcMain.handle()` channels use `handleIpc()` and are in `SEND_CHANNELS`.
3. No bare `window.ipcRenderer.invoke` — all via `useIpcError`.
4. Context chip renders without a dismiss button.
5. Workflow editor buttons visible without scrolling.

---

## Blocks

— (no downstream blockers)

## Blocked By

— (no dependencies)

## Documentation Impact

- `docs/UI_BUILDER.md` — Document UIBuilderCanvas header controls and remove-canvas flow.
- `docs/USER_GUIDE.md` — File Tree, Chat attach, Workflow Editor interactions.
