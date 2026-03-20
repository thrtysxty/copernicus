# IPC Patterns

## Main Process — handleIpc wrapper

Location: `copernicus/electron/utils/handle-ipc.ts`

```typescript
// ✅ CORRECT — every handler must use handleIpc
ipcMain.handle('foo:bar', (_e, arg) =>
  handleIpc(() => someManager.doThing(arg))
)

// ❌ WRONG — raw throw arrives at renderer as unreadable Electron error string
ipcMain.handle('foo:bar', (_e, arg) => someManager.doThing(arg))
```

`handleIpc` returns `{ ok: true, data: T }` or `{ ok: false, error: string }`.
It logs the error via `electron-log` automatically — do not add separate try/catch.

## Renderer — useIpcError + unwrapIpc

```typescript
import { unwrapIpc } from '../../types/ipc'
import { useIpcError } from '../../hooks/useIpcError'

// Inside a component:
const invoke = useIpcError()

// Invoke and unwrap:
const raw = await invoke<MyType>('foo:bar', arg)
const data = unwrapIpc<MyType>(raw)

// ❌ WRONG — silent error swallow
await window.ipcRenderer.invoke('foo:bar', arg)

// ❌ WRONG — fragile manual unwrap
const bad = (result as any)?.data ?? result
```

`useIpcError` auto-toasts on error. `unwrapIpc` throws if `ok: false` — catch at component level if you need custom error UI.

## Adding a new channel

1. Add channel string to `SEND_CHANNELS` in `copernicus/electron/preload.ts`
2. Register handler in `copernicus/electron/main.ts` using `handleIpc`
3. Call from renderer using `useIpcError` + `unwrapIpc`
4. Run `tsc --noEmit` — zero errors before committing

## Push channels (main → renderer)

Main pushes with: `win.webContents.send('channel:name', payload)`
Renderer listens with: `window.ipcRenderer.on('channel:name', handler)`

Push channels must be in `LISTEN_CHANNELS` in `preload.ts`, not `SEND_CHANNELS`.
