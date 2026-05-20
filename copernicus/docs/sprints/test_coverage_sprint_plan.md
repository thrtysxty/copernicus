# Test Coverage Sprint Plan — 100% Coverage

**Created:** 2026-05-20
**Scope:** All source files in `electron/` and `src/renderer/`
**Baseline:** 22 unit test files (20 electron + 2 renderer), 17 e2e test files
**Target:** Unit test for every source file, organized by priority phase

---

## Story Scope Legend

Each story row now includes remediation tags beyond just "add test":

| Tag | Meaning |
|-----|---------|
| `[L]` | File missing logger import — add structured logging |
| `[E]` | File has empty `.catch(() => {})` or `catch {}` — add proper error handling |
| `[C]` | File uses `console.log/warn/error` instead of logger — replace with logger |
| `[U]` | Renderer `invoke()` calls need `unwrapIpc()` or try/catch — add error handling |
| `[EB]` | ErrorBoundary uses `console.error` — wire to logger and persist errors |

---

## Priority Principles

1. **IPC handlers first** — These are the contract boundary between main and renderer. Every handler is a potential security surface and data integrity gate.
2. **Electron core services** — Process managers, state, persistence. These fail silently and take down the whole app.
3. **Security & auth** — SecurityScorer, sandbox, git-guard. Untested security code is a liability.
4. **Workflow & LLM** — The core value prop. Engine, context assembly, prompt building, tool dispatch.
5. **Renderer stores** — State management is the nervous system. Zustand stores are small, testable, high-leverage.
6. **Renderer hooks** — IPC wrappers and side effects. Small files, easy to mock, high coverage ROI.
7. **Renderer components** — Largest surface area, lowest criticality for unit tests (e2e covers interaction). Prioritize complex logic components over display-only ones.
8. **Utilities & data** — Pure functions, easy wins, round out coverage.

---

## Phase 1: IPC Handlers (39 untested files)

> **Why first:** IPC is the security boundary and data contract. 44 handler files exist, only 5 tested. Every untested handler is an unverified contract.
>
> **Logging note:** Most IPC handlers rely on `handleIpc` for error logging, but handler-internal logic (validation, data transforms, preconditions) runs silent. Add logger to handler bodies for non-trivial logic paths.
>
> **Error handling note:** Some handlers throw instead of returning `{ ok: false }`, and some silently swallow errors in inner catch blocks. Fix during test writing.

| # | Story | File | Priority | Tags |
|---|-------|------|----------|------|
| 1.01 | Test app-handlers | `electron/ipc/app-handlers.ts` | P0 | `[L]` |
| 1.02 | Test auth-handlers | `electron/ipc/auth-handlers.ts` | P0 | `[E]` — `.catch(() => null)` on line 183 returns null instead of error; throws instead of returning `{ ok: false }` on lines 15, 155 |
| 1.03 | Test browser-handlers | `electron/ipc/browser-handlers.ts` | P0 | `[L]` |
| 1.04 | Test capex-handlers | `electron/ipc/capex-handlers.ts` | P1 | `[L]` |
| 1.05 | Test chat-handlers | `electron/ipc/chat-handlers.ts` | P0 | `[E]` — streamChat error logged but `{ ok: true }` always returned (line 52); caller can't detect failure |
| 1.06 | Test daemon-handlers | `electron/ipc/daemon-handlers.ts` | P1 | |
| 1.07 | Test debug-handlers | `electron/ipc/debug-handlers.ts` | P1 | `[L]` |
| 1.08 | Test deps | `electron/ipc/deps.ts` | P0 | `[L]` |
| 1.09 | Test diag-handlers | `electron/ipc/diag-handlers.ts` | P1 | `[L]` |
| 1.10 | Test diagnostics-handlers | `electron/ipc/diagnostics-handlers.ts` | P1 | `[L]` |
| 1.11 | Test extension-handlers | `electron/ipc/extension-handlers.ts` | P1 | `[L]` |
| 1.12 | Test file-handlers | `electron/ipc/file-handlers.ts` | P0 | `[E]` — throws `NO_WINDOW` / `IFRAME_BOUNDS_UNKNOWN` instead of returning `{ ok: false }` (lines 214, 225) |
| 1.13 | Test genesis-handlers | `electron/ipc/genesis-handlers.ts` | P2 | `[L]` |
| 1.14 | Test git-handlers | `electron/ipc/git-handlers.ts` | P0 | `[E]` — `catch { return '' }`, `catch { return 'unknown' }`, `catch { return [] }` silently swallow git failures (lines 79, 114, 137) |
| 1.15 | Test hub-handlers | `electron/ipc/hub-handlers.ts` | P2 | `[E]` — two empty `catch {}` blocks for JSON.parse failures (lines 195, 245) |
| 1.16 | Test intel-handlers | `electron/ipc/intel-handlers.ts` | P2 | |
| 1.17 | Test jules-handlers | `electron/ipc/jules-handlers.ts` | P1 | `[L]` |
| 1.18 | Test kb-handlers | `electron/ipc/kb-handlers.ts` | P2 | `[L]` |
| 1.19 | Test local-model-handlers | `electron/ipc/local-model-handlers.ts` | P1 | `[L]` |
| 1.20 | Test log-handlers | `electron/ipc/log-handlers.ts` | P1 | |
| 1.21 | Test memory-handlers | `electron/ipc/memory-handlers.ts` | P0 | `[L]` |
| 1.22 | Test mlx-handlers | `electron/ipc/mlx-handlers.ts` | P1 | `[L]` |
| 1.23 | Test model-handlers | `electron/ipc/model-handlers.ts` | P1 | `[L]` |
| 1.24 | Test notebooklm-handlers | `electron/ipc/notebooklm-handlers.ts` | P2 | `[L]` |
| 1.25 | Test project-handlers | `electron/ipc/project-handlers.ts` | P0 | `[L]` |
| 1.26 | Test provider-handlers | `electron/ipc/provider-handlers.ts` | P1 | `[E]` — throws `Provider not found` instead of returning `{ ok: false }` (line 29) |
| 1.27 | Test register-all-handlers | `electron/ipc/register-all-handlers.ts` | P0 | `[L]` |
| 1.28 | Test replay-handlers | `electron/ipc/replay-handlers.ts` | P1 | `[L]` |
| 1.29 | Test retro-handlers | `electron/ipc/retro-handlers.ts` | P1 | |
| 1.30 | Test search-handlers | `electron/ipc/search-handlers.ts` | P1 | `[L]` |
| 1.31 | Test security-handlers | `electron/ipc/security-handlers.ts` | P0 | `[L]` |
| 1.32 | Test stitch-handlers | `electron/ipc/stitch-handlers.ts` | P2 | |
| 1.33 | Test story-handlers | `electron/ipc/story-handlers.ts` | P1 | `[L]` |
| 1.34 | Test terminal-agent-handlers | `electron/ipc/terminal-agent-handlers.ts` | P0 | `[L]` |
| 1.35 | Test terminal-handlers | `electron/ipc/terminal-handlers.ts` | P0 | `[L]` |
| 1.36 | Test test-handlers | `electron/ipc/test-handlers.ts` | P1 | `[L]` |
| 1.37 | Test wizard-pty-handlers | `electron/ipc/wizard-pty-handlers.ts` | P1 | `[L]` |
| 1.38 | Test workflow-handlers | `electron/ipc/workflow-handlers.ts` | P1 | `[L]` |
| 1.39 | Test worktree-handlers | `electron/ipc/worktree-handlers.ts` | P1 | `[L]` |

**Stories:** 39 | **Estimated effort:** 7–9 sprints (error handling fixes add ~15 min per `[E]` story)

---

## Phase 2: Electron Core Services (16 untested files)

> **Why second:** These manage processes, state, and the app lifecycle. Failures here are catastrophic and hard to diagnose.
>
> **Logging note:** 12 of 16 files have no logger import. When a backend crashes, a socket disconnects, or a process manager fails, there is no trace.

| # | Story | File | Priority | Tags |
|---|-------|------|----------|------|
| 2.01 | Test auth-manager | `electron/auth-manager.ts` | P0 | |
| 2.02 | Test backend-manager | `electron/backend-manager.ts` | P0 | `[L]` — no logging for backend process lifecycle (start/stop/crash) |
| 2.03 | Test browser-session | `electron/browser-session.ts` | P1 | `[L]` |
| 2.04 | Test codebase-indexer | `electron/codebase-indexer.ts` | P1 | |
| 2.05 | Test config | `electron/config.ts` | P0 | `[L]` |
| 2.07 | Test github-manager | `electron/github-manager.ts` | P1 | `[L]` |
| 2.08 | Test main | `electron/main.ts` | P2 | |
| 2.09 | Test mcp-database-client | `electron/mcp-database-client.ts` | P1 | `[L]` |
| 2.10 | Test mlx-provider | `electron/mlx-provider.ts` | P1 | `[L]` |
| 2.11 | Test pty-manager | `electron/pty-manager.ts` | P0 | |
| 2.12 | Test socket-manager | `electron/socket-manager.ts` | P1 | `[L]` — no logging for WebSocket connect/disconnect/error events |
| 2.13 | Test touch-bar | `electron/touch-bar.ts` | P2 | `[L]` |
| 2.14 | Test commands/dispatcher | `electron/commands/dispatcher.ts` | P1 | |
| 2.15 | Test db/schema | `electron/db/schema.ts` | P0 | `[L]` |
| 2.16 | Test lsp/lsp-manager | `electron/lsp/lsp-manager.ts` | P1 | `[L]` |

**Stories:** 16 | **Estimated effort:** 3 sprints

---

## Phase 3: Security (7 untested files)

> **Why third:** Untested security code is an unverified promise. SecurityScorer, sandbox, and git-guard protect the system boundary.
>
> **Logging note:** SecurityScorer has no logger. When a security event fires and nobody logs it, it's the same as it never happening.

| # | Story | File | Priority | Tags |
|---|-------|------|----------|------|
| 3.01 | Test SecurityScorer | `electron/security/SecurityScorer.ts` | P0 | `[L]` — no logging for security score calculations or threshold events |
| 3.02 | Test env-sanitizer | `electron/security/env-sanitizer.ts` | P0 | |
| 3.03 | Test git-guard | `electron/security/git-guard.ts` | P0 | |
| 3.04 | Test security-manager | `electron/security/security-manager.ts` | P0 | `[L]` — no logging for security policy enforcement actions |
| 3.05 | Test sandbox-manager | `electron/security/sandbox-manager.ts` | P0 | |
| 3.06 | Test pty-auditor | `electron/security/pty-auditor.ts` | P1 | |
| 3.07 | Test security/index | `electron/security/index.ts` | P1 | `[L]` |

**Stories:** 7 | **Estimated effort:** 1–2 sprints

---

## Phase 4: Workflow & LLM (14 untested files)

> **Why fourth:** This is the core value prop — how Copernicus plans, dispatches, and reasons. The engine already has one test; the rest need coverage.
>
> **Error handling note:** The workflow engine silently swallows JSON.parse failures for tool call arguments — a malformed LLM response becomes a silent null instead of a retry or error path.

| # | Story | File | Priority | Tags |
|---|-------|------|----------|------|
| 4.01 | Test workflow/context-assembler | `electron/workflow/context-assembler.ts` | P0 | `[L]` |
| 4.02 | Test workflow/handoff-router | `electron/workflow/handoff-router.ts` | P0 | `[L]` |
| 4.03 | Test workflow/plan-checker | `electron/workflow/plan-checker.ts` | P1 | `[L]` |
| 4.04 | Test workflow/recovery-handoff | `electron/workflow/recovery-handoff.ts` | P0 | `[L]` |
| 4.05 | Test workflow/roles | `electron/workflow/roles.ts` | P2 | |
| 4.06 | Test workflow/snapshot-manager | `electron/workflow/snapshot-manager.ts` | P1 | `[L]` |
| 4.07 | Test workflow/states | `electron/workflow/states.ts` | P1 | |
| 4.08 | Test workflow/templates | `electron/workflow/templates.ts` | P2 | |
| 4.09 | Test workflow/types | `electron/workflow/types.ts` | P2 | |
| 4.10 | Test workflow/wave-executor | `electron/workflow/wave-executor.ts` | P0 | `[L]` |
| 4.11 | Test llm/alignment | `electron/llm/alignment.ts` | P1 | `[L]` |
| 4.12 | Test llm/config-loader | `electron/llm/config-loader.ts` | P1 | `[L]` |
| 4.13 | Test llm/hybrid-retrieval | `electron/llm/hybrid-retrieval.ts` | P1 | `[L]` |
| 4.14 | Test llm/provider-registry | `electron/llm/provider-registry.ts` | P0 | `[L]` |

**Stories:** 14 | **Estimated effort:** 3 sprints

---

## Phase 5: LLM Providers & Extensions (16 untested files)

> **Why fifth:** Provider implementations and the extension system. Providers handle credentials and API calls; extensions run third-party code.
>
> **Logging note:** Most LLM providers and extension modules lack logging. Provider failures (auth, rate limits, timeouts) are invisible. Extension lifecycle events (load, activate, crash) are invisible.
>
> **Error handling note:** RagInjector uses `console.warn` instead of logger. Extension host `index.ts` uses `console.error`.

| # | Story | File | Priority | Tags |
|---|-------|------|----------|------|
| 5.01 | Test llm/providers/google | `electron/llm/providers/google.ts` | P1 | `[L]` |
| 5.02 | Test llm/providers/ollama-anthropic | `electron/llm/providers/ollama-anthropic.ts` | P1 | `[L]` |
| 5.03 | Test llm/providers/openai | `electron/llm/providers/openai.ts` | P1 | `[L]` |
| 5.04 | Test llm/providers/openrouter | `electron/llm/providers/openrouter.ts` | P1 | `[L]` |
| 5.05 | Test llm/RagInjector | `electron/llm/RagInjector.ts` | P1 | `[C]` — `console.warn` on line 136, replace with `log.warn` |
| 5.06 | Test llm/embedding-generator | `electron/llm/embedding-generator.ts` | P1 | `[L]` |
| 5.07 | Test llm/models-cache | `electron/llm/models-cache.ts` | P1 | `[L]` |
| 5.08 | Test llm/register-builtins | `electron/llm/register-builtins.ts` | P2 | `[L]` |
| 5.09 | Test llm/service | `electron/llm/service.ts` | P1 | |
| 5.10 | Test extensions/ExtensionActivationBus | `electron/extensions/ExtensionActivationBus.ts` | P1 | `[L]` |
| 5.11 | Test extensions/ExtensionHostManager | `electron/extensions/ExtensionHostManager.ts` | P1 | `[L]` — no logging for extension host process lifecycle |
| 5.12 | Test extensions/ExtensionHostProtocol | `electron/extensions/ExtensionHostProtocol.ts` | P2 | `[L]` |
| 5.13 | Test extensions/ExtensionInstaller | `electron/extensions/ExtensionInstaller.ts` | P1 | `[L]` |
| 5.14 | Test extensions/ExtensionLoader | `electron/extensions/ExtensionLoader.ts` | P1 | |
| 5.15 | Test extensions/ExtensionRegistry | `electron/extensions/ExtensionRegistry.ts` | P1 | |
| 5.16 | Test extensions/ExtensionTrustStore | `electron/extensions/ExtensionTrustStore.ts` | P0 | `[L]` — trust decisions should be logged |

**Stories:** 16 | **Estimated effort:** 3 sprints

---

## Phase 6: Electron Remaining (19 untested files)

> **Why sixth:** Jules integration, debug tools, genesis, memory, and remaining services.

| # | Story | File | Priority | Tags |
|---|-------|------|----------|------|
| 6.01 | Test jules/dispatcher | `electron/jules/dispatcher.ts` | P1 | |
| 6.02 | Test jules/jules-client | `electron/jules/jules-client.ts` | P1 | `[L]` |
| 6.03 | Test jules/jules-manager | `electron/jules/jules-manager.ts` | P1 | |
| 6.04 | Test jules/monitor | `electron/jules/monitor.ts` | P1 | |
| 6.05 | Test jules/prompt-generator | `electron/jules/prompt-generator.ts` | P1 | `[L]` |
| 6.06 | Test debug/DapClient | `electron/debug/DapClient.ts` | P1 | |
| 6.07 | Test debug/DiagnosticsRunner | `electron/debug/DiagnosticsRunner.ts` | P1 | `[L]` |
| 6.08 | Test debug/NodeCdpShim | `electron/debug/NodeCdpShim.ts` | P2 | |
| 6.09 | Test debug/ReplayEngine | `electron/debug/ReplayEngine.ts` | P1 | `[L]` |
| 6.10 | Test genesis/genesis-runner | `electron/genesis/genesis-runner.ts` | P2 | |
| 6.11 | Test genesis/scaffold | `electron/genesis/scaffold.ts` | P2 | |
| 6.12 | Test memory/auto-extractor | `electron/memory/auto-extractor.ts` | P1 | |
| 6.13 | Test memory/jsonl-exporter | `electron/memory/jsonl-exporter.ts` | P2 | `[L]` |
| 6.14 | Test intelligence/provider-sync-engine | `electron/intelligence/provider-sync-engine.ts` | P1 | |
| 6.15 | Test local-model/KnowledgeRouter | `electron/local-model/KnowledgeRouter.ts` | P1 | |
| 6.16 | Test test-runner/TestRunner | `electron/test-runner/TestRunner.ts` | P1 | `[L]` |
| 6.17 | Test worktree/WorktreeManager | `electron/worktree/WorktreeManager.ts` | P0 | |
| 6.18 | Test kb/kb-loader | `electron/kb/kb-loader.ts` | P2 | `[L]` |
| 6.19 | Test skills/description-auditor | `electron/skills/description-auditor.ts` | P2 | `[L]` |

**Stories:** 19 | **Estimated effort:** 3–4 sprints

---

## Phase 7: Electron Utilities (10 untested files)

> **Why seventh:** Pure functions and helpers. High coverage ROI, low risk.
>
> **Error handling note:** `handle-ipc` is the foundation that all IPC handlers depend on — test it first, harden it, then the rest of Phase 1 builds on solid ground.

| # | Story | File | Priority | Tags |
|---|-------|------|----------|------|
| 7.01 | Test utils/handle-ipc | `electron/utils/handle-ipc.ts` | P0 | — already has logger; verify error envelope consistency |
| 7.02 | Test utils/logger | `electron/utils/logger.ts` | P1 | |
| 7.03 | Test utils/exec-async | `electron/utils/exec-async.ts` | P1 | `[L]` |
| 7.04 | Test utils/path-guard | `electron/utils/path-guard.ts` | P0 | `[L]` |
| 7.05 | Test utils/makefile-parser | `electron/utils/makefile-parser.ts` | P2 | `[L]` |
| 7.06 | Test utils/patch-manager | `electron/utils/patch-manager.ts` | P2 | `[L]` |
| 7.07 | Test utils/rag-benchmark | `electron/utils/rag-benchmark.ts` | P2 | `[L]` |
| 7.08 | Test utils/recent-projects | `electron/utils/recent-projects.ts` | P1 | `[L]` |
| 7.09 | Test utils/transaction-manager | `electron/utils/transaction-manager.ts` | P1 | `[L]` |
| 7.10 | Test utils/app-setup | `electron/utils/app-setup.ts` | P2 | `[L]` |

**Stories:** 10 | **Estimated effort:** 2 sprints

---

## Phase 8: Renderer Stores (15 untested files)

> **Why eighth:** Zustand stores are the renderer's nervous system. Small, self-contained, easy to mock, high leverage.

| # | Story | File | Priority | Tags |
|---|-------|------|----------|------|
| 8.01 | Test store/commandRegistry | `src/renderer/store/commandRegistry.ts` | P1 | |
| 8.02 | Test store/commandStore | `src/renderer/store/commandStore.ts` | P1 | |
| 8.03 | Test store/debug | `src/renderer/store/debug.ts` | P1 | |
| 8.04 | Test store/diagnostics | `src/renderer/store/diagnostics.ts` | P1 | |
| 8.05 | Test store/extensionStore | `src/renderer/store/extensionStore.ts` | P1 | |
| 8.06 | Test store/logViewer | `src/renderer/store/logViewer.ts` | P2 | |
| 8.07 | Test store/orchestrator | `src/renderer/store/orchestrator.ts` | P1 | |
| 8.08 | Test store/queueStore | `src/renderer/store/queueStore.ts` | P1 | |
| 8.09 | Test store/replay | `src/renderer/store/replay.ts` | P1 | |
| 8.10 | Test store/sessionStore | `src/renderer/store/sessionStore.ts` | P0 | |
| 8.11 | Test store/telemetryStore | `src/renderer/store/telemetryStore.ts` | P1 | |
| 8.12 | Test store/testRunner | `src/renderer/store/testRunner.ts` | P1 | |
| 8.13 | Test store/toastStore | `src/renderer/store/toastStore.ts` | P2 | |
| 8.14 | Test store/uiBuilderStore | `src/renderer/store/uiBuilderStore.ts` | P1 | |
| 8.15 | Test store/worktreeStore | `src/renderer/store/worktreeStore.ts` | P1 | |

**Stories:** 15 | **Estimated effort:** 2–3 sprints

---

## Phase 9: Renderer Hooks & Services (8 untested files)

> **Why ninth:** Hooks bridge IPC to React. Small, mockable, high coverage ROI.
>
> **Error handling note:** `useAppIpcListeners` has 4 empty `.catch(() => {})` — IPC listener setup failures are swallowed entirely.

| # | Story | File | Priority | Tags |
|---|-------|------|----------|------|
| 9.01 | Test hooks/useAppIpcListeners | `src/renderer/hooks/useAppIpcListeners.ts` | P0 | `[E]` — 4 empty `.catch(() => {})` on IPC listener registration |
| 9.02 | Test hooks/useCommandRegistration | `src/renderer/hooks/useCommandRegistration.ts` | P1 | |
| 9.03 | Test hooks/useIpcCache | `src/renderer/hooks/useIpcCache.ts` | P0 | |
| 9.04 | Test hooks/useIpcError | `src/renderer/hooks/useIpcError.ts` | P0 | |
| 9.05 | Test hooks/useMemoryRecall | `src/renderer/hooks/useMemoryRecall.ts` | P1 | |
| 9.06 | Test hooks/useThemeManager | `src/renderer/hooks/useThemeManager.ts` | P2 | |
| 9.07 | Test services/doc-factory | `src/renderer/services/doc-factory.ts` | P1 | |
| 9.08 | Test services/llm | `src/renderer/services/llm.ts` | P1 | |

**Stories:** 8 | **Estimated effort:** 1–2 sprints

---

## Phase 10: Renderer Components — Core (20 files)

> **Why tenth:** Complex components with logic beyond display. Prioritized by statefulness and user interaction depth.
>
> **Error handling note:** This phase contains the highest concentration of `.catch(() => {})` in the renderer — 281 unprotected `invoke()` calls project-wide, and the worst offenders are here.

| # | Story | File | Priority | Tags |
|---|-------|------|----------|------|
| 10.01 | Test App | `src/renderer/App.tsx` | P1 | `[U]` — 2 empty `.catch(() => {})` on story listing + model switch |
| 10.02 | Test Editor/MonacoEditor | `src/renderer/components/Editor/MonacoEditor.tsx` | P1 | `[U]` — 3 empty `.catch(() => {})` on LSP operations |
| 10.03 | Test Editor/DiffViewer | `src/renderer/components/Editor/DiffViewer.tsx` | P1 | |
| 10.04 | Test Editor/ReviewPanel | `src/renderer/components/Editor/ReviewPanel.tsx` | P1 | |
| 10.05 | Test Terminal/Terminal | `src/renderer/components/Terminal/Terminal.tsx` | P0 | `[U]` — 4 empty `.catch(() => {})` on terminal:input and terminal:resize |
| 10.06 | Test Terminal/TerminalTabs | `src/renderer/components/Terminal/TerminalTabs.tsx` | P1 | |
| 10.07 | Test chat/ChatPanel | `src/renderer/components/chat/ChatPanel.tsx` | P1 | |
| 10.08 | Test chat/ChatThread | `src/renderer/components/chat/ChatThread.tsx` | P1 | `[U]` — 2 empty `.catch(() => {})` on snapshot save |
| 10.09 | Test chat/ChatInput | `src/renderer/components/chat/ChatInput.tsx` | P1 | `[U]` — 2 empty `.catch(() => {})` on chat operations |
| 10.10 | Test kanban/KanbanBoard | `src/renderer/components/kanban/KanbanBoard.tsx` | P1 | |
| 10.11 | Test workflow/WorkflowCanvas | `src/renderer/components/workflow/WorkflowCanvas.tsx` | P1 | |
| 10.12 | Test debug/DebugPanel | `src/renderer/components/debug/DebugPanel.tsx` | P1 | |
| 10.13 | Test git/GitPanel | `src/renderer/components/git/GitPanel.tsx` | P1 | |
| 10.14 | Test FileTree/FileTree | `src/renderer/components/FileTree/FileTree.tsx` | P1 | `[U]` — 1 empty `.catch(() => {})` on file operation |
| 10.15 | Test layout/ApplicationHeader | `src/renderer/components/layout/ApplicationHeader.tsx` | P1 | |
| 10.16 | Test settings/SettingsPanel | `src/renderer/components/settings/SettingsPanel.tsx` | P1 | |
| 10.17 | Test browser/BrowserPanel | `src/renderer/components/browser/BrowserPanel.tsx` | P2 | |
| 10.18 | Test hub/HubLedgerPanel | `src/renderer/components/hub/HubLedgerPanel.tsx` | P2 | |
| 10.19 | Test planning/QueuePanel | `src/renderer/components/planning/QueuePanel.tsx` | P1 | |
| 10.20 | Test memory/MemoryBrowser | `src/renderer/components/memory/MemoryBrowser.tsx` | P2 | |

**Stories:** 20 | **Estimated effort:** 4–5 sprints (unwrapIpc migration adds ~20 min per `[U]` story)

---

## Phase 11: Renderer Components — Secondary (97 files)

> **Why eleventh:** Display-heavy components. Lower unit test ROI — many are better covered by e2e. Test for rendering correctness and prop handling.
>
> **Error handling note:** Wizard.tsx is the worst offender in the entire codebase — 15+ empty `.catch(() => {})` on auth key storage and project setup. A failed API key save is completely invisible to the user. StatusBar has 4 empty catches.

| # | Story | File | Priority | Tags |
|---|-------|------|----------|------|
| 11.01 | Test components/CapexModal | `src/renderer/components/CapexModal.tsx` | P2 | |
| 11.02 | Test components/CapexSidebar | `src/renderer/components/CapexSidebar.tsx` | P2 | |
| 11.03 | Test components/CapexStatus | `src/renderer/components/CapexStatus.tsx` | P2 | |
| 11.04 | Test components/CommandDeck | `src/renderer/components/CommandDeck.tsx` | P2 | |
| 11.05 | Test components/ErrorBoundary | `src/renderer/components/ErrorBoundary.tsx` | P1 | `[EB]` — uses `console.error` instead of logger; errors not persisted or reported to main process |
| 11.06 | Test components/HelpPanel | `src/renderer/components/HelpPanel.tsx` | P2 | |
| 11.07 | Test Editor/BinaryBlocker | `src/renderer/components/Editor/BinaryBlocker.tsx` | P2 | |
| 11.08 | Test Editor/CenterPanelRouter | `src/renderer/components/Editor/CenterPanelRouter.tsx` | P2 | |
| 11.09 | Test Editor/ContentPreview | `src/renderer/components/Editor/ContentPreview.tsx` | P2 | |
| 11.10 | Test Editor/DiffPanel | `src/renderer/components/Editor/DiffPanel.tsx` | P2 | |
| 11.11 | Test Editor/EditorPanel | `src/renderer/components/Editor/EditorPanel.tsx` | P2 | |
| 11.12 | Test Editor/ImageViewer | `src/renderer/components/Editor/ImageViewer.tsx` | P2 | |
| 11.13 | Test Editor/ui-builder/StitchVariantPanel | `src/renderer/components/Editor/ui-builder/StitchVariantPanel.tsx` | P2 | |
| 11.14 | Test Editor/ui-builder/UIComponentInspector | `src/renderer/components/Editor/ui-builder/UIComponentInspector.tsx` | P2 | |
| 11.15 | Test Editor/ui-builder/render | `src/renderer/components/Editor/ui-builder/render.ts` | P2 | |
| 11.16 | Test Editor/ui-builder/tile-renders (all 15 tiles) | `src/renderer/components/Editor/ui-builder/tile-renders/*.tsx` | P3 | |
| 11.17 | Test FileTree/FileTreeContextMenu | `src/renderer/components/FileTree/FileTreeContextMenu.tsx` | P2 | |
| 11.18 | Test FileTree/LspStatusPopover | `src/renderer/components/FileTree/LspStatusPopover.tsx` | P2 | |
| 11.19 | Test FileTree/NbLmTreeView | `src/renderer/components/FileTree/NbLmTreeView.tsx` | P2 | |
| 11.20 | Test capex/CapexDashboard | `src/renderer/components/capex/CapexDashboard.tsx` | P2 | `[U]` — 1 empty `.catch(() => {})` |
| 11.21 | Test capex/HeatmapView | `src/renderer/components/capex/HeatmapView.tsx` | P2 | |
| 11.22 | Test capex/ModelLeaderboard | `src/renderer/components/capex/ModelLeaderboard.tsx` | P2 | |
| 11.23 | Test capex/RetroArchiveView | `src/renderer/components/capex/RetroArchiveView.tsx` | P2 | |
| 11.24 | Test chat/ChatBackFace | `src/renderer/components/chat/ChatBackFace.tsx` | P2 | |
| 11.25 | Test chat/ChatMessage | `src/renderer/components/chat/ChatMessage.tsx` | P2 | `[U]` — 1 empty `.catch(() => {})` on memory add |
| 11.26 | Test chat/ContextChip | `src/renderer/components/chat/ContextChip.tsx` | P2 | |
| 11.27 | Test chat/GuideCopernicus | `src/renderer/components/chat/GuideCopernicus.tsx` | P2 | |
| 11.28 | Test chat/UIUpdateChip | `src/renderer/components/chat/UIUpdateChip.tsx` | P2 | |
| 11.29 | Test chat/CopernicusKnowledgeBase | `src/renderer/components/chat/CopernicusKnowledgeBase.ts` | P2 | |
| 11.30 | Test chat/useChatPanel | `src/renderer/components/chat/useChatPanel.ts` | P1 | `[U]` — 3 empty `.catch(() => {})` on panel operations |
| 11.31 | Test command/CommandCenter | `src/renderer/components/command/CommandCenter.tsx` | P2 | |
| 11.32 | Test database/DatabasePanel | `src/renderer/components/database/DatabasePanel.tsx` | P2 | |
| 11.33 | Test debug/CallStack | `src/renderer/components/debug/CallStack.tsx` | P2 | `[U]` — 1 empty `.catch(() => {})` on debug navigation |
| 11.34 | Test debug/DiagnosticsPanel | `src/renderer/components/debug/DiagnosticsPanel.tsx` | P2 | |
| 11.35 | Test debug/LogViewer | `src/renderer/components/debug/LogViewer.tsx` | P2 | |
| 11.36 | Test debug/ReplayPanel | `src/renderer/components/debug/ReplayPanel.tsx` | P2 | |
| 11.37 | Test debug/TestExplorer | `src/renderer/components/debug/TestExplorer.tsx` | P2 | |
| 11.38 | Test debug/VariableWatch | `src/renderer/components/debug/VariableWatch.tsx` | P2 | |
| 11.39 | Test genesis/GenesisWizard | `src/renderer/components/genesis/GenesisWizard.tsx` | P2 | |
| 11.40 | Test git/BranchSelector | `src/renderer/components/git/BranchSelector.tsx` | P2 | |
| 11.41 | Test github/GithubDashboard | `src/renderer/components/github/GithubDashboard.tsx` | P2 | |
| 11.42 | Test hub/ContractProposalPanel | `src/renderer/components/hub/ContractProposalPanel.tsx` | P2 | |
| 11.43 | Test hub/OrgChartPanel | `src/renderer/components/hub/OrgChartPanel.tsx` | P2 | `[U]` — 1 empty `.catch(() => {})` |
| 11.44 | Test hub/RoleCard | `src/renderer/components/hub/RoleCard.tsx` | P2 | |
| 11.45 | Test intelligence/IntelligenceManager | `src/renderer/components/intelligence/IntelligenceManager.tsx` | P2 | |
| 11.46 | Test intelligence/IntelligenceSuggestBanner | `src/renderer/components/intelligence/IntelligenceSuggestBanner.tsx` | P2 | |
| 11.47 | Test intelligence/NotebookLMSection | `src/renderer/components/intelligence/NotebookLMSection.tsx` | P2 | |
| 11.48 | Test kanban/CardSpotlight | `src/renderer/components/kanban/CardSpotlight.tsx` | P2 | |
| 11.49 | Test kanban/RetroCard | `src/renderer/components/kanban/RetroCard.tsx` | P2 | |
| 11.50 | Test kanban/RetroReviewPanel | `src/renderer/components/kanban/RetroReviewPanel.tsx` | P2 | |
| 11.51 | Test kb/KbArticle | `src/renderer/components/kb/KbArticle.tsx` | P2 | |
| 11.52 | Test kb/KbTree | `src/renderer/components/kb/KbTree.tsx` | P2 | |
| 11.53 | Test kb/KnowledgeBaseView | `src/renderer/components/kb/KnowledgeBaseView.tsx` | P2 | |
| 11.54 | Test layout/ActivityBar | `src/renderer/components/layout/ActivityBar.tsx` | P2 | |
| 11.55 | Test layout/AgentTelemetryOverlay | `src/renderer/components/layout/AgentTelemetryOverlay.tsx` | P2 | |
| 11.56 | Test layout/CommandPalette | `src/renderer/components/layout/CommandPalette.tsx` | P2 | |
| 11.57 | Test layout/ErrorBoundary (layout) | `src/renderer/components/layout/ErrorBoundary.tsx` | P1 | `[EB]` — duplicate ErrorBoundary; consolidate and wire to logger |
| 11.58 | Test layout/FlippablePanel | `src/renderer/components/layout/FlippablePanel.tsx` | P2 | |
| 11.59 | Test layout/Header | `src/renderer/components/layout/Header.tsx` | P2 | |
| 11.60 | Test layout/ProjectSelectorDialog | `src/renderer/components/layout/ProjectSelectorDialog.tsx` | P2 | |
| 11.61 | Test layout/SharedPanelHeader | `src/renderer/components/layout/SharedPanelHeader.tsx` | P2 | |
| 11.62 | Test layout/Splash | `src/renderer/components/layout/Splash.tsx` | P2 | |
| 11.63 | Test layout/SplashScreen | `src/renderer/components/layout/SplashScreen.tsx` | P2 | |
| 11.64 | Test layout/SpotlightContainer | `src/renderer/components/layout/SpotlightContainer.tsx` | P2 | |
| 11.65 | Test layout/StatusBar | `src/renderer/components/layout/StatusBar.tsx` | P2 | `[U]` — 4 empty `.catch(() => {})` on status update invokes |
| 11.66 | Test layout/StatusBarOverlay | `src/renderer/components/layout/StatusBarOverlay.tsx` | P2 | |
| 11.67 | Test layout/TechnicalPulseOverlay | `src/renderer/components/layout/TechnicalPulseOverlay.tsx` | P2 | |
| 11.68 | Test layout/ToastContainer | `src/renderer/components/layout/ToastContainer.tsx` | P2 | |
| 11.69 | Test memory/MemoryReplayView | `src/renderer/components/memory/MemoryReplayView.tsx` | P2 | |
| 11.70 | Test orchestrator/TileInspector | `src/renderer/components/orchestrator/TileInspector.tsx` | P2 | `[U]` — 1 empty `.catch(() => {})` |
| 11.71 | Test orchestrator/TileLibrary | `src/renderer/components/orchestrator/TileLibrary.tsx` | P2 | |
| 11.72 | Test orchestrator/WorktreePanel | `src/renderer/components/orchestrator/WorktreePanel.tsx` | P2 | |
| 11.73 | Test output/OutputView | `src/renderer/components/output/OutputView.tsx` | P2 | |
| 11.74 | Test planning/EpicBadge | `src/renderer/components/planning/EpicBadge.tsx` | P2 | |
| 11.75 | Test planning/StoryInspector | `src/renderer/components/planning/StoryInspector.tsx` | P2 | `[U]` — 4 empty `.catch(() => {})` on story operations |
| 11.76 | Test project/ProjectSwitcher | `src/renderer/components/project/ProjectSwitcher.tsx` | P2 | |
| 11.77 | Test providers/MLXProviderPanel | `src/renderer/components/providers/MLXProviderPanel.tsx` | P2 | |
| 11.78 | Test review/ReviewPanel | `src/renderer/components/review/ReviewPanel.tsx` | P2 | |
| 11.79 | Test search/SearchDrawer | `src/renderer/components/search/SearchDrawer.tsx` | P2 | |
| 11.80 | Test search/SearchPanel | `src/renderer/components/search/SearchPanel.tsx` | P2 | |
| 11.81 | Test settings/AuthSettings | `src/renderer/components/settings/AuthSettings.tsx` | P2 | |
| 11.82 | Test settings/RAGSettings | `src/renderer/components/settings/RAGSettings.tsx` | P2 | |
| 11.83 | Test settings/TelemetryStatusTile | `src/renderer/components/settings/TelemetryStatusTile.tsx` | P2 | |
| 11.84 | Test skills/SkillOnboardingModal | `src/renderer/components/skills/SkillOnboardingModal.tsx` | P2 | |
| 11.85 | Test source-control/SourceControlView | `src/renderer/components/source-control/SourceControlView.tsx` | P2 | |
| 11.86 | Test telemetry/TelemetryPanel | `src/renderer/components/telemetry/TelemetryPanel.tsx` | P2 | |
| 11.87 | Test testing/UITestDrawer | `src/renderer/components/testing/UITestDrawer.tsx` | P2 | |
| 11.88 | Test wizard/AuthCliWidget | `src/renderer/components/wizard/AuthCliWidget.tsx` | P2 | `[U]` — 2 empty `.catch(() => {})` on auth CLI operations |
| 11.89 | Test wizard/LocalAIStep | `src/renderer/components/wizard/LocalAIStep.tsx` | P2 | `[U]` — 2 empty `.catch(() => {})` on local AI setup |
| 11.90 | Test wizard/Wizard | `src/renderer/components/wizard/Wizard.tsx` | P2 | `[U]` — **15+ empty `.catch(() => {})`** on API key storage + project setup — worst offender in codebase |
| 11.91 | Test wizard/WizardNarration | `src/renderer/components/wizard/WizardNarration.tsx` | P2 | |
| 11.92 | Test workflow/DispatchQueue | `src/renderer/components/workflow/DispatchQueue.tsx` | P2 | |
| 11.93 | Test workflow/NodeInspector | `src/renderer/components/workflow/NodeInspector.tsx` | P2 | |
| 11.94 | Test workflow/ScheduleInput | `src/renderer/components/workflow/ScheduleInput.tsx` | P2 | |
| 11.95 | Test renderer/utils/fileUtils | `src/renderer/utils/fileUtils.ts` | P2 | |
| 11.96 | Test renderer/utils/logger | `src/renderer/utils/logger.ts` | P2 | |
| 11.97 | Test renderer/utils/storyTitle | `src/renderer/utils/storyTitle.ts` | P2 | |

**Stories:** 97 | **Estimated effort:** 9–11 sprints (error handling remediation adds time to tagged stories)

---

## Phase 12: Electron Data & Extension Host (8 untested files)

> **Why last:** Default data, types, and extension host runtime. Low mutation risk, mostly configuration.
>
> **Error handling note:** Extension host `index.ts` uses `console.error` instead of logger for startup failure.

| # | Story | File | Priority | Tags |
|---|-------|------|----------|------|
| 12.01 | Test data/default-personas | `electron/data/default-personas.ts` | P2 | |
| 12.02 | Test data/default-templates | `electron/data/default-templates.ts` | P2 | |
| 12.03 | Test extensions/host/ExtensionApiProxy | `electron/extensions/host/ExtensionApiProxy.ts` | P2 | |
| 12.04 | Test extensions/host/ExtensionHostRuntime | `electron/extensions/host/ExtensionHostRuntime.ts` | P2 | |
| 12.05 | Test extensions/host/index | `electron/extensions/host/index.ts` | P3 | `[C]` — `console.error('Host failed to start')` on line 21, replace with `log.error` |
| 12.06 | Test extensions/api | `electron/extensions/api.ts` | P2 | `[L]` |
| 12.07 | Test extensions/types | `electron/extensions/types.ts` | P3 | |
| 12.08 | Test genesis/types | `electron/genesis/types.ts` | P3 | |

**Stories:** 8 | **Estimated effort:** 1 sprint

---

## Summary

| Phase | Area | Stories | `[L]` | `[E]` | `[C]` | `[U]` | `[EB]` | Est. Sprints |
|-------|------|---------|-------|-------|-------|-------|--------|--------------|
| 1 | IPC Handlers | 39 | 24 | 5 | 0 | 0 | 0 | 7–9 |
| 2 | Electron Core Services | 16 | 9 | 0 | 0 | 0 | 0 | 3 |
| 3 | Security | 7 | 3 | 0 | 0 | 0 | 0 | 1–2 |
| 4 | Workflow & LLM | 14 | 8 | 0 | 0 | 0 | 0 | 3 |
| 5 | LLM Providers & Extensions | 16 | 10 | 0 | 1 | 0 | 0 | 3 |
| 6 | Electron Remaining | 19 | 7 | 0 | 0 | 0 | 0 | 3–4 |
| 7 | Electron Utilities | 10 | 7 | 0 | 0 | 0 | 0 | 2 |
| 8 | Renderer Stores | 15 | 0 | 0 | 0 | 0 | 0 | 2–3 |
| 9 | Renderer Hooks & Services | 8 | 0 | 1 | 0 | 0 | 0 | 1–2 |
| 10 | Renderer Components — Core | 20 | 0 | 0 | 0 | 6 | 0 | 4–5 |
| 11 | Renderer Components — Secondary | 97 | 0 | 0 | 0 | 10 | 2 | 9–11 |
| 12 | Data, Types & Extension Host | 8 | 1 | 0 | 1 | 0 | 0 | 1 |
| | **Total** | **269** | **69** | **6** | **2** | **16** | **2** | **39–48** |

**Remediation totals:**
- **69 files** need logger import added (`[L]`)
- **6 files** have empty catch blocks to fix (`[E]`)
- **2 files** use console.* instead of logger (`[C]`)
- **16 renderer files** need `.catch(() => {})` replaced with `unwrapIpc()` or try/catch (`[U]`)
- **2 ErrorBoundary files** need logger wiring (`[EB]`)

**Already covered (existing tests):** 22 files (20 electron + 2 renderer)
**New stories needed:** 269
**Total source files:** ~291 untested + 22 tested = ~313

---

## Remediation Patterns

### `[L]` — Add logger import
```typescript
import log from '../utils/logger'
// Add log.info/warn/error at key decision points:
// - Function entry for lifecycle events
// - Error paths (alongside existing error returns)
// - State transitions (process start/stop, connect/disconnect)
```

### `[E]` — Replace empty catch blocks (electron)
```typescript
// Before:
catch (e) {}
// After:
catch (e) { log.error('[module-name] operation failed:', e) }
```

### `[C]` — Replace console.* with logger
```typescript
// Before:
console.warn("[Non-critical]", err)
console.error('Host failed to start', err)
// After:
log.warn("[Non-critical]", err)
log.error('Host failed to start', err)
```

### `[U]` — Replace empty .catch(() => {}) in renderer
```typescript
// Before:
await invoke('auth:store-api-key', 'anthropic', key).catch(() => {})
// After (option A — unwrapIpc + try/catch):
try {
  const result = await invoke('auth:store-api-key', 'anthropic', key)
  unwrapIpc(result)
} catch (e) {
  showToast({ type: 'error', message: 'Failed to store API key' })
}

// After (option B — for non-critical operations, at least log):
await invoke('terminal:input', { id, data }).catch((e) =>
  console.error('[Terminal] input failed:', e)
)
```

### `[EB]` — Wire ErrorBoundary to logger
```typescript
// Before:
componentDidCatch(error, errorInfo) {
  console.error('[ErrorBoundary]', error, errorInfo)
}
// After:
componentDidCatch(error, errorInfo) {
  invoke('log:error', { message: error.message, stack: error.stack, componentStack: errorInfo.componentStack })
}
// Also: consolidate duplicate ErrorBoundary components into one shared component
```

---

## Sprint Cadence Recommendation

- **Sprint length:** 1 week
- **Sprint capacity:** 5–7 stories per sprint (mix of P0/P1/P2)
- **P0 stories first:** Within each phase, knock out all P0s before moving to P1s
- **Parallel tracks:** Phase 1 + Phase 3 can run concurrently (IPC + Security are independent)
- **Phase 8 + 9 can overlap** with Phase 5+6 (renderer stores/hooks are independent of electron services)
- **E2e augmentation:** Add e2e stories for each Phase 1–4 IPC/workflow handler alongside unit tests
- **Remediation tax:** Each tagged story adds ~15–20 min. `[U]` stories with many catches (Wizard.tsx: 15+) may take 30–45 min extra.

### First 4 Sprints (P0 Critical)

| Sprint | Stories | Focus |
|--------|---------|-------|
| 1 | 1.01–1.06, 1.08, 1.14, 1.21, 1.25 | Core IPC: auth, app, chat, file, git, memory, project, deps — add logging, fix auth/git error handling |
| 2 | 1.27, 1.31, 1.34, 1.35, 2.01, 2.02, 2.05, 2.11, 2.15 | IPC registration, security/terminal handlers + core services — add logging to backend-manager, socket-manager, pty-manager |
| 3 | 3.01–3.07, 4.01, 4.02, 4.05, 4.10, 4.14 | Security phase + workflow critical path — add logging to SecurityScorer, security-manager, all workflow modules |
| 4 | 7.01, 7.04, 8.10, 9.01, 9.03, 9.04, 10.05, 2.03, 2.15 | handle-ipc utility + session store + fix useAppIpcListeners empty catches + fix Terminal empty catches |
