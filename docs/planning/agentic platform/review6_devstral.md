# Code Review 6 — Devstral (React / UI / Tailwind)
**Sprint:** Stories 273–279 + hardening fixes
**Date:** 2026-03-09

---

## Findings

**[HIGH]** `copernicus/src/renderer/components/Terminal/TerminalTabs.tsx:113,120` — `window.ipcRenderer.send('layout:toggle-flip', 'terminal')` — the `send` method fires one-way IPC with no handler registration on the main process side for these channels. The layout toggle for panels is managed in renderer state (Zustand store), not via main process IPC. These buttons will silently do nothing even if `.send` is available. → Call the Zustand store action directly: `const toggleFlip = useLayoutStore(s => s.toggleFlip)` and use `onClick={() => toggleFlip('terminal')}`.

**[MEDIUM]** `copernicus/src/renderer/App.tsx:347-367` — The header uses `position: relative` with an absolutely-centered title span. The `pointer-events-none` on the title is correct. However, the right-side `ml-auto` div with `max-w-[40%]` can still overlap the centered title when the project name + story ID are long — the absolute-positioned title sits under the right div in z-order. On narrow windows (< 800px) the right metadata will visually collide with the centered label. → Consider `pointer-events-none` on title span + verify at 800px viewport width that they don't visually overlap.

**[MEDIUM]** `copernicus/src/renderer/components/KanbanBoard.tsx:252-261` — The Archive bar (`px-3 py-1.5`) is always rendered above the swim lanes even when empty. This adds ~32px of vertical space to the Kanban view at all times — visible even when archive is irrelevant. → Consider only showing the bar when there are archived stories, or style it as a minimal 24px border strip that doesn't compete visually with the swim lanes.

**[MEDIUM]** `copernicus/src/renderer/store/layout.ts` — `DEFAULT_COLUMNS` now uses `/10` background and `/30` border. The planning column with `bg-slate-500/10` renders as near-invisible on `#050505` background. `slate-500` at 10% opacity on near-black is `~rgb(22,23,24)` — essentially invisible. Columns with warmer hues (amber, green) benefit more. The brightest column in the board should be audited against the `#050505` background. → Consider `/15` for cool-toned columns (slate, indigo) and keep `/10` for warmer ones, or use a minimum visible opacity per hue.

**[LOW]** `copernicus/src/renderer/components/KanbanBoard.tsx:319` — Column header is `h-9` but `PanelHeader` elsewhere is now `h-8` (per Story 276). The Kanban column headers are 1px taller than all other panel headers, which will be noticeable if they ever sit adjacent to each other. → Change `h-9` to `h-8` in the column header div.

**[LOW]** `copernicus/src/renderer/components/KanbanBoard.tsx:124` — `ArchiveList` is defined as a component inside the module but outside `KanbanBoard`. The `invoke` prop is typed as `any`. → Type it as `ReturnType<typeof useIpcError>` for correct inference.

**[LOW]** `copernicus/src/renderer/components/FileTree/FileTree.tsx:173` — Icons changed from `opacity-0` to `opacity-60`. This is correct per AC. However the FileTree uses `group-hover/tree` for the parent group — confirm the parent div still has `group/tree` class (not just `group`) otherwise `group-hover/tree:opacity-100` will not trigger. → Verify the parent container has `className="... group/tree ..."`.

**[INFO]** `copernicus/src/renderer/components/layout/ActivityBar.tsx` — Telemetry and Agent Memory moved to top group. The shortcuts `⌘6` and `⌘7` remain on these items. With them in the top group alongside ⌘1–⌘5, the shortcut sequence 1–7 is now contiguous and logical. No regression. ✓

**[INFO]** `copernicus/src/renderer/App.tsx:453` — `TERMINAL_PULSE` label on the toggle button was intentionally kept (it's the toggle button, not the removed Pulse indicator bar). Story 278 removed the animated `h-[1px]` underbar inside TerminalTabs — correctly done. The toggle button text is a separate element and its retention is correct. ✓
