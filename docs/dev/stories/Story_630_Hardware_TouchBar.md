# Story 630 — Hardware Integration & Touch Bar Services

**Status:** APPROVED FOR IMPLEMENTATION
**Assigned To:** Jules
**Blocked By:** Story 628 (command buttons spawn ephemeral PTY sessions; PTY must be stable)
**Sprint:** C — After Story 628 lands
**Priority:** P1

---

## Goal

Wire the Touch Bar view-switcher buttons to actually switch the active view in the
renderer. The Touch Bar renders correctly and telemetry updates, but button presses
do nothing because the renderer is missing the `layout:set-view` IPC listener.

---

## Environment Setup

```bash
cd copernicus && npm install
npx tsc --noEmit   # verify zero errors before touching anything
```

---

## Root Cause Analysis (CONFIRMED)

`copernicus/electron/touch-bar.ts` sends view-switch events via:
```typescript
click: () => window.webContents.send('layout:set-view', v.id),
```

`layout:set-view` IS declared in `RECEIVE_CHANNELS` in `preload.ts` (line 96), so
the channel reaches the renderer. However, **`App.tsx` has no `ipcRenderer.on('layout:set-view', ...)` listener**. The event arrives but nothing handles it.

The three instrument toggles (`layout:toggle-flip`, `layout:toggle-spotlight`,
`layout:toggle-ui-builder`) DO have listeners in `App.tsx` (lines 128–140). The fix
pattern is identical to those.

Command buttons (`make dev`, `make test`, etc.) call `runMakeTarget()` which sends
`terminal:spawn` and calls `ptyManager.createEphemeral`. `terminal:spawn` IS handled in
`App.tsx` and will work correctly once Story 628's PTY fix lands.

---

## Acceptance Criteria

### AC-1: View Buttons — Add `layout:set-view` Listener

**File:** `copernicus/src/renderer/App.tsx`

Inside the existing `useEffect` block that registers IPC listeners (the one that
already handles `layout:toggle-flip`, `layout:toggle-spotlight`, etc.), add:

```typescript
const removeSetViewListener = (window as any).ipcRenderer.on(
  'layout:set-view',
  (_e: any, viewId: string) => {
    setView(viewId as StoryboardView)
  }
)
```

Add `removeSetViewListener` to the return cleanup array alongside the other
`remove*` calls.

Add `setView` to the `useEffect` dependency array if it is not already present.

That is the **entire fix for AC-1**. No other files need to change.

### AC-2: Low-Latency Guarantee

Verify that the `click` handler in `touch-bar.ts` is synchronous:
```typescript
click: () => window.webContents.send('layout:set-view', v.id),
```
`webContents.send` is fire-and-forget (synchronous enqueue). No `await`, no async
chain. This is already correct — confirm by reading `touch-bar.ts` and annotating it
as verified. No code change needed if it is already synchronous.

### AC-3: Active View Highlight Verification

The Touch Bar already updates button `backgroundColor` in the `telemetry:update-touchbar`
handler (`touch-bar.ts:86`). After AC-1 lands, switching views via Touch Bar will:
1. Call `setView(id)` in the renderer store.
2. Trigger the `useEffect` telemetry pusher in `App.tsx` (line 160–170) which sends
   the updated `view` to `telemetry:update-touchbar`.
3. The Touch Bar handler updates `backgroundColor` on the correct button.

Verify this chain is intact. If the telemetry pusher's dependency array does not
include `activeView`, add it. (Inspect line 170 in `App.tsx`.)

---

## Files to Modify

| File | Change |
|------|--------|
| `copernicus/src/renderer/App.tsx` | Add `layout:set-view` listener; verify telemetry `activeView` dependency |

## Files NOT to Modify

- `copernicus/electron/touch-bar.ts` — already correct.
- `copernicus/electron/touch-bar-types.ts` — no changes.
- `copernicus/electron/preload.ts` — `layout:set-view` already in `RECEIVE_CHANNELS`.
- `copernicus/electron/main.ts` — no new handlers needed.
- Any file not listed above.

---

## Definition of Done

1. `cd copernicus && npx tsc --noEmit` passes with zero errors.
2. Only `App.tsx` is modified.
3. The `layout:set-view` listener is in the same `useEffect` block as the other
   layout listeners and its cleanup is in the return function.
4. `setView` is in the `useEffect` dependency array.
5. No forbidden patterns introduced.

---

## Blocks

— (no downstream blockers)

## Blocked By

- Story 628 (command buttons require stable PTY)

## Documentation Impact

- `docs/HARDWARE_GUIDE.md` — Document Touch Bar button mapping: view buttons, command
  tray (make targets), FLIP/SPOT/UI BUILD toggles, telemetry labels.
