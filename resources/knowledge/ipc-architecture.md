# Architecture: IPC Envelope

All communication between the Electron main process and renderer uses a strict IPC envelope pattern.

## The Pattern

Every `ipcMain.handle` call goes through `handleIpc()`, which returns:

```typescript
{ ok: true, data: T }       // Success
{ ok: false, error: string } // Failure
```

Every renderer call uses `useIpcError()` + `unwrapIpc()` to unwrap the result or throw.

## Why This Matters

- **No unhandled promise rejections** — Every IPC call has a defined success/failure path
- **Type safety** — TypeScript enforces the envelope at compile time
- **Consistent error messages** — All errors flow through the same channel

## Adding a New IPC Channel

1. Define the channel name in the appropriate handler file under `electron/ipc/`
2. Use `handleIpc()` on the main process side
3. Use `useIpcError()` + `unwrapIpc()` on the renderer side
4. The TypeScript compiler will catch mismatches

## Handler Modules

| File | Handles |
|------|---------|
| `chat-handlers.ts` | Chat, streaming, model calls |
| `model-handlers.ts` | Model registry, provider discovery |
| `story-handlers.ts` | Kanban CRUD, status updates |
| `workflow-handlers.ts` | Workflow engine, snapshots |
| `browser-handlers.ts` | Playwright automation |
| `daemon-handlers.ts` | Agent dispatch, Jules |
| `notebooklm-handlers.ts` | NotebookLM integration |
