import { contextBridge, ipcRenderer } from 'electron'

/** Channels the renderer may SEND to main (ipcMain.on / ipcMain.handle) */
const SEND_CHANNELS = new Set([
  // Auth
  'auth:status', 'auth:store-api-key', 'auth:get-api-key',
  'auth:resolve-openai-config',
  // Models
  'models:list', 'models:active', 'models:set-active', 'models:list-ollama',
  // LLM Chat
  'chat:send', 'chat:confirm-model-switch',
  // File System
  'fs:list-dir', 'fs:open-file', 'fs:read-file', 'fs:save-file', 'fs:select-file', 'fs:make-dir',
  'app:get-root-path', 'app:set-root-path', 'app:get-user-guide',
  // Git
  'git:branch',
  // Stories
  'stories:list', 'stories:create', 'stories:get-content', 'stories:update-content',
  'stories:update', 'stories:set-status', 'stories:is-repo-targeted', 'stories:hydrate', 'story:scaffold', 'stories:set-field',
  'stories:sync', 'stories:target-project', 'stories:import-from-path',
  // Makefile
  'makefile:list', 'makefile:run', 'system:make',
  // Terminal
  'terminal-create', 'terminal:resize', 'terminal-write', 'terminal-kill',
  'terminal:input', 'terminal:spawn',
  'terminal:spawn-agent',
  'terminal:stop-agent',
  // State Ledger
  'db:log-intent', 'db:get-intents', 'db:log-event', 'db:get-events',
  'db:add-memory', 'db:search-memory', 'db:vacuum',
  'snapshot:save', 'snapshot:restore', // Context Snapshots (Story 157)
  // Recent projects & workspace switching
  'app:get-recent-projects', 'app:switch-workspace', 'app:open-folder-dialog',
  // Model Call Ledger (Story 156)
  'ledger:session-stats', 'ledger:recent-calls', 'ledger:all-time-cost',
  // Layout / telemetry
  'layout:update-telemetry', 'telemetry:update-touchbar',
  // Agent interop
  'agent:delegate', 'agent:forward',
  'agent:patch-apply', 'agent:patch-reverse',
  // Security
  'security:git-push-response',
  // Settings
  'settings:save', 'settings:load',
  // GitHub
  'github:user', 'github:list-repos', 'github:create-repo', 'github:test-connection', 'github:search',
  'github:set-trust', 'github:add-repo', 'github:remove-repo', 'github:get-trust-list', 'github:set-target-repo', 'github:get-target-repo', 'github:clone-repo',
  // Git
  'git:init-workspace',
  // MCP
  'mcp:list-servers', 'mcp:save-servers', 'mcp:test-server', 'mcp:get-status',

  // Environment
  'env:scan', 'env:install', 'env:install-complete', 'env:get-versions',
  // Devtime
  'devtime:start', 'devtime:status', 'devtime:close', 'devtime:defaults', 'devtime:report',
  'devtime:list-stories', 'devtime:run-tests', 'devtime:test-history', 'devtime:weekly-velocity',
  'devtime:run-playwright',
  // Story analytics (Story 162)
  'stories:throughput', 'stories:status-distribution', 'stories:bugs-by-assignee',
  // Ledger analytics (Story 162)
  'ledger:daily-costs', 'ledger:cost-by-model', 'ledger:cost-by-story',
  // Workflow
  'workflow:run', 'workflow:status', 'workflow:list-templates', 'workflow:get-template', 'workflow:reset', 'workflow:ollama-status',
  'workflow:update-node-data',
  // Review gate
  'review:log', 'review:session-complete',
  // Codebase semantic index
  'codebase:search-deep', 'codebase:search-fast', 'codebase:index-status', 'codebase:run-benchmark',
  // LSP (Story 176 + 189)
  'lsp:status', 'lsp:request', 'lsp:notify',
  'lsp:open-file', 'lsp:close-file', 'lsp:get-diagnostics', 'lsp:check-file', 'lsp:workspace-check',
  // Canvas
  'canvas:iframe-bounds',
  // Browser (Story 155)
  'browser:launch', 'browser:navigate', 'browser:screenshot',
  'browser:click', 'browser:fill', 'browser:evaluate', 'browser:close',
  // Jules (Story 161)
  'jules:dispatch-session', 'jules:list-sessions', 'jules:story-sessions', 'jules:retry-session',
  // Gemini PTY agent (Story 195)
  'gemini:spawn', 'gemini:send-prompt', 'gemini:close', 'gemini:status',
  // Touch Bar
  'touchbar:rebuild',
  // Command Center (Story 184)
  'command:request-telemetry',
  // Project Billing (Story 211)
  'project:save-billing', 'project:get-billing',
  // Splash / wizard
  'genesis:run',
  'splash-ready', 'check-cli-tools', 'select-folder',
  'save-preferences', 'restart-app', 'app:quit',
  // App Control
  'app:open-log', 'app:open-external',
  // Runtime
  'runtime:list-containers', 'runtime:manage-container',
  // OAuth
  'oauth:start-google', 'oauth:start-anthropic', 'oauth:start-openrouter',
  'app:start-oauth-listener',
  // Auth revoke
  'auth:revoke', 'auth:revoke-key', 'auth:validate-ollama-cloud',
  // Canvas interaction (Story 153)
  'canvas:get-iframe-bounds', 'canvas:capture-screenshot', 'canvas:screenshot-preview',
  'canvas:execute-js', 'canvas:send-input',
])

/** Channels the renderer may LISTEN to from main (win.webContents.send) */
const LISTEN_CHANNELS = new Set([
  'main-process-message',
  'chat:token', 'chat:done', 'chat:error', 'chat:confirm-model-switch', 'chat:model-switch-decision',
  'terminal-incoming', 'terminal-closed', 'terminal:data', 'terminal-blocked',
  'terminal:activate-tab', 'terminal:spawn', 'terminal:set-busy', 'terminal:remove',
  'stories:updated', 'stories:status-changed',
  'editor:open',
  'agent:input', 'agent:message', 'agent:error',
  'layout:set-view', 'layout:toggle-flip', 'layout:toggle-spotlight', 'layout:open-palette',
  'layout:toggle-ui-builder',
  'security:git-push-request',
  'splash-status',
  'app:critical-error',
  'oauth:callback',
  'oauth:google-complete',
  'app:workspace-changed',
  'canvas:show-url', 'canvas:render',
  'ledger:stats-update',
  // Jules live session updates (pushed by jules/monitor.ts)
  'jules:session-update',
  // Gemini PTY output (pushed by GeminiAgent)
  'gemini:output',
  // LSP diagnostics (Story 176 + 189)
  'lsp:diagnostics-update',
  // Command Center (Story 184)
  'command:telemetry-update',
  // Workflow engine state push (Story 186)
  'workflow:status-update',
  'review:session-complete',
])
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
