import { describe, it, expect } from 'vitest'
import { handleIpc } from './utils/handle-ipc'
import { unwrapIpc } from '../src/renderer/types/ipc'

/**
 * IPC Envelope Contract Tests
 *
 * Channel Manifest (all ipcMain.handle channels registered in preload.ts SEND_CHANNELS):
 *
 * Auth: auth:status, auth:store-api-key, auth:get-api-key, auth:resolve-openai-config, auth:revoke, auth:revoke-key, auth:validate-ollama-cloud
 * Models: models:list, models:active, models:set-active, models:list-ollama, models:set-default
 * Retro: retro:list, retro:get, retro:create, retro:update-item, retro:commit, retro:push-ready, retro:generate, retro:gate-status, retro:trigger-manual
 * Intel: intel:list, intel:get, intel:create, intel:update, intel:delete, intel:suggest, intel:audit-length
 * LLM Chat: chat:send, chat:confirm-model-switch, chat:compress-delta
 * File System: fs:path-has-git, fs:list-dir, fs:list-files-recursive, fs:open-file, fs:read-file, fs:save-file, fs:select-file, fs:make-dir, fs:create-file, fs:create-dir, fs:rename, fs:trash, fs:reveal, fs:tx-begin, fs:tx-commit, fs:tx-rollback, fs:tx-status, fs:tx-undo, fs:save-multiple
 * Skills: skills:detect-stack, skills:audit, skills:scaffold
 * Dialog: dialog:open-file, dialog:open-folder
 * App: app:get-root-path, app:set-root-path, app:get-user-guide, app:get-recent-projects, app:switch-workspace, app:open-folder-dialog, app:get-env-state, app:start-oauth-listener
 * Git: git:branch, git:status, git:stage, git:unstage, git:commit, git:branches, git:checkout, git:new-branch, git:diff-file, git:current-branch, git:list-branches, git:init-workspace, git:check-repo, git:init-repo
 * Stories: stories:list, stories:create, stories:get-content, stories:update-content, stories:update, stories:set-status, stories:is-repo-targeted, stories:hydrate, story:scaffold, stories:set-field, stories:sync, stories:target-project, stories:import-from-path, stories:throughput, stories:status-distribution, stories:bugs-by-assignee
 * Makefile: makefile:list, makefile:run
 * Terminal: terminal-create, terminal-kill, terminal:resize, terminal-write, terminal:input, terminal:spawn, terminal:stop-agent, terminal:attach-agent, terminal:send-code-stream, terminal:delegate
 * Database: db:log-intent, db:get-intents, db:log-event, db:get-events, db:add-memory, db:search-memory, db:vacuum, db:get-edit-decisions, db:query, db:list-tables, db:search-episodes, db:story-status, db:recent-episodes, db:quality-summary
 * Agent Memory: memory:add, memory:get-working-set, memory:supersede, memory:log-work, memory:get-work-log, memory:export-now, memory:get-active-project
 * Snapshots: snapshot:save, snapshot:restore
 * Recent Projects: app:get-recent-projects, app:switch-workspace, app:open-folder-dialog
 * LLM Ledger: ledger:session-stats, ledger:recent-calls, ledger:all-time-cost, ledger:daily-costs, ledger:cost-by-model, ledger:cost-by-story, ledger:heatmap-data, ledger:leaderboard, ledger:stats-by-role-session, ledger:stats-by-role-alltime
 * Layout/Telemetry: layout:update-telemetry, telemetry:update-touchbar, telemetry:status, telemetry:recovery-status
 * Kanban: kanban:get-columns, kanban:set-column
 * Agent Interop: agent:delegate, agent:patch-apply, agent:patch-reverse, agent:send-code-stream
 * NotebookLM: nlm:list-notebooks, nlm:register-notebook, nlm:remove-notebook, nlm:query, notebooklm:notebook-contents, notebooklm:status
 * Settings: settings:save, settings:load
 * GitHub: github:user, github:list-repos, github:create-repo, github:test-connection, github:set-trust, github:add-repo, github:remove-repo, github:get-trust-list, github:set-target-repo, github:get-target-repo, github:clone-repo, github:list-prs
 * MCP: mcp:list-servers, mcp:save-servers, mcp:test-server, mcp:get-status, stitch:ping, stitch:extract-design, stitch:screenshot, stitch:design-dna, stitch:verify-ui, stitch:generate, stitch:edit, stitch:variants, stitch:list-screens
 * Security: security:score, security:get-config, security:update-package-gate, security:add-to-allowlist
 * Environment: env:scan, env:install, env:install-complete, env:get-versions
 * Devtime: devtime:start, devtime:status, devtime:close, devtime:defaults, devtime:report, devtime:list-stories, devtime:run-tests, devtime:test-history, devtime:weekly-velocity, devtime:run-playwright
 * Review: review:log, review:session-complete, review:generate-summary
 * Codebase: codebase:text-search, codebase:semantic-search, codebase:search-deep, codebase:search-fast, codebase:index-status, codebase:run-benchmark
 * LSP: lsp:status, lsp:request, lsp:notify, lsp:open-file, lsp:close-file, lsp:get-diagnostics, lsp:check-file, lsp:workspace-check, lsp:rename
 * Canvas: canvas:get-iframe-bounds, canvas:capture-screenshot, canvas:screenshot-preview, canvas:execute-js, canvas:send-input
 * Templates: templates:list, templates:save, templates:reset
 * Browser: browser:launch, browser:navigate, browser:screenshot, browser:click, browser:fill, browser:evaluate, browser:close, browser:snapshot, browser:console, browser:eval, browser:network
 * Jules: jules:dispatch-session, jules:list-sessions, jules:story-sessions, jules:retry-session, jules:list-sources, jules:approve-plan, jules:list-activities
 * Local Model: localmodel:start, localmodel:stop, localmodel:status, localmodel:is-cached
 * Touch Bar: touchbar:rebuild
 * Command Center: command:request-telemetry, command:telemetry-update
 * Project Billing: project:save-billing, project:get-billing
 * Project Config: project:get-config, project:save-config
 * Splash/Wizard: genesis:run, genesis:scaffold-harness, genesis:check-harness, wizard:get-username, wizard:spawn-auth-pty, splash-ready, check-cli-tools, select-folder, save-preferences, restart-app, app:quit
 * App Control: app:open-log, app:open-external, window:exit-fullscreen
 * Runtime: runtime:check-docker, runtime:list-containers, runtime:manage-container
 * OAuth: oauth:start-google, oauth:start-anthropic, oauth:start-openrouter, oauth:callback, oauth:google-complete, app:start-oauth-listener
 * OpenRouter: openrouter:list-models, openrouter:get-credits
 * Provider Registry: providers:list, providers:list-models, providers:reload
 * Knowledge Base: kb:list-articles, kb:get-article, kb:search
 * Database MCP: db:query, db:list-tables, db:search-episodes, db:story-status, db:recent-episodes, db:quality-summary
 * MLX: mlx:download-model, mlx:list-installed, mlx:delete-model, mlx:get-perf, mlx:get-status, mlx:switch-model, mlx:download-progress, mlx:server-status-changed
 * Agent Hub Self-Improvement: hub:get-proposals, hub:approve-proposal, hub:reject-proposal, hub:get-events, hub:get-attribution, hub:get-cost-summary, hub:user-sync, org-chart:get-config, org-chart:update-role, org-chart:list-active-tokens, daemon:install, daemon:is-registered, daemon:improvement-log
 * Daemon: daemon:install, daemon:is-registered, hub:attribute
 * Worktree: worktree:list, worktree:create, worktree:diff, worktree:merge, worktree:remove, worktree:poll, worktree:completed, worktree:merged
 * Testing: test:discover, test:run, test:stop, test:coverage, layout:goto-line
 * Extensions: extensions:list, extensions:workflow-nodes, extensions:tiles, extensions:providers, extensions:reload, extension:request-approval, extension:fire-event, extension:list, extension:install, extension:uninstall, extension:search
 * DAP: debug:launch, debug:stop, debug:pause, debug:resume, debug:step-over, debug:step-into, debug:step-out, debug:set-breakpoints, debug:get-call-stack, debug:get-scopes, debug:get-variables, debug:evaluate
 * Workflow: workflow:run, workflow:status, workflow:list-templates, workflow:get-template, workflow:reset, workflow:ollama-status, workflow:plan-waves, workflow:waves-status, workflow:assemble-context, workflow:recovery-brief, workflow:classify-handoff, workflow:update-node-data, workflow:get-snapshots, workflow:rewind, workflow:get-context, workflow:set-context, workflow:resume-node, workflow:save, workflow:reset-canvas, workflow:run-canvas, workflow:wave-complete, workflow:plan-check-result, workflow:plan-check-escalated, workflow:handoff-complete
 * Diagnostics: diagnostics:run-tsc, diagnostics:get-all, diag:run, diag:run-eslint, diag:run-ruff, diag:run-audit, diag:get-all, diagnostics:tsc-complete, diagnostics:tsc-progress
 * Log: log:get-history, log:list-sources, log:line, log:new-line
 * Health: health:check-all
 * Extension: extension:request-approval, extension:fire-event, extension:list, extension:install, extension:uninstall, extension:search
 */

describe('handleIpc', () => {
  it('happy path — synchronous return', async () => {
    const result = await handleIpc(() => 42)
    expect(result).toEqual({ ok: true, data: 42 })
  })

  it('error path — throws are caught and wrapped', async () => {
    const result = await handleIpc(() => {
      throw new Error('boom')
    })
    expect(result).toEqual({ ok: false, error: 'boom' })
  })

  it('async happy path', async () => {
    const result = await handleIpc(async () => 'hello')
    expect(result).toEqual({ ok: true, data: 'hello' })
  })

  it('async error path', async () => {
    const result = await handleIpc(async () => {
      throw new Error('async fail')
    })
    expect(result).toEqual({ ok: false, error: 'async fail' })
  })
})

describe('unwrapIpc', () => {
  it('happy path — extracts data', () => {
    const result = unwrapIpc({ ok: true, data: 99 })
    expect(result).toBe(99)
  })

  it('error path — throws error from envelope', () => {
    expect(() => unwrapIpc({ ok: false, error: 'bad' })).toThrow('bad')
  })

  it('with null input — returns null without throwing', () => {
    const result = unwrapIpc(null)
    expect(result).toBeNull()
  })

  it('with undefined input — returns undefined without throwing', () => {
    const result = unwrapIpc(undefined)
    expect(result).toBeUndefined()
  })
})
