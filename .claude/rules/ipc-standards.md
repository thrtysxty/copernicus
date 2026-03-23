---
description: Electron IPC handler and renderer call standards
paths:
  - "copernicus/electron/**"
  - "copernicus/src/**"
---
## IPC Error Handling Standard

There is exactly **one canonical version** of `handleIpc` (located in `copernicus/electron/main.ts` or a shared utility). Do NOT create a second implementation.

Every `ipcMain.handle` registration in `copernicus/electron/main.ts` **must** use the `handleIpc()` wrapper:

```typescript
// ✅ Correct
ipcMain.handle('foo:bar', (_e, arg) => handleIpc(() => someManager.doThing(arg)))

// ❌ Wrong — raw throw arrives at renderer as unreadable Electron error string
ipcMain.handle('foo:bar', (_e, arg) => someManager.doThing(arg))
```

Every renderer component that calls IPC **must** use the `useIpcError` hook, never bare `window.ipcRenderer.invoke`, and must unwrap data using `unwrapIpc`:

```typescript
// ✅ Correct
import { unwrapIpc } from '../../types/ipc'
const invoke = useIpcError()
const result = await invoke<MyType>('foo:bar', arg)
const data = unwrapIpc<MyType>(result)

// ❌ Wrong — errors silently swallowed or fragile manual unwrapping
await window.ipcRenderer.invoke('foo:bar', arg)
const badData = (result as any)?.data ?? result
```

These are **non-negotiable** for all new code and all stories written going forward.