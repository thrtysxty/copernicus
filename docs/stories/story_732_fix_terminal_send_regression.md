# User Story 732: Fix sendToTerminal IPC Regression from Story 726

## Story Number
732

**Status:** IN PROGRESS
**Priority:** P1
**Type:** Bug Fix

## Blocks:
(none)

## Blocked By:
726

## Goal

Story 726 changed `ipcRenderer.send('terminal-write', ...)` to `ctx.invoke('terminal:write', ...)` in `commands.ts`. This breaks terminal command dispatch because `terminal-write` is registered with `ipcMain.on` (not `ipcMain.handle`) and does not respond to `invoke`. Restore correct send semantics.

## Files in Scope

- `copernicus/src/renderer/commands/commands.ts`
- `copernicus/src/renderer/commands/registry.ts`
- `copernicus/src/renderer/components/chat/useChatPanel.ts`

## Acceptance Criteria

1. Read `electron/preload.ts` lines 1–60 to confirm `terminal-write` is in `SEND_CHANNELS` (it is — do not modify preload.ts)
2. Add a `send: (channel: string, ...args: unknown[]) => void` method to `CommandContext` interface in `registry.ts`
3. In `commands.ts`, `sendToTerminal` uses `ctx.send('terminal-write', { id: terminalId, data: text + '\r' })` — NOT invoke
4. In `useChatPanel.ts`, pass `send` to the `CommandContext` object alongside `invoke`. Use `window.ipcRenderer.send` or the preload-exposed send method
5. `npx tsc --noEmit` passes with zero errors after changes
6. The `sendToTerminal` function signature is `(terminalId: string, text: string, ctx: CommandContext)` — use `ctx.send` not a bare `invoke`

## Reference

- `terminal-write` registered: `electron/ipc/terminal-handlers.ts:34` — `ipcMain.on('terminal-write', ...)`
- `terminal-write` allowlisted: `electron/preload.ts:32` — in `SEND_CHANNELS`
- Current broken call (from story 726): `invoke('terminal:write', { id: terminalId, data: text + '\r' }).catch(...)`

## Definition of Done

- All 6 ACs pass
- `ctx.send` used for terminal-write, not invoke
- `npx tsc --noEmit` exits 0
