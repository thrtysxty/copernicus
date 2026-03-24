# Known Failure Patterns

- **Stale channel name after refactor**
  - **Symptom:** IPC call silently fails or times out.
  - **Cause:** Channel name was updated in `main.ts` but the old name is still used in the renderer invocation or `preload.ts`.
  - **Fix:** Update the channel name consistently across `main.ts`, `preload.ts`, and component calls.

- **Missing preload registration**
  - **Symptom:** `window.ipcRenderer.invoke` is undefined or throws "No handler registered".
  - **Cause:** A new channel was added to `main.ts` but missing from the `SEND_CHANNELS` or `RECEIVE_CHANNELS` Sets in `preload.ts`.
  - **Fix:** Add the channel name to the appropriate set in `preload.ts`.

- **Unhandled IPC rejection**
  - **Symptom:** Uncaught Promise rejection, obscure Electron error traces, crash.
  - **Cause:** Returning a raw throw in `main.ts` without `handleIpc` or not checking `!result.ok` in the renderer before unwrapping.
  - **Fix:** Always wrap handlers in `handleIpc(() => ...)` and verify `if (!result.ok)` before using `unwrapIpc()`.
