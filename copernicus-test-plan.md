# Copernicus Test Plan

**Target:** Electron + React/Vite frontend coverage (vitest + Playwright)

---

## Frontend: Electron Main Process

### IPC Channel Inventory

| Channel | Handler File | Description | Risk |
|---------|-------------|-------------|------|
| `ipcMain.handle` (60+) | `register-all-handlers.ts` | Central registration point for all IPC handlers | HIGH |
| `app:workspace-changed` | `app-handlers.ts` | Emitted on workspace switch; updates renderer state | HIGH |
| `app:switch-workspace` | `app-handlers.ts` | Apply workspace with rollback on failure | HIGH |
| `app:get-env-state` | `app-handlers.ts` | Validate state consistency across sources | MEDIUM |
| `devtime:*` (6 handlers) | `app-handlers.ts` | Devtime analytics, test runs, Playwright execution | MEDIUM |
| `ledger:*` (6 handlers) | `app-handlers.ts` | Model call costs, session stats, cost analytics | MEDIUM |
| `oauth:*` (4 handlers) | `auth-handlers.ts` | OpenRouter/Google OAuth flows, PKCE | HIGH |
| `auth:*` (4 handlers) | `auth-handlers.ts` | API key storage, validation, resolution | MEDIUM |
| `git:*` (3 handlers) | `app-handlers.ts` | Branch detection, workspace init | LOW |
| `mcp:*` (4 handlers) | `app-handlers.ts` | MCP server list/status/test | LOW |
| `chat:*` (3 handlers) | `chat-handlers.ts` | LLM streaming, model switching, knowledge injection | HIGH |
| `memory:*` (3 handlers) | `app-handlers.ts` | Working set recall, project memory | MEDIUM |
| `stories:*` | `story-handlers.ts` | Story listing, status sync | MEDIUM |
| `kanban:*` (2 handlers) | `register-all-handlers.ts` | Column CRUD with drift sync | MEDIUM |
| `fs:*` | `file-handlers.ts` | File operations, path validation | MEDIUM |
| `terminal:*` | `terminal-handlers.ts` | PTY spawning, ephemeral terminals | MEDIUM |
| `lsp:*` | `lsp-handlers.ts` | LSP lifecycle management | MEDIUM |
| `workflow:*` | `workflow-handlers.ts` | Workflow engine coordination | HIGH |
| `extension:*` | `extension-handlers.ts` | Extension lifecycle, registry | MEDIUM |
| `jules:*` | `jules-handlers.ts` | Jules session dispatch, PR monitoring | HIGH |
| `security:*` | `security-handlers.ts` | Git push approval, trust lists | MEDIUM |
| `db:*` (3 handlers) | `app-handlers.ts` | State ledger operations | MEDIUM |

### Gap Inventory

| Gap | Risk | Description |
|-----|------|-------------|
| **No handler tests** | HIGH | All IPC handlers lack unit tests; coverage = 0% |
| **Mock strategy undefined** | MEDIUM | Electron `ipcMain.handle` cannot be mocked natively; requires `electron-mock` or `@electron/test` |
| **State mutation untested** | HIGH | Handlers like `applyWorkspace` mutate global state (`settingsStore`, `fsManager`) without isolation |
| **Async error handling** | MEDIUM | `handleIpc()` wrapper errors not tested; error propagation unclear |
| **Security boundary** | HIGH | `assertSafePath()` and `handleIpc()` validation not covered |
| **DRY violation** | LOW | `handleIpc()` duplication across handlers |

### Recommended Test Files

```
# Main Process (vitest)
copernicus/electron/ipc/app-handlers.test.ts          # Workspace, devtime, ledger handlers
copernicus/electron/ipc/auth-handlers.test.ts          # OAuth, auth handlers
copernicus/electron/ipc/chat-handlers.test.ts          # LLM streaming, model switching
copernicus/electron/ipc/story-handlers.test.ts        # Story operations
copernicus/electron/ipc/file-handlers.test.ts          # File operations
copernicus/electron/ipc/workflow-handlers.test.ts      # Workflow engine
copernicus/electron/ipc/jules-handlers.test.ts         # Jules integration
copernicus/electron/ipc/security-handlers.test.ts      # Security handlers

# Shared utilities
copernicus/electron/utils/handle-ipc.test.ts           # IPC error handling contract
copernicus/electron/utils/patch-manager.test.ts        # Patch application
copernicus/electron/utils/rag-benchmark.test.ts        # RAG benchmarking
```

**Test Strategy:**
- Use `@electron/test` or `electron-mock` to mock `ipcMain.handle`
- Create `IpcHandlerDeps` mock with stubbed managers (`settingsStore`, `fsManager`, `storiesManager`)
- Test happy path + error paths for each handler
- Verify `handleIpc()` error propagation and `unwrapIpc()` contract

---

## Frontend: React Renderer

### Key Components with IPC Dependencies

| Component | IPC Calls | IPC Hook | Risk |
|-----------|-----------|----------|------|
| `ChatPanel` | `chat:send`, `ledger:session-stats` | `useChatPanel` → `useIpcError` | HIGH |
| `MemoryBrowser` | `app:get-root-path`, `memory:get-working-set` | `useIpcError` | MEDIUM |
| `GitPanel` | `git:branch`, `app:get-env-state` | `useIpcError` | MEDIUM |
| `KanbanColumn` | `kanban:get-columns`, `kanban:set-column` | `useIpcError` | MEDIUM |
| `Wizard` | `app:get-root-path`, `wizard:get-username` | `useIpcError` | MEDIUM |
| `Settings` | `settings:load`, `settings:save` | `useIpcError` | MEDIUM |
| `Terminal` | `terminal:spawn`, `terminal:set-busy` | `useIpcError` | MEDIUM |
| `LspStatus` | `lsp:get-status` | `useIpcError` | LOW |
| `AuthModal` | `auth:status`, `oauth:start-*` | `useIpcError` | HIGH |
| `CapexModal` | `ledger:cost-by-story`, `ledger:cost-by-model` | `useIpcError` | MEDIUM |
| `ReviewPanel` | `review:session-complete` (event) | `useAppIpcListeners` | MEDIUM |

### Hooks with IPC

| Hook | IPC Channel | Contract | Risk |
|------|-------------|----------|------|
| `useIpcError` | Wrapper | `invoke<T>(channel, ...args) → T` with error toasting | MEDIUM |
| `useIpcCache` | Cache wrapper | TTL-based caching with deduplication | MEDIUM |
| `useMemoryRecall` | `memory:get-working-set` | Returns `{ memories, loading }` | MEDIUM |
| `useAppIpcListeners` | Event listeners | 20+ event listeners (workspace, terminal, stories) | HIGH |

### Gap Inventory

| Gap | Risk | Description |
|-----|------|-------------|
| **No IPC mock** | HIGH | `window.ipcRenderer.invoke` cannot be mocked; requires `electron-mock` or `jest-electron` |
| **Error handling** | HIGH | `useIpcError` toasts errors but doesn't prevent propagation; components assume success |
| **Cache invalidation** | MEDIUM | `useIpcCache` shared state not tested; race conditions possible |
| **Event listener leaks** | MEDIUM | `useAppIpcListeners` registers 20+ listeners; cleanup not verified |
| **Async loading** | MEDIUM | Components assume IPC resolves synchronously; loading states not tested |
| **Type safety** | LOW | `unwrapIpc` assumes `IpcResult<T>` shape; invalid data causes runtime errors |

### Recommended Test Files

```
# Components (React Testing Library + electron-mock)
copernicus/src/renderer/components/chat/ChatPanel.test.tsx
copernicus/src/renderer/components/memory/MemoryBrowser.test.tsx
copernicus/src/renderer/components/git/GitPanel.test.tsx
copernicus/src/renderer/components/kanban/KanbanColumn.test.tsx
copernicus/src/renderer/components/wizard/Wizard.test.tsx

copernicus/src/renderer/components/common/Toast.test.tsx
copernicus/src/renderer/components/common/Editor/Editor.test.tsx
copernicus/src/renderer/components/layout/ErrorBoundary.test.tsx

copernicus/src/renderer/components/settings/Settings.test.tsx
copernicus/src/renderer/components/auth/AuthModal.test.tsx
copernicus/src/renderer/components/capex/CapexModal.test.tsx

# Hooks
copernicus/src/renderer/hooks/useIpcError.test.ts
copernicus/src/renderer/hooks/useIpcCache.test.ts
copernicus/src/renderer/hooks/useMemoryRecall.test.ts
copernicus/src/renderer/hooks/useAppIpcListeners.test.ts
```

**Test Strategy:**
- Mock `window.ipcRenderer.invoke` to return `{ ok: true, data: mock }`
- Test error handling: mock `invoke` to throw → verify `useIpcError` toasts error
- Test `useIpcCache` deduplication: concurrent calls should resolve to same promise
- Test `useAppIpcListeners` cleanup: unmount should remove all listeners

---

## Implementation Roadmap

| Priority | Filename | What it tests | Est. hours |
|----------|----------|---------------|------------|
| **P0** | `copernicus/electron/ipc/handle-ipc.test.ts` | IPC contract, error propagation | 2 |
| **P0** | `copernicus/electron/ipc/app-handlers.test.ts` | Workspace switching, rollback, state consistency | 8 |
| **P0** | `copernicus/electron/ipc/auth-handlers.test.ts` | OAuth flows, PKCE, API key validation | 6 |
| **P0** | `copernicus/electron/ipc/chat-handlers.test.ts` | LLM streaming, model switching, knowledge injection | 6 |
| **P1** | `copernicus/electron/ipc/story-handlers.test.ts` | Story operations, list, status | 4 |
| **P1** | `copernicus/electron/ipc/workflow-handlers.test.ts` | Workflow engine, snapshots | 6 |
| **P1** | `copernicus/electron/ipc/jules-handlers.test.ts` | Jules dispatch, PR monitoring | 6 |
| **P1** | `copernicus/src/renderer/hooks/useIpcError.test.ts` | Error handling contract, toasting | 2 |
| **P1** | `copernicus/src/renderer/hooks/useIpcCache.test.ts` | Cache deduplication, TTL | 3 |
| **P1** | `copernicus/src/renderer/components/chat/ChatPanel.test.tsx` | Chat UI, model switching | 6 |
| **P1** | `copernicus/src/renderer/components/memory/MemoryBrowser.test.tsx` | Memory recall, file navigation | 4 |
| **P2** | `copernicus/electron/ipc/git-handlers.test.ts` | Git operations, workspace init | 2 |
| **P2** | `copernicus/src/renderer/components/git/GitPanel.test.tsx` | Git UI, branch detection | 3 |
| **P2** | `copernicus/src/renderer/components/kanban/KanbanColumn.test.tsx` | Kanban CRUD | 3 |
| **P2** | `copernicus/electron/ipc/security-handlers.test.ts` | Security, trust lists | 4 |
| **P2** | `copernicus/src/renderer/components/wizard/Wizard.test.tsx` | Onboarding flow | 3 |
| **P3** | `copernicus/src/renderer/hooks/useAppIpcListeners.test.ts` | Event listener lifecycle | 4 |
| **P3** | `copernicus/src/renderer/components/settings/Settings.test.tsx` | Settings persistence | 3 |
| **P3** | `copernicus/src/renderer/components/terminal/Terminal.test.tsx` | PTY spawning, ephemeral terminals | 4 |
| **P3** | `copernicus/electron/ipc/file-handlers.test.ts` | File operations, path validation | 3 |
| **P3** | `copernicus/src/renderer/components/layout/ErrorBoundary.test.tsx` | Error boundary behavior | 2 |
| **P3** | `copernicus/src/renderer/components/capex/CapexModal.test.tsx` | Cost analytics | 3 |

**Total Frontend Effort:** ~108 hours

---

## CI Configuration

```yaml
name: Frontend Coverage

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Run vitest
        run: npm run test:unit -- --coverage --reporter=json
        continue-on-error: true
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          flags: frontend
      
      - name: Run Playwright E2E
        run: npx playwright test --project=chromium --reporter=json
        continue-on-error: true
      
      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

---

## Total Effort Estimate

| Category | Hours |
|----------|-------|
| Backend (existing) | 120 |
| **Frontend Unit** | **108** |
| **Frontend E2E** | **48** |
| **Total** | **276 hours** |

**Breakdown:**
- Backend: 120h (16 sections × 7.5h avg)
- Frontend Unit: 108h (IPC handlers + React components + hooks)
- Frontend E2E: 48h (Critical paths: workspace switch, chat, auth, kanban)

---

---
*Plan by qwopus (Claude Opus 4.7) · Completed: 2026-05-21T14:30:00Z*
