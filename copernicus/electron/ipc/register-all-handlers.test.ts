import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ipcMain, app, BrowserWindow } from 'electron'
import path from 'node:path'

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
  app: {
    getPath: vi.fn((key: string) => {
      if (key === 'home') return '/mock/home'
      if (key === 'userData') return '/mock/userData'
      return '/mock/app'
    }),
    getAppPath: vi.fn(() => '/mock/app/main.js'),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}))

vi.mock('node:path', async () => {
  const actual = await vi.importActual('node:path')
  return {
    ...(actual as any),
    join: vi.fn((...args: string[]) => args.join('/')),
  }
})

vi.mock('../utils/handle-ipc', () => ({
  handleIpc: vi.fn(async (channelOrFn, argsOrNothing, fnOrNothing) => {
    let fn: () => any
    if (typeof channelOrFn === 'function') {
      fn = channelOrFn
    } else {
      fn = fnOrNothing as () => any
    }
    try {
      const result = await fn()
      return { ok: true, data: result }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }),
}))

vi.mock('../worktree/WorktreeManager', () => ({
  WorktreeManager: vi.fn().mockImplementation(() => ({
    getWorktrees: vi.fn(() => []),
  })),
}))

vi.mock('../extensions/ExtensionRegistry', () => ({
  ExtensionRegistry: {
    getInstance: vi.fn(() => ({
      getExtensions: vi.fn(() => []),
    })),
  },
}))

vi.mock('../extensions/ExtensionLoader', () => ({
  ExtensionLoader: vi.fn().mockImplementation(() => ({
    loadAll: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock('../main', () => ({
  getExtensionHostManager: vi.fn(() => undefined),
}))

vi.mock('../genesis/genesis-runner', () => ({
  GenesisRunner: vi.fn().mockImplementation(() => ({})),
}))

vi.mock('../genesis/scaffold', () => ({
  ScaffoldRunner: vi.fn().mockImplementation(() => ({})),
}))

vi.mock('../workflow/snapshot-manager', () => ({
  SnapshotManager: vi.fn().mockImplementation(() => ({})),
}))

vi.mock('../security', () => ({
  registerSecurityHandlers: vi.fn(),
  securityManager: null,
}))

vi.mock('../db/state-ledger', () => ({
  stateLedger: {
    db: {},
    getKanbanColumns: vi.fn(() => []),
    setKanbanColumn: vi.fn(() => ({})),
  },
}))

vi.mock('../fs-manager', () => ({
  fsManager: {
    getRootPath: vi.fn(() => '/mock/project'),
  },
}))

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual('node:child_process')
  return {
    ...(actual as any),
    spawn: vi.fn(),
    execFile: vi.fn(),
  }
})

vi.mock('./extension-handlers', () => ({
  registerExtensionHandlers: vi.fn(),
}))

vi.mock('./worktree-handlers', () => ({
  registerWorktreeHandlers: vi.fn(),
}))

vi.mock('./file-handlers', () => ({
  register: vi.fn(),
}))

vi.mock('./auth-handlers', () => ({
  register: vi.fn(),
}))

vi.mock('./model-handlers', () => ({
  register: vi.fn(),
}))

vi.mock('./chat-handlers', () => ({
  register: vi.fn(),
}))

vi.mock('./story-handlers', () => ({
  register: vi.fn(),
}))

vi.mock('./workflow-handlers', () => ({
  register: vi.fn(),
}))

vi.mock('./terminal-handlers', () => ({
  register: vi.fn(),
}))

vi.mock('./terminal-agent-handlers', () => ({
  register: vi.fn(),
}))

vi.mock('./app-handlers', () => ({
  register: vi.fn(),
}))

vi.mock('./capex-handlers', () => ({
  registerCapexHandlers: vi.fn(),
}))

vi.mock('./genesis-handlers', () => ({
  register: vi.fn(),
}))

vi.mock('./git-handlers', () => ({
  register: vi.fn(),
}))

vi.mock('./search-handlers', () => ({
  register: vi.fn(),
}))

vi.mock('./diagnostics-handlers', () => ({
  register: vi.fn(),
}))

vi.mock('./test-handlers', () => ({
  register: vi.fn(() => vi.fn()),
}))

vi.mock('./diag-handlers', () => ({
  register: vi.fn(),
}))

vi.mock('./log-handlers', () => ({
  registerLogHandlers: vi.fn(),
}))

vi.mock('./lsp-handlers', () => ({
  register: vi.fn(),
}))

vi.mock('./security-handlers', () => ({
  register: vi.fn(),
}))

vi.mock('./local-model-handlers', () => ({
  register: vi.fn(),
}))

vi.mock('./replay-handlers', () => ({
  registerReplayHandlers: vi.fn(() => vi.fn()),
}))

vi.mock('./debug-handlers', () => ({
  register: vi.fn(() => vi.fn()),
  registerDebugHandlers: vi.fn(() => vi.fn()),
}))

vi.mock('./stitch-handlers', () => ({
  registerStitchHandlers: vi.fn(),
}))

vi.mock('./memory-handlers', () => ({
  registerMemoryHandlers: vi.fn(),
}))

vi.mock('./retro-handlers', () => ({
  registerRetroHandlers: vi.fn(),
}))

vi.mock('./intel-handlers', () => ({
  registerIntelHandlers: vi.fn(),
}))

vi.mock('./jules-handlers', () => ({
  registerJulesHandlers: vi.fn(),
}))

vi.mock('./notebooklm-handlers', () => ({
  register: vi.fn(),
}))

vi.mock('./daemon-handlers', () => ({
  registerDaemonHandlers: vi.fn(),
}))

vi.mock('./wizard-pty-handlers', () => ({
  registerWizardPtyHandlers: vi.fn(),
}))

vi.mock('./project-handlers', () => ({
  registerProjectHandlers: vi.fn(),
}))

vi.mock('./openrouter-handlers', () => ({
  registerOpenRouterHandlers: vi.fn(),
}))

vi.mock('./provider-handlers', () => ({
  registerProviderHandlers: vi.fn(),
}))

vi.mock('./kb-handlers', () => ({
  registerKbHandlers: vi.fn(),
}))

vi.mock('./browser-handlers', () => ({
  registerBrowserHandlers: vi.fn(),
}))

vi.mock('./db-mcp-handlers', () => ({
  registerDbMcpHandlers: vi.fn(),
}))

vi.mock('./mlx-handlers', () => ({
  registerMlxHandlers: vi.fn(),
}))

vi.mock('./hub-handlers', () => ({
  registerHubHandlers: vi.fn(),
}))

vi.mock('../../../scripts/agent-daemon/lib/hub.mjs', () => ({
  syncUserAction: vi.fn(),
  syncStoryState: vi.fn(),
}))

vi.mock('../memory/jsonl-exporter', () => ({
  jsonlExporter: {
    export: vi.fn().mockResolvedValue(undefined),
    hashProjectId: vi.fn(() => 'mock-hash'),
  },
}))

describe('register-all-handlers', () => {
  const mockWin = { webContents: { send: vi.fn() } } as unknown as BrowserWindow
  const mockDeps = {
    authManager: {},
    modelRegistry: {},
    settingsStore: {},
    storiesManager: {},
    devtimeManager: {},
    fsManager: { getRootPath: vi.fn(() => '/mock/project') },
    workflowEngine: { setSnapshotManager: vi.fn(), setServices: vi.fn() },
    codebaseIndexer: {},
    hybridRetriever: {},
    browserSession: {},
    ptyManager: {},
    socketManager: {},
    stateLedger: { db: {} },
    llmService: {},
    lspManager: {},
    backendManager: {},
    julesClient: {},
    julesMonitor: {},
    julesManager: {},
    layoutStore: { getTerminals: vi.fn(() => []) },
    applyAndVerifyPatch: vi.fn(),
    reversePatch: vi.fn(),
    runRAGBenchmark: vi.fn(),
    getPlaywright: vi.fn(),
    LOG_DIR: '/mock/logs',
    dispatchJulesSession: vi.fn(),
    createTouchBar: vi.fn(),
    DEFAULT_TOUCH_BAR_CONFIG: {},
    githubManager: {},
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls all handler registration functions', async () => {
    const { registerAllIpcHandlers } = await import('./register-all-handlers')

    await registerAllIpcHandlers(mockWin, mockDeps, null)

    expect(ipcMain.handle).toHaveBeenCalled()
    
  })

  it('registers memory:export-now handler', async () => {
    const { registerAllIpcHandlers } = await import('./register-all-handlers')

    await registerAllIpcHandlers(mockWin, mockDeps, null)

    const memoryExportCall = vi.mocked(ipcMain.handle).mock.calls.find(
      call => call[0] === 'memory:export-now'
    )
    expect(memoryExportCall).toBeDefined()
  })

  it('registers kanban:get-columns handler', async () => {
    const { registerAllIpcHandlers } = await import('./register-all-handlers')

    await registerAllIpcHandlers(mockWin, mockDeps, null)

    const kanbanGetCall = vi.mocked(ipcMain.handle).mock.calls.find(
      call => call[0] === 'kanban:get-columns'
    )
    expect(kanbanGetCall).toBeDefined()
  })

  it('registers kanban:set-column handler', async () => {
    const { registerAllIpcHandlers } = await import('./register-all-handlers')

    await registerAllIpcHandlers(mockWin, mockDeps, null)

    const kanbanSetCall = vi.mocked(ipcMain.handle).mock.calls.find(
      call => call[0] === 'kanban:set-column'
    )
    expect(kanbanSetCall).toBeDefined()
  })

  it('returns cleanup functions', async () => {
    const { registerAllIpcHandlers } = await import('./register-all-handlers')

    const result = await registerAllIpcHandlers(mockWin, mockDeps, null)

    expect(result).toHaveProperty('cleanupTestHandlers')
    expect(result).toHaveProperty('cleanupReplayHandlers')
    expect(result).toHaveProperty('cleanupDebugHandlers')
    expect(result).toHaveProperty('cleanupWorktreeHandlers')
    expect(result).toHaveProperty('worktreeManager')
  })
})
