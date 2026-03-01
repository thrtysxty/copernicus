# Story 624 — Header & Layout Integrity Refinement

**Status:** APPROVED FOR IMPLEMENTATION
**Assigned To:** Jules
**Blocked By:** —
**Sprint:** B — Parallel with Story 627
**Priority:** P1

---

## Goal

Fix CapEx rate inconsistency (hardcoded `$150` vs wizard-configured `$65`), resolve
header overflow/layout bugs, fix the Monaco Editor FOUC, identify CMD+P, and remove
hardcoded data from the Engine Room view.

---

## Environment Setup

```bash
cd copernicus && npm install
npx tsc --noEmit   # verify zero errors before touching anything
```

---

## Root Cause Analysis

### CapEx Rate Bug (CONFIRMED)

`copernicus/src/renderer/components/capex/CapexDashboard.tsx:84`:
```typescript
const [rate, setRate] = useState(150)   // ← hardcoded; wizard saves 65
```

The Wizard calls `save-preferences` with `{ capex: { rate: 65, currency: 'USD' } }`.
`main.ts` persists this to `settings.json` via `saveSettings()`. The settings are
readable via the existing `settings:load` IPC channel.

**Fix:** On mount, call `settings:load`, read `capex.rate`, and initialise `rate` from
it. Fall back to `65` if the key is absent.

### Header Overflow

The application header is **inline in `App.tsx`** (around line 257) — there is no
separate `Header.tsx`. The `<header>` element uses `flex items-center justify-between`.
The stoplight buttons (close/minimise/zoom) are positioned absolutely by Electron;
the `draggable` region starts at `x=0`. If the first flex child starts at `x=0` too,
the stoplight buttons overlap it.

**Fix:** Add `pl-20` (80 px) to the `<header>` element's className in `App.tsx` to
give the stoplight buttons their native 72 px landing zone on macOS. This is the
standard macOS frameless-window padding.

### Workflow Link Overflow in Header

The view-switcher buttons inside `<header>` (blueprint / studio / engine-room) are
mapped over `['blueprint', 'studio', 'engine-room']` and have no `min-width` or
`overflow: hidden` guard. With `pl-20` added above they should fit; verify and add
`flex-shrink-0` to each button if they still collapse.

### Studio Button — Pane Arrangement

When the user clicks "Studio" in the header, `setView('studio')` is called but the
left/right panels may not rearrange. **Studio** = canvas (left) + chat (right).

After `setView('studio')`, also call:
```typescript
setCenterMode('code')
setLeftPanelMode to 'explorer'    // or whatever Studio expects
```
Read what the current Studio layout is supposed to show by inspecting which panes
render when `activeView === 'studio'` in `App.tsx`. Do not invent a new pane layout —
only match the intent already coded.

### Monaco Editor FOUC

**File:** `copernicus/src/renderer/components/Editor/MonacoEditor.tsx`

Monaco initialises with the default light theme, then the theme-switch fires after
mount. Fix: pass `theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'vs-dark' : 'vs'`
to the Monaco `options` prop (or the `defaultLanguage`/`theme` prop on `<Editor />`
from `@monaco-editor/react`) so the correct theme is applied before first paint.

### CMD+P Button

The `layout:open-palette` channel is already in `RECEIVE_CHANNELS` in `preload.ts`.
`CommandPalette` component exists at:
`copernicus/src/renderer/components/layout/CommandPalette.tsx`

**Fix:** In `App.tsx`, add a listener for `layout:open-palette` that toggles the
CommandPalette open state. In the header, label the CMD+P button "CMD+P" or use the
palette icon from lucide-react; wire its `onClick` to open the CommandPalette.
Add a keyboard shortcut listener for `Meta+P` (macOS) that does the same.

### Report Tabs Width

**File:** `copernicus/src/renderer/components/capex/CapexDashboard.tsx`

The report/tab row overflows vertically before filling the full width. Ensure the tab
container uses `flex w-full overflow-x-auto` (horizontal scroll before wrap). Remove
any `flex-wrap` that causes premature vertical overflow.

### Engine Room — Remove Hardcoded Data

**File:** `copernicus/src/renderer/App.tsx` (engine-room view branch)

Any `<p>` or `<span>` elements with literal story IDs, story counts, or cost values
must be replaced with live data from the layout store or an IPC call. Specifically:
- Story count → `invoke('stories:list')` length.
- CapEx total → `capexTotal` from `useLayoutStore`.
- Active model → `invoke('models:active')` result.

Do not fabricate data. If a live data source is not available yet, show `—` rather
than a hardcoded value.

### Spotlight Buttons

**File:** `copernicus/src/renderer/components/layout/SpotlightContainer.tsx`

Verify the shrink/expand buttons call `setSpotlight(paneId)` / `setSpotlight(null)`
from the layout store. If the buttons call these correctly but still don't work, the
issue is likely that `spotlightPane` state is not propagating to the pane container's
CSS class. Fix the class binding in the pane that hosts the spotlight container.

---

## Acceptance Criteria

- [ ] `CapexDashboard` reads `capex.rate` from `settings:load` on mount; displays the
      wizard-configured value (e.g. `$65`), not `$150`.
- [ ] Stoplight buttons do not overlap any header content (header has `pl-20`).
- [ ] Workflow links in header do not overflow stoplight zone.
- [ ] Studio header button opens the correct canvas + chat pane arrangement.
- [ ] Monaco Editor renders in `vs-dark` on first paint (no white flash) when system
      is in dark mode.
- [ ] CMD+P button in header is labelled and opens `CommandPalette`. `Meta+P` shortcut
      also opens it.
- [ ] Report tabs fill the full horizontal width before vertical scroll.
- [ ] Engine Room view shows no hardcoded story IDs, counts, or cost values.
- [ ] Spotlight shrink/expand buttons are functional in Editor and Canvas views.
- [ ] `npx tsc --noEmit` passes with zero errors.

---

## Files to Modify

| File | Change |
|------|--------|
| `copernicus/src/renderer/components/capex/CapexDashboard.tsx` | Read `capex.rate` from `settings:load` |
| `copernicus/src/renderer/App.tsx` | `pl-20` on header, CMD+P listener, Engine Room live data |
| `copernicus/src/renderer/components/Editor/MonacoEditor.tsx` | Pre-set `vs-dark` theme |
| `copernicus/src/renderer/components/layout/SpotlightContainer.tsx` | Verify / fix spotlight button wiring |

## Files NOT to Modify

- `copernicus/electron/main.ts` — no new IPC needed; `settings:load` already exists.
- `copernicus/electron/preload.ts` — `layout:open-palette` already in `RECEIVE_CHANNELS`.
- Any file not listed above.

---

## Definition of Done

1. `cd copernicus && npx tsc --noEmit` passes with zero errors.
2. No new IPC channels added (all required channels already exist).
3. No bare `window.ipcRenderer.invoke` — all renderer IPC via `useIpcError`.
4. Only files listed above are modified.

---

## Blocks

— (no downstream blockers)

## Blocked By

— (no dependencies)

## Documentation Impact

- `docs/USER_GUIDE.md` — Document CMD+P / CommandPalette.
- `docs/UI_GUIDELINES.md` — Add standard: frameless macOS window headers require `pl-20`
  to clear the stoplight zone.
