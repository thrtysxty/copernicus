import { contextBridge, ipcRenderer } from 'electron'

// ---------------------------------------------------------------------------
// Channel allowlists — the ONLY channels the renderer may use.
// Add new channels here when new IPC handlers are registered in main.ts.
// ---------------------------------------------------------------------------

/** Channels the renderer may SEND to main (ipcMain.on / ipcMain.handle) */
const SEND_CHANNELS = new Set([
  // Auth
  'auth:status', 'auth:store-api-key', 'auth:get-api-key',
  'auth:resolve-openai-config',
  // Models
  'models:list', 'models:active', 'models:set-active',
  // LLM Chat
  'chat:send',
  // File System
  'fs:list-dir', 'fs:open-file', 'fs:save-file', 'app:get-root-path',
  // Git
  'git:branch',
  // Stories
  'stories:list', 'stories:update', 'stories:hydrate', 'story:scaffold',
  // Makefile
  'makefile:list', 'makefile:run', 'system:make',
  // Terminal
  'terminal-create', 'terminal-resize', 'terminal-write', 'terminal-kill',
  'terminal:spawn-agent',
  // State Ledger
  'db:log-intent', 'db:get-intents', 'db:log-event', 'db:get-events',
  'db:add-memory', 'db:search-memory',
  // Layout / telemetry
  'layout:update-telemetry',
  // Agent interop
  'agent:delegate', 'agent:forward',
  // Security
  'security:git-push-response',
  // Settings
  'settings:save', 'settings:load',
  // Splash / wizard
  'splash-ready', 'check-cli-tools', 'select-folder',
  'save-preferences', 'restart-app', 'app:quit',
  // App Control
  'app:open-log',
])

/** Channels the renderer may LISTEN to from main (win.webContents.send) */
const LISTEN_CHANNELS = new Set([
  'main-process-message',
  'chat:token', 'chat:done', 'chat:error',
  'terminal-incoming', 'terminal-closed', 'terminal:data', 'terminal-blocked',
  'terminal:activate-tab',
  'stories:updated',
  'editor:open',
  'agent:input', 'agent:message', 'agent:error',
  'layout:set-view', 'layout:toggle-flip', 'layout:toggle-spotlight',
  'telemetry:update-touchbar',
  'security:git-push-request',
  'splash-status',
  'app:critical-error',
])

// ---------------------------------------------------------------------------
// Expose filtered API to renderer via contextBridge
// ---------------------------------------------------------------------------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(channel: string, listener: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void): () => void {
    if (!LISTEN_CHANNELS.has(channel)) {
      console.warn(`[preload] Blocked unauthorised listen on channel: ${channel}`)
      return () => { /* no-op */ }
    }
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.off(channel, listener)
  },

  off(channel: string, listener: (...args: unknown[]) => void): void {
    ipcRenderer.off(channel, listener)
  },

  send(channel: string, ...args: unknown[]): void {
    if (!SEND_CHANNELS.has(channel)) {
      console.warn(`[preload] Blocked unauthorised send on channel: ${channel}`)
      return
    }
    ipcRenderer.send(channel, ...args)
  },

  invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    if (!SEND_CHANNELS.has(channel)) {
      console.warn(`[preload] Blocked unauthorised invoke on channel: ${channel}`)
      return Promise.reject(new Error(`Channel not allowed: ${channel}`))
    }
    return ipcRenderer.invoke(channel, ...args)
  },
})
