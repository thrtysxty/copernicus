import { contextBridge, ipcRenderer } from 'electron'

/** Channels the renderer may SEND to main (ipcMain.on / ipcMain.handle) */
const SEND_CHANNELS = new Set([
  // Auth
  'auth:status', 'auth:store-api-key', 'auth:get-api-key',
  'auth:resolve-openai-config',
  // Models
  'models:list', 'models:active', 'models:set-active', 'models:list-ollama', 'models:set-default',
  'retro:list', 'retro:get', 'retro:create', 'retro:update-item', 'retro:commit', 'retro:push-ready', 'retro:generate', 'retro:gate-status', 'retro:trigger-manual',
  'intel:list', 'intel:get', 'intel:create', 'intel:update', 'intel:delete', 'intel:suggest', 'intel:audit-length',

  // LLM Chat
  'chat:send', 'chat:confirm-model-switch', 'chat:compress-delta', 'chat:done-extraction',
  // File System
  'fs:path-has-git', 'fs:list-dir', 'fs:list-files-recursive', 'fs:open-file', 'fs:read-file', 'fs:save-file', 'fs:select-file', 'fs:make-dir',
  // Skills
  'skills:detect-stack', 'skills:audit', 'skills:scaffold',
  'fs:create-file', 'fs:create-dir', 'fs:rename', 'fs:trash', 'fs:reveal',
  'fs:tx-begin', 'fs:tx-commit', 'fs:tx-rollback', 'fs:tx-status', 'fs:tx-undo', 'fs:save-multiple',
  'dialog:open-file', 'dialog:open-folder',
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
  'terminal:spawn-agent', 'terminal:attach-agent',
  'terminal:stop-agent',
  // State Ledger
  'db:log-intent', 'db:get-intents', 'db:log-event', 'db:get-events',
  'db:add-memory', 'db:search-memory', 'db:vacuum', 'db:get-edit-decisions',
  
  // Agent Memory
  'memory:add', 'memory:get-working-set', 'memory:supersede', 'memory:log-work', 'memory:get-work-log', 'memory:export-now', 'memory:get-active-project',
  'snapshot:save', 'snapshot:restore', // Context Snapshots (Story 157)
  // Recent projects & workspace switching
  'app:get-recent-projects', 'app:switch-workspace', 'app:open-folder-dialog',
  'app:get-env-state', // Story 613: Environmental state snapshot
  // Model Call Ledger (Story 156)
  'ledger:session-stats', 'ledger:recent-calls', 'ledger:all-time-cost',
  // Layout / telemetry
  'layout:update-telemetry', 'telemetry:update-touchbar', 'telemetry:status', 'telemetry:recovery-status',
  'kanban:get-columns', 'kanban:set-column',
  // Agent interop
  'agent:delegate', 'agent:forward',
  'agent:patch-apply', 'agent:patch-reverse',
  'agent:send-code-stream',
  // NotebookLM
  'nlm:list-notebooks', 'nlm:register-notebook', 'nlm:remove-notebook', 'nlm:query', 'notebooklm:notebook-contents',
  // Security
  'security:git-push-response',
  // Settings
  'settings:save', 'settings:load',
  // GitHub
  'github:user', 'github:list-repos', 'github:create-repo', 'github:test-connection', 'github:search',
  'github:set-trust', 'github:add-repo', 'github:remove-repo', 'github:get-trust-list', 'github:set-target-repo', 'github:get-target-repo', 'github:clone-repo',
  // Git
  'git:init-workspace', 'git:check-repo', 'git:init-repo',
  // MCP
  'mcp:list-servers', 'mcp:save-servers', 'mcp:test-server', 'mcp:get-status',
  'stitch:ping', 'stitch:extract-design', 'stitch:screenshot', 'stitch:design-dna', 'stitch:verify-ui',
  'stitch:generate', 'stitch:edit', 'stitch:variants', 'stitch:list-screens',
  'notebooklm:status', 'notebooklm:list-notebooks', 'notebooklm:setup',

  'git:status', 'git:stage', 'git:unstage', 'git:commit', 'git:branches', 'git:checkout', 'git:new-branch', 'git:diff-file', 'github:list-prs',
  'git:current-branch', 'git:list-branches',
  'codebase:text-search', 'codebase:semantic-search',
  'diagnostics:run-tsc', 'diagnostics:get-all',
  'diag:run', 'diag:run-eslint', 'diag:run-ruff', 'diag:run-audit', 'diag:get-all',
  'log:get-history', 'log:list-sources',
  'replay:list-runs', 'replay:get-steps', 'replay:get-step-detail',
  'security:score',

  // Environment
  'env:scan', 'env:install', 'env:install-complete', 'env:get-versions',
  // Devtime
  'devtime:start', 'devtime:status', 'devtime:close', 'devtime:defaults', 'devtime:report',
  'devtime:list-stories', 'devtime:run-tests', 'devtime:test-history', 'devtime:weekly-velocity',
  'devtime:run-playwright',
  // Story analytics (Story 162)
  'stories:throughput', 'stories:status-distribution', 'stories:bugs-by-assignee',
  // Ledger analytics (Story 162)
  'ledger:daily-costs', 'ledger:cost-by-model', 'ledger:cost-by-story', 'ledger:heatmap-data', 'ledger:leaderboard',
  'ledger:stats-by-role-session', 'ledger:stats-by-role-alltime',
  // Workflow
  'workflow:run', 'workflow:status', 'workflow:list-templates', 'workflow:get-template', 'workflow:reset', 'workflow:ollama-status', 'workflow:plan-waves', 'workflow:waves-status',
  'workflow:assemble-context', 'workflow:recovery-brief', 'workflow:classify-handoff',
  'workflow:update-node-data', 'workflow:get-snapshots', 'workflow:rewind', 'workflow:get-context', 'workflow:set-context', 'workflow:resume-node',
  'workflow:save', 'workflow:reset-canvas', 'workflow:run-canvas',
  // Review gate
  'review:log', 'review:session-complete', 'review:generate-summary',
  // Codebase semantic index
  'codebase:search-deep', 'codebase:search-fast', 'codebase:index-status', 'codebase:run-benchmark',
  // LSP (Story 176 + 189)
  'lsp:status', 'lsp:request', 'lsp:notify',
  'lsp:open-file', 'lsp:close-file', 'lsp:get-diagnostics', 'lsp:check-file', 'lsp:workspace-check',
  'lsp:rename',
  // Canvas
  'canvas:iframe-bounds',
  // Templates (Story 330)
  'templates:list', 'templates:save', 'templates:reset',
  // Browser (Story 155)
  'browser:launch', 'browser:navigate', 'browser:screenshot',
  'browser:click', 'browser:fill', 'browser:evaluate', 'browser:close',
  // Jules (Story 161)
  'jules:dispatch-session', 'jules:list-sessions', 'jules:story-sessions', 'jules:retry-session', 'jules:list-sources', 'jules:approve-plan', 'jules:list-activities',
  // Local Model (Story 361)
  'localmodel:start', 'localmodel:stop', 'localmodel:status', 'localmodel:is-cached',
  // Gemini PTY agent (Story 195)
  'gemini:spawn', 'gemini:send-prompt', 'gemini:close', 'gemini:status',
  // Touch Bar
  'touchbar:rebuild',
  // Command Center (Story 184)
  'command:request-telemetry',
  // Project Billing (Story 211)
  'project:save-billing', 'project:get-billing',
  // Project Config (Story 606)
  'project:get-config', 'project:save-config',
  // Splash / wizard
  'genesis:run', 'genesis:scaffold-harness', 'genesis:check-harness',
  'wizard:get-username', 'wizard:spawn-auth-pty',
  'splash-ready', 'check-cli-tools', 'select-folder',
  'save-preferences', 'restart-app', 'app:quit',
  // App Control
  'app:open-log', 'app:open-external', 'window:exit-fullscreen',
  // Runtime
  'runtime:check-docker', 'runtime:list-containers', 'runtime:manage-container',
  // OAuth
  'oauth:start-google', 'oauth:start-anthropic', 'oauth:start-openrouter',
  'app:start-oauth-listener',
  // OpenRouter (Story 623)
  'openrouter:list-models', 'openrouter:get-credits',
  // Provider Registry (Story 626)
  'providers:list', 'providers:list-models',
  // Provider Config File (Story 627)
  'providers:reload',
  // Knowledge Base (Story 566)
  'kb:list-articles', 'kb:get-article', 'kb:search',
  // KB deep link (Story 567)
  'kb:open-article',
  // Auth revoke
  'auth:revoke', 'auth:revoke-key', 'auth:validate-ollama-cloud',
  // Canvas interaction (Story 153)
  'canvas:get-iframe-bounds', 'canvas:capture-screenshot', 'canvas:screenshot-preview',
  'canvas:execute-js', 'canvas:send-input',
  // Testing (Story 384)
  'test:discover', 'test:run', 'test:stop', 'test:coverage',
  'layout:goto-line',
  'worktree:list', 'worktree:create', 'worktree:diff', 'worktree:merge', 'worktree:remove', 'worktree:poll',
  'health:check-all',
  // Extensions
  'extensions:list', 'extensions:workflow-nodes', 'extensions:tiles', 'extensions:providers', 'extensions:reload',
  // DAP
  'debug:launch', 'debug:stop', 'debug:pause', 'debug:resume',
  'debug:step-over', 'debug:step-into', 'debug:step-out',
  'debug:set-breakpoints', 'debug:get-call-stack', 'debug:get-scopes', 'debug:get-variables',
  'debug:evaluate',
  // Daemon (Story 524)
  'daemon:install', 'daemon:is-registered',
])

/** Channels the renderer may LISTEN to from main (win.webContents.send) */
const LISTEN_CHANNELS = new Set([
  'main-process-message',
  'chat:token', 'chat:done', 'chat:error', 'chat:confirm-model-switch', 'chat:model-switch-decision', 'chat:receive-system',
  'chat:context-update',
  'terminal-incoming', 'terminal-closed', 'terminal:data', 'terminal-blocked',
  'terminal:activate-tab', 'terminal:spawn', 'terminal:set-busy', 'terminal:remove',
  'stories:updated', 'stories:status-changed',
  'editor:open',
  'agent:input', 'agent:message', 'agent:error', 'agent:code-stream',
  'layout:set-view', 'layout:toggle-flip', 'layout:toggle-spotlight', 'layout:open-palette',
  'layout:toggle-ui-builder',
  'app:ready', 'app:ready-status',
  'retro:ready', 'retro:approved', 'skills:onboarding-needed', 'skills:scaffolded',
  'models:active-changed',

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
  // Story 615 prep: LSP status changes
  'lsp:status-changed',
  // Command Center (Story 184)
  'command:telemetry-update',
  // Workflow engine state push (Story 186)
  'workflow:status', 'workflow:status-update', 'workflow:step-start', 'workflow:step-end', 'workflow:save', 'workflow:reset-canvas', 'workflow:run-canvas', 'workflow:wave-complete', 'workflow:plan-check-result', 'workflow:plan-check-escalated', 'workflow:handoff-complete',
  'review:session-complete',
  'layout:goto-line',
  'diagnostics:tsc-complete', 'diagnostics:tsc-progress',
  'diag:results',
  'log:line',
  'log:new-line',
  'window:fullscreen-state',
  // Testing (Story 384)
  'test:results',
  'worktree:completed', 'worktree:merged',
  // DAP
  'debug:event',
  'intel:sync-complete',
  // Daemon first-run prompt (Story 524)
  'daemon:prompt-install',
  // Wizard PTY auth widget (Story 561)
  'wizard:pty-data', 'wizard:pty-exit',
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
