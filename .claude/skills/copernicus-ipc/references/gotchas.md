# IPC Gotchas

## 1. Channel not in SEND_CHANNELS → silent fail
Adding a handler in `main.ts` without adding the channel to `SEND_CHANNELS` in `preload.ts` causes the invoke to throw "Channel not allowed". The error appears in the renderer as a toast but the channel silently does nothing.
**Fix:** Always add to `SEND_CHANNELS` first, then add the handler.

## 2. Push channel in SEND_CHANNELS instead of LISTEN_CHANNELS
If main pushes on a channel that is in `SEND_CHANNELS` instead of `LISTEN_CHANNELS`, the `on()` listener will never fire. No error is thrown.
**Fix:** Push channels (main → renderer) go in `LISTEN_CHANNELS`. Request channels (renderer → main) go in `SEND_CHANNELS`.

## 3. Forgetting handleIpc → Electron error string
A handler that throws without `handleIpc` wrapping returns a raw Electron serialized error string, not `{ ok: false, error: "..." }`. `unwrapIpc` then sees a non-IpcResult value and passes it through silently.
**Fix:** Every `ipcMain.handle` uses `handleIpc`. No exceptions.

## 4. Double-wrapping handleIpc
`handleIpc` already catches and returns `{ ok: false }`. If you add an outer try/catch and re-throw, `unwrapIpc` never sees the `ok: false` envelope.
**Fix:** `handleIpc` is the only error boundary in main. Don't wrap it.

## 5. Using window.ipcRenderer.invoke directly in renderer
Bypasses `useIpcError`, so errors are silently swallowed and no toast is shown. Users see broken UI with no feedback.
**Fix:** Always `const invoke = useIpcError()` then `invoke('channel', args)`.

## 6. Not awaiting invoke before unwrapping
`invoke()` returns a Promise. Calling `unwrapIpc` on the Promise object (not the resolved value) always returns the Promise as-is — no error, wrong type.
**Fix:** `const raw = await invoke<T>(...)` then `unwrapIpc<T>(raw)`.

## 7. Duplicate ipcMain.handle for same channel
Electron silently ignores the second registration. The first handler wins. This causes confusing behaviour when refactoring.
**Fix:** Search `ipcMain.handle('channel:name'` before adding a new handler.

## 8. tsc errors after adding a channel
Adding to `SEND_CHANNELS` (a `Set<string>`) requires no type change. But if you're adding a typed payload, update the relevant interface in `copernicus/src/renderer/types/ipc.ts` and run `tsc --noEmit` before committing.
