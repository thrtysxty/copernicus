# IPC Channel Registry

Source of truth: `copernicus/electron/preload.ts`

## SEND_CHANNELS (renderer → main)

### Auth
`auth:status` `auth:store-api-key` `auth:get-api-key` `auth:resolve-openai-config`
`auth:revoke` `auth:revoke-key` `auth:validate-ollama-cloud`
`oauth:start-google` `oauth:start-anthropic` `oauth:start-openrouter`

### Models
`models:list` `models:active` `models:set-active` `models:list-ollama` `models:set-default`

### Chat
`chat:send` `chat:confirm-model-switch`

### File System
`fs:list-dir` `fs:list-files-recursive` `fs:open-file` `fs:read-file` `fs:save-file`
`fs:select-file` `fs:make-dir` `fs:create-file` `fs:create-dir` `fs:rename` `fs:trash` `fs:reveal`
`fs:tx-begin` `fs:tx-commit` `fs:tx-rollback` `fs:tx-status` `fs:tx-undo` `fs:save-multiple`
`dialog:open-file` `dialog:open-folder`

### App / Workspace
`app:get-root-path` `app:set-root-path` `app:get-user-guide`
`app:get-recent-projects` `app:switch-workspace` `app:open-folder-dialog`
`app:open-log` `app:open-external` `app:quit`
`window:exit-fullscreen` `restart-app`

### Git / GitHub
`git:branch` `git:init-workspace` `git:status` `git:stage` `git:unstage` `git:commit`
`git:branches` `git:checkout` `git:new-branch` `git:diff-file` `git:current-branch` `git:list-branches`
`github:user` `github:list-repos` `github:create-repo` `github:test-connection` `github:search`
`github:set-trust` `github:add-repo` `github:remove-repo` `github:get-trust-list`
`github:set-target-repo` `github:get-target-repo` `github:clone-repo` `github:list-prs`

### Stories
`stories:list` `stories:create` `stories:get-content` `stories:update-content`
`stories:update` `stories:set-status` `stories:is-repo-targeted` `stories:hydrate`
`stories:set-field` `stories:sync` `stories:target-project` `stories:import-from-path`
`story:scaffold`

### State Ledger / DB
`db:log-intent` `db:get-intents` `db:log-event` `db:get-events`
`db:add-memory` `db:search-memory` `db:vacuum`
`snapshot:save` `snapshot:restore`

### Model Call Ledger (Story 156)
`ledger:session-stats` `ledger:recent-calls` `ledger:all-time-cost`
`ledger:daily-costs` `ledger:cost-by-model` `ledger:cost-by-story` `ledger:heatmap-data`
`ledger:leaderboard` `ledger:stats-by-role-session` `ledger:stats-by-role-alltime`

### Workflow
`workflow:run` `workflow:status` `workflow:list-templates` `workflow:get-template`
`workflow:reset` `workflow:ollama-status` `workflow:update-node-data`
`workflow:get-snapshots` `workflow:rewind` `workflow:get-context`
`workflow:set-context` `workflow:resume-node` `workflow:save`
`workflow:reset-canvas` `workflow:run-canvas`

### Terminal
`terminal-create` `terminal:resize` `terminal-write` `terminal-kill`
`terminal:input` `terminal:spawn` `terminal:spawn-agent` `terminal:attach-agent` `terminal:stop-agent`

### LSP (Stories 176 + 189)
`lsp:status` `lsp:request` `lsp:notify`
`lsp:open-file` `lsp:close-file` `lsp:get-diagnostics` `lsp:check-file` `lsp:workspace-check`

### Diagnostics
`diagnostics:run-tsc` `diagnostics:get-all`
`diag:run` `diag:run-eslint` `diag:run-ruff` `diag:run-audit` `diag:get-all`

### Agents (Gemini / Jules)
`gemini:spawn` `gemini:send-prompt` `gemini:close` `gemini:status`
`jules:dispatch-session` `jules:list-sessions` `jules:story-sessions` `jules:retry-session`
`agent:delegate` `agent:forward` `agent:patch-apply` `agent:patch-reverse` `agent:send-code-stream`

### Codebase / Search
`codebase:text-search` `codebase:semantic-search`
`codebase:search-deep` `codebase:search-fast` `codebase:index-status` `codebase:run-benchmark`

### Testing (Story 384)
`test:discover` `test:run` `test:stop` `test:coverage`

### Worktrees
`worktree:list` `worktree:create` `worktree:diff` `worktree:merge` `worktree:remove` `worktree:poll`

### Debug (DAP)
`debug:launch` `debug:stop` `debug:pause` `debug:resume`
`debug:step-over` `debug:step-into` `debug:step-out`
`debug:set-breakpoints` `debug:get-call-stack` `debug:get-scopes` `debug:get-variables` `debug:evaluate`

### Browser (Story 155)
`browser:launch` `browser:navigate` `browser:screenshot`
`browser:click` `browser:fill` `browser:evaluate` `browser:close`

### Canvas
`canvas:iframe-bounds` `canvas:get-iframe-bounds` `canvas:capture-screenshot`
`canvas:screenshot-preview` `canvas:execute-js` `canvas:send-input`

### MCP
`mcp:list-servers` `mcp:save-servers` `mcp:test-server` `mcp:get-status`

### Misc
`makefile:list` `makefile:run` `system:make`
`settings:save` `settings:load`
`security:score` `security:git-push-response`
`kanban:get-columns` `kanban:set-column`
`layout:update-telemetry` `telemetry:update-touchbar`
`review:log` `review:session-complete` `review:generate-summary`
`health:check-all`
`extensions:list` `extensions:workflow-nodes` `extensions:tiles` `extensions:providers` `extensions:reload`
`localmodel:start` `localmodel:stop` `localmodel:status`
`runtime:list-containers` `runtime:manage-container`
`devtime:start` `devtime:status` `devtime:close` `devtime:defaults` `devtime:report`
`devtime:list-stories` `devtime:run-tests` `devtime:test-history` `devtime:weekly-velocity` `devtime:run-playwright`
`stories:throughput` `stories:status-distribution` `stories:bugs-by-assignee`
`log:get-history` `log:list-sources`
`replay:list-runs` `replay:get-steps` `replay:get-step-detail`
`env:scan` `env:install` `env:install-complete` `env:get-versions`
`project:save-billing` `project:get-billing`
`command:request-telemetry`
`templates:list` `templates:save` `templates:reset`
`genesis:run` `splash-ready` `check-cli-tools` `select-folder` `save-preferences`
`touchbar:rebuild`
`app:start-oauth-listener`
`layout:goto-line`

---

## LISTEN_CHANNELS (main → renderer push)

`main-process-message`
`chat:token` `chat:done` `chat:error` `chat:confirm-model-switch` `chat:model-switch-decision` `chat:receive-system` `chat:context-update`
`terminal-incoming` `terminal-closed` `terminal:data` `terminal-blocked`
`terminal:activate-tab` `terminal:spawn` `terminal:set-busy` `terminal:remove`
`stories:updated` `stories:status-changed`
`editor:open`
`agent:input` `agent:message` `agent:error` `agent:code-stream`
`layout:set-view` `layout:toggle-flip` `layout:toggle-spotlight` `layout:open-palette` `layout:toggle-ui-builder`
`security:git-push-request`
`splash-status`
`app:critical-error`
`oauth:callback` `oauth:google-complete`
`app:workspace-changed`
`canvas:show-url` `canvas:render`
`ledger:stats-update`
`jules:session-update`
`gemini:output`
`lsp:diagnostics-update`
`command:telemetry-update`
`workflow:status` `workflow:status-update` `workflow:step-start` `workflow:step-end` `workflow:save` `workflow:reset-canvas` `workflow:run-canvas`
`review:session-complete`
`layout:goto-line`
`diagnostics:tsc-complete` `diagnostics:tsc-progress`
`diag:results`
`log:line` `log:new-line`
`window:fullscreen-state`
`test:results`
`worktree:completed` `worktree:merged`
`debug:event`
