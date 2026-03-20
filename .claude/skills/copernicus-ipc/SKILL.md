---
name: copernicus-ipc
description: Use when writing or reviewing ANY Electron IPC code in Copernicus — new ipcMain handlers, renderer invoke calls, adding channels to preload.ts, or debugging IPC errors. Enforces the handleIpc/unwrapIpc/useIpcError contract.
---

# Copernicus IPC Patterns

Read `references/patterns.md` before writing any IPC code.
Read `references/channels.md` before adding a new channel.
Read `references/gotchas.md` before reviewing or debugging IPC.

## The Three Rules

1. Every `ipcMain.handle` in `main.ts` MUST use `handleIpc()` wrapper
2. Every renderer invoke MUST use `useIpcError()` hook, never bare `window.ipcRenderer.invoke`
3. Every result from `useIpcError()` MUST be unwrapped with `unwrapIpc<T>()`

If you see code that violates any of these three rules, flag it as a blocking defect before continuing.
