# Execution Plan 002: Electron Security Hardening
**Sprint:** 1
**Agent Role:** Senior Developer (TypeScript/Electron)
**Story:** 101 (C-4, C-6, H-1, H-2, H-6)
**Prerequisite:** Plan 001 complete
**Date Authored:** 2026-02-25

---

## Context

The Copernicus and Atlas Electron apps have critical security misconfigurations:
- No `contextIsolation` → renderer has direct Node.js access
- PTY terminals leak all host environment variables (API keys, SSH creds)
- A complete security module (`env-sanitizer`, `pty-auditor`) exists but is **never called**
- No IPC channel allowlist in either preload bridge
- No Content Security Policy in the HTML entry point

This plan wires the existing security infrastructure and adds the missing configuration.
**Read every file in full before modifying it.**

---

## Task 1: Enable Electron Window Security Flags (C-4)

### File: `copernicus/electron/main.ts`

**Step 1: Read `copernicus/electron/main.ts` in full.**

Find every `new BrowserWindow({` call. There are at least two: the splash window and
the main window. Possibly a third for the setup wizard.

**Step 2: Add security flags to every `webPreferences` block.**

For each `BrowserWindow` instantiation, ensure `webPreferences` contains:

```typescript
webPreferences: {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  enableRemoteModule: false,
  allowRunningInsecureContent: false,
  webSecurity: true,
},
```

**Example — before:**
```typescript
win = new BrowserWindow({
  width: 1200,
  height: 800,
  backgroundColor: '#050505',
  titleBarStyle: 'hiddenInset',
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
  },
})
```

**Example — after:**
```typescript
win = new BrowserWindow({
  width: 1200,
  height: 800,
  backgroundColor: '#050505',
  titleBarStyle: 'hiddenInset',
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    enableRemoteModule: false,
    allowRunningInsecureContent: false,
    webSecurity: true,
  },
})
```

Apply to **every** `BrowserWindow` call in the file.

**Step 3: Apply the same change to `atlas/electron/main.ts`.**

Read `atlas/electron/main.ts` in full. Apply identical `webPreferences` additions.

**Step 4: Verify TypeScript compiles.**

```bash
cd copernicus && npx tsc --noEmit 2>&1 | head -30
cd ../atlas && npx tsc --noEmit 2>&1 | head -30
```

No new errors should be introduced.

---

## Task 2: Wire `buildSafeEnv()` into PTY Managers (C-6)

### File: `copernicus/electron/pty-manager.ts`

**Step 1: Read `copernicus/electron/security/env-sanitizer.ts` in full.**

Understand the `buildSafeEnv(agentId: string)` function signature and return type.
Note what it strips (API keys, tokens, credentials matching `STRIP_PATTERNS`).

**Step 2: Read `copernicus/electron/pty-manager.ts` in full.**

Find the `pty.spawn(...)` call. It currently passes `env: process.env as any`.

**Step 3: Add the import.**

At the top of `copernicus/electron/pty-manager.ts`, add:

```typescript
import { buildSafeEnv } from './security/env-sanitizer'
```

**Step 4: Replace the environment argument.**

Change:
```typescript
const ptyProcess = pty.spawn(shell, [], {
  name: 'xterm-256color',
  cols: cols,
  rows: rows,
  cwd: cwd,
  env: process.env as any,
})
```

To:
```typescript
const ptyProcess = pty.spawn(shell, [], {
  name: 'xterm-256color',
  cols: cols,
  rows: rows,
  cwd: cwd,
  env: buildSafeEnv(agentId) as Record<string, string>,
})
```

Ensure `agentId` is available as a parameter in the calling function. If the spawn
function does not currently accept `agentId`, add it as an optional parameter with
default `'default'`.

**Step 5: Apply the same change to `atlas/electron/pty-manager.ts`.**

Read `atlas/electron/pty-manager.ts` in full.

Atlas does not have `env-sanitizer.ts`. Create the directory and copy the sanitizer:

```bash
mkdir -p atlas/electron/security
cp copernicus/electron/security/env-sanitizer.ts atlas/electron/security/env-sanitizer.ts
```

Then apply the same import + substitution to `atlas/electron/pty-manager.ts`.

**Step 6: Verify TypeScript compiles.**

```bash
cd copernicus && npx tsc --noEmit 2>&1 | head -30
cd ../atlas && npx tsc --noEmit 2>&1 | head -30
```

---

## Task 3: Wire `PTYAuditor` into Copernicus PTY Manager (H-1)

### File: `copernicus/electron/pty-manager.ts`

**Step 1: Read `copernicus/electron/security/pty-auditor.ts` in full.**

Note the constructor signature, the `logOutput(agentId, data)` method, and any
`start()` / `stop()` lifecycle methods.

**Step 2: Add the import.**

```typescript
import { PTYAuditor } from './security/pty-auditor'
```

**Step 3: Instantiate the auditor as a class property.**

Add to the `PTYManager` class (or top of the module if non-class):

```typescript
private auditor: PTYAuditor = new PTYAuditor()
```

**Step 4: Call `auditor.logOutput()` in the PTY data handler.**

Find where `ptyProcess.onData(...)` is called (the terminal output handler).
After writing data to the xterm, also log it:

```typescript
ptyProcess.onData((data: string) => {
  this.auditor.logOutput(agentId, data)  // ADD this line
  win?.webContents.send(`terminal-data-${id}`, data)
})
```

**Step 5: Verify TypeScript compiles.**

```bash
cd copernicus && npx tsc --noEmit 2>&1 | head -30
```

---

## Task 4: Add IPC Channel Allowlist to Preload Bridges (H-2)

### File: `copernicus/electron/preload.ts`

**Step 1: Read `copernicus/electron/preload.ts` in full.**

The current implementation exposes a generic bridge with no channel restrictions.

**Step 2: Read `copernicus/electron/main.ts`** to compile the complete list of
`ipcMain.handle(...)` and `ipcMain.on(...)` channel names registered.

Build an exhaustive list before writing the allowlist.

**Step 3: Replace the generic bridge with an allowlisted version.**

```typescript
import { contextBridge, ipcRenderer } from 'electron'

const ALLOWED_INVOKE_CHANNELS = new Set([
  'auth:status',
  'auth:store-api-key',
  'auth:get-keys',
  'auth:remove-key',
  'stories:list',
  'stories:update',
  'makefile:run',
  'devtime:start',
  'devtime:stop',
  'devtime:status',
  'terminal-create',
  'terminal-resize',
  'terminal-kill',
  'save-preferences',
  'load-preferences',
  'check-cli-tools',
  'fs:read-file',
  'db:log-intent',
  'db:get-recent',
  'github:get-repos',
  'github:create-repo',
  'github:get-prs',
  'github:get-branches',
  // Add any remaining channels discovered from main.ts
])

const ALLOWED_SEND_CHANNELS = new Set([
  'system:make',
  'terminal-write',
  'agent:delegate',
])

const ALLOWED_LISTEN_CHANNELS = new Set([
  'terminal-data',
  'agent:input',
  'makefile:output',
  'makefile:complete',
])

contextBridge.exposeInMainWorld('ipcRenderer', {
  invoke(channel: string, ...args: unknown[]) {
    if (!ALLOWED_INVOKE_CHANNELS.has(channel)) {
      console.error(`[preload] Blocked unauthorised invoke: ${channel}`)
      return Promise.reject(new Error(`Channel not permitted: ${channel}`))
    }
    return ipcRenderer.invoke(channel, ...args)
  },

  send(channel: string, ...args: unknown[]) {
    if (!ALLOWED_SEND_CHANNELS.has(channel)) {
      console.error(`[preload] Blocked unauthorised send: ${channel}`)
      return
    }
    ipcRenderer.send(channel, ...args)
  },

  on(channel: string, listener: (...args: unknown[]) => void) {
    if (!ALLOWED_LISTEN_CHANNELS.has(channel)) {
      console.error(`[preload] Blocked unauthorised listener: ${channel}`)
      return () => {}
    }
    const wrapped = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
      listener(...args)
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.off(channel, wrapped)
  },

  off(channel: string, listener: (...args: unknown[]) => void) {
    ipcRenderer.off(channel, listener as never)
  },
})
```

**Step 4: Apply an equivalent allowlist to `atlas/electron/preload.ts`.**

Read `atlas/electron/main.ts` to compile Atlas's channel list.
Atlas exposes TWO bridges (`ipcRenderer` and `electronAPI`). Apply allowlists to both.

For `electronAPI`, the allowed set is:
```typescript
const ATLAS_TERMINAL_CHANNELS = new Set([
  'terminal-create',
  'terminal-write',
  'terminal-resize',
  'terminal-kill',
])
```

**Step 5: Verify TypeScript compiles with no errors.**

```bash
cd copernicus && npx tsc --noEmit
cd ../atlas && npx tsc --noEmit
```

---

## Task 5: Add Content Security Policy to `copernicus/index.html` (H-6)

**Step 1: Read `copernicus/index.html` in full.**

**Step 2: Add CSP `<meta>` tag inside `<head>`, directly after `<meta charset="UTF-8">`.**

```html
<meta http-equiv="Content-Security-Policy"
  content="
    default-src 'self';
    script-src 'self';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob:;
    font-src 'self' data:;
    connect-src 'self' https://api.github.com https://api.anthropic.com https://openrouter.ai;
    media-src 'none';
    object-src 'none';
    frame-src 'none';
  ">
```

> `unsafe-inline` for styles is required for Tailwind CSS utility classes.
> Do NOT add `unsafe-inline` for scripts.

**Step 3: Test that the app loads in dev mode after adding CSP.**

```bash
cd copernicus && npm run dev
```

Open DevTools → Console tab. If any legitimate resources are blocked by CSP, add their
origins to the appropriate directive. Do not use `*` wildcards.

---

## Completion Checklist

- [ ] Every `BrowserWindow` in `copernicus/electron/main.ts` has `contextIsolation: true, nodeIntegration: false, sandbox: true`
- [ ] Every `BrowserWindow` in `atlas/electron/main.ts` has same flags
- [ ] `copernicus/electron/pty-manager.ts` imports and calls `buildSafeEnv(agentId)`
- [ ] `atlas/electron/pty-manager.ts` imports and calls `buildSafeEnv(agentId)`
- [ ] `PTYAuditor` is instantiated and `logOutput()` is called on every PTY data event
- [ ] `copernicus/electron/preload.ts` uses allowlisted channels only
- [ ] `atlas/electron/preload.ts` uses allowlisted channels only
- [ ] `copernicus/index.html` has CSP meta tag
- [ ] `npx tsc --noEmit` passes in both `copernicus/` and `atlas/`
- [ ] App loads in dev mode without CSP violation console errors

**Commit message:**
```
security(sprint-1): harden Electron window and IPC boundaries

- Add contextIsolation/nodeIntegration/sandbox to all BrowserWindows (C-4)
- Wire buildSafeEnv() into both PTY managers to stop env var leakage (C-6)
- Instantiate PTYAuditor and log all terminal output (H-1)
- Replace generic preload bridge with IPC channel allowlists (H-2)
- Add Content Security Policy to copernicus/index.html (H-6)
```
