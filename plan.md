1. **Extend `CopernicusManifest` in `copernicus/electron/extensions/types.ts`**:
   - Add `capabilities` (filesystem, network, subprocess) and `activationEvents` fields as optional.

2. **Implement `ExtensionTrustStore`**:
   - `copernicus/electron/extensions/ExtensionTrustStore.ts` needs to read/write from `~/.copernicus/extension-trust.json`.
   - Update `isTrusted`, `approve`, and `revoke` to use `fs`.

3. **Update `ExtensionHostManager`**:
   - Introduce a trust check before spawning or activating the extension. Wait, `ExtensionHostManager` spawns the host, and `ExtensionLoader` seems to load extensions. Or wait, does `ExtensionHostManager` get told to activate extensions? I need to check how extensions are activated right now.
   - The AC says: "`ExtensionHostManager` checks `ExtensionTrustStore.isTrusted(name)` before sending `extension/activate` to the host. If not trusted and capabilities are non-empty, invokes `extension:request-approval` and waits for the dialog response. If denied, the extension is not loaded and logs a warn." Wait, `ExtensionHostManager` doesn't seem to send `extension/activate` right now in its current stub. I will need to implement an `activateExtension` method or similar in `ExtensionHostManager`, or find where it's called. Wait, I should look at `ExtensionHostManager.ts` and see if `activateExtension` exists.
   - Update: `ExtensionHostManager` has `start()`, `stop()`, `spawnHost()`. There is no `activateExtension` method yet. Wait, I should add it. Wait, the AC explicitly says: "`ExtensionHostManager` checks `ExtensionTrustStore.isTrusted(name)` before sending `extension/activate` to the host."

4. **Add IPC handlers in `extension-handlers.ts` and `preload.ts`**:
   - The AC asks to add `extension:request-approval` handler in `extension-handlers.ts`... wait, the dialog response is from the renderer *to* main? No, wait. "invokes `extension:request-approval` and waits for the dialog response." That means main process invokes `extension:request-approval` on the renderer! Wait, main to renderer is usually `win.webContents.send()`. BUT if it waits for a response, how does that work? Electron IPC doesn't have a native "invoke renderer from main" that returns a promise. Usually, you send an event to renderer, and renderer sends an event back (like `extension:approval-response`). Wait, the AC says: "invokes `extension:request-approval` and waits for the dialog response". The instructions also say: "`extension:request-approval` IPC channel (new, wrapped in `handleIpc()`): Input: { extensionName: string; displayName: string; capabilities: ... }. Returns: { approved: boolean }."
   Wait, if it's an IPC channel wrapped in `handleIpc()`, that means the *renderer* invokes it on the *main* process. Let me read carefully.
   AC-3:
   `extension:request-approval` IPC channel (new, wrapped in `handleIpc()`):
   - Input: `{ extensionName: string; displayName: string; capabilities: CopernicusManifest['capabilities'] }`
   - Returns: `{ approved: boolean }`
   If the renderer invokes it, the main process provides it. But how does the main process trigger the dialog?
   Oh! Maybe `extension:request-approval` is used by the renderer to tell the main process the result? No, "Input" and "Returns" usually implies the renderer calls it with Input and gets Returns. But how can the renderer return `{ approved: boolean }` if the main process is the one asking?
   Let's check how other dialogs work.
   Wait, if `extension:request-approval` is an `ipcMain.handle` handler, then the renderer calls it. But the AC says "ExtensionHostManager checks... invokes `extension:request-approval` and waits for the dialog response." This might mean we need a two-way flow, or I need to implement a mechanism for it. Let's see if there's a util for this or if I should just use standard electron IPC.

5. **Create `CapabilityApprovalDialog`**:
   - `copernicus/src/renderer/components/extensions/CapabilityApprovalDialog.tsx`.

6. **Pre-commit checks**:
   - Run `npx tsc --noEmit`.
   - Run UI checks if needed.
