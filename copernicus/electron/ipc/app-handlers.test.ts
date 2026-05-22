import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ipcMain } from 'electron'
import { register } from './app-handlers'

// Mock electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
  app: {
    quit: vi.fn(),
    relaunch: vi.fn(),
    exit: vi.fn(),
    getVersion: vi.fn(() => '1.0.0'),
    getAppPath: vi.fn(() => '/mock/app'),
  },
  shell: {
    openPath: vi.fn(() => Promise.resolve('')),
    openExternal: vi.fn(() => Promise.resolve()),
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
}))

// Mock handleIpc wrapper
vi.mock('../utils/handle-ipc', () => ({
  handleIpc: vi.fn(async (_channel, _args, fn) => {
    try {
      const result = await fn()
      return { ok: true, data: result }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }),
}))

// Mock electron-log
vi.mock('../utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock memoryService
vi.mock('../memory/memoryService', () => ({
  memoryService: {
    setActiveProject: vi.fn(),
    activeProjectId: 'mock-project-id',
  },
}))

// Mock path-guard
vi.mock('../utils/path-guard', () => ({
  assertSafePath: vi.fn(),
}))

// Mock recent-projects
vi.mock('../utils/recent-projects', () => ({
  addRecentProject: vi.fn(),
}))

// Mock dispatcher
vi.mock('../commands/dispatcher', () => ({
  setupCommandHandlers: vi.fn(),
}))

describe('app-handlers', () => {
  let handlers: Record<string, Function> = {}
  let mockDeps: any

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = {}

    // Intercept ipcMain.handle to capture registered handlers
    vi.mocked(ipcMain.handle).mockImplementation((channel, handler) => {
      handlers[channel] = handler
    })

    // Create mock dependencies
    mockDeps = {
      authManager: {
        storeApiKey: vi.fn(),
        getApiKey: vi.fn(),
        getBaseUrl: vi.fn(),
        revokeKey: vi.fn(),
        resolveOpenAICompatibleKey: vi.fn(),
      },
      githubManager: {},
      modelRegistry: {},
      settingsStore: {
        get: vi.fn((key, defaultValue) => {
          if (key === 'workspace') return '/mock/workspace'
          if (key === 'workingDir') return '/mock/workspace'
          if (key === 'recentProjects') return []
          if (key === 'googleOAuthClientId') return ''
          return defaultValue
        }),
        set: vi.fn(),
        setAll: vi.fn(),
        setAndVerify: vi.fn(() => true),
        getAll: vi.fn(() => ({})),
      },
      storiesManager: {
        setProjectRoot: vi.fn(),
        isRepoTargeted: vi.fn(() => false),
        list: vi.fn(() => Promise.resolve([])),
        getProjectRoot: vi.fn(() => '/mock/workspace'),
        targetProject: vi.fn(),
      },
      devtimeManager: {
        startSession: vi.fn(),
        getActiveSession: vi.fn(),
        getTotalMonthValue: vi.fn(),
        closeSession: vi.fn(),
        getDefaults: vi.fn(),
        getReport: vi.fn(),
        listStories: vi.fn(),
      },
      fsManager: {
        setRootPath: vi.fn(),
        getRootPath: vi.fn(() => '/mock/workspace'),
      },
      workflowEngine: {
        getActiveSessions: vi.fn(() => []),
        getRunningGraphs: vi.fn(() => []),
      },
      stateLedger: {
        upsertTestRun: vi.fn(),
        getTestRunHistory: vi.fn(),
        getDailyCosts: vi.fn(),
        getCostByModel: vi.fn(),
        getCostByStory: vi.fn(),
        getWeeklyVelocity: vi.fn(),
        getSessionStats: vi.fn(),
        getRecentCalls: vi.fn(),
        getAllTimeCost: vi.fn(),
        getCostHeatmapData: vi.fn(),
        logIntent: vi.fn(),
        getRecentIntents: vi.fn(),
        logEvent: vi.fn(),
        getRecentEvents: vi.fn(),
        addProjectMemory: vi.fn(),
        searchProjectMemory: vi.fn(),
        vacuum: vi.fn(),
      },
      codebaseIndexer: {
        startIndexing: vi.fn(() => Promise.resolve()),
      },
      hybridRetriever: {},
      browserSession: {},
      ptyManager: {
        createEphemeral: vi.fn(),
      },
      socketManager: {},
      llmService: {},
      lspManager: {
        stop: vi.fn(),
        start: vi.fn(),
        getStatus: vi.fn(() => ({ running: false, status: 'stopped' })),
      },
      backendManager: {},
      julesClient: {
        reinit: vi.fn(),
      },
      julesMonitor: {},
      julesManager: {},
      genesisRunner: {},
      scaffoldRunner: undefined,
      layoutStore: {},
      applyAndVerifyPatch: vi.fn(),
      reversePatch: vi.fn(),
      runRAGBenchmark: vi.fn(),
      getPlaywright: vi.fn(),
      LOG_DIR: '/mock/logs',
      dispatchJulesSession: vi.fn(),
      createTouchBar: vi.fn(),
      DEFAULT_TOUCH_BAR_CONFIG: {},
      touchBarCleanup: { remove: vi.fn() },
      isFirstRun: false,
      spawn: vi.fn(),
      worktreeManager: {
        stop: vi.fn(),
        setRepoRoot: vi.fn(),
        isPollingStopped: true,
      },
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('settings handlers', () => {
    it('registers settings:save handler', () => {
      register({} as any, mockDeps)
      expect(handlers['settings:save']).toBeDefined()
    })

    it('registers settings:load handler', () => {
      register({} as any, mockDeps)
      expect(handlers['settings:load']).toBeDefined()
    })

    it('settings:save calls settingsStore.setAll', async () => {
      register({} as any, mockDeps)
      const handler = handlers['settings:save']!
      await handler({}, { theme: 'dark', fontSize: 14 })
      expect(mockDeps.settingsStore.setAll).toHaveBeenCalledWith({ theme: 'dark', fontSize: 14 })
    })

    it('settings:load returns all settings', async () => {
      register({} as any, mockDeps)
      const handler = handlers['settings:load']!
      const result = await handler({})
      expect(result.ok).toBe(true)
      expect(mockDeps.settingsStore.getAll).toHaveBeenCalled()
    })
  })

  describe('app lifecycle handlers', () => {
    it('registers app:quit handler', () => {
      register({} as any, mockDeps)
      expect(handlers['app:quit']).toBeDefined()
    })

    it('registers restart-app handler', () => {
      register({} as any, mockDeps)
      expect(handlers['restart-app']).toBeDefined()
    })

    it('registers app:open-log handler', () => {
      register({} as any, mockDeps)
      expect(handlers['app:open-log']).toBeDefined()
    })

    it('registers app:open-external handler', () => {
      register({} as any, mockDeps)
      expect(handlers['app:open-external']).toBeDefined()
    })

    it('app:open-external rejects non-http(s) URLs', async () => {
      register({} as any, mockDeps)
      const handler = handlers['app:open-external']!
      const result = await handler({}, 'file:///etc/passwd')
      expect(result.ok).toBe(false)
      expect(result.error).toContain('Blocked external URL')
    })

    it('app:open-external allows https URLs', async () => {
      const { shell } = await import('electron')
      register({} as any, mockDeps)
      const handler = handlers['app:open-external']!
      await handler({}, 'https://example.com')
      expect(shell.openExternal).toHaveBeenCalledWith('https://example.com')
    })
  })

  describe('workspace handlers', () => {
    it('registers app:get-recent-projects handler', () => {
      register({} as any, mockDeps)
      expect(handlers['app:get-recent-projects']).toBeDefined()
    })

    it('registers app:open-folder-dialog handler', () => {
      register({} as any, mockDeps)
      expect(handlers['app:open-folder-dialog']).toBeDefined()
    })

    it('registers app:switch-workspace handler', () => {
      register({} as any, mockDeps)
      expect(handlers['app:switch-workspace']).toBeDefined()
    })

    it('registers app:get-root-path handler', () => {
      register({} as any, mockDeps)
      expect(handlers['app:get-root-path']).toBeDefined()
    })

    it('registers app:get-env-state handler', () => {
      register({} as any, mockDeps)
      expect(handlers['app:get-env-state']).toBeDefined()
    })

    it('app:get-recent-projects returns settings', async () => {
      register({} as any, mockDeps)
      const handler = handlers['app:get-recent-projects']!
      await handler({})
      expect(mockDeps.settingsStore.get).toHaveBeenCalledWith('recentProjects', [])
    })

    it('app:get-root-path returns workspace path', async () => {
      register({} as any, mockDeps)
      const handler = handlers['app:get-root-path']!
      await handler({})
      expect(mockDeps.settingsStore.get).toHaveBeenCalledWith('workspace', null)
    })
  })

  describe('devtime handlers', () => {
    it('registers devtime:start handler', () => {
      register({} as any, mockDeps)
      expect(handlers['devtime:start']).toBeDefined()
    })

    it('registers devtime:status handler', () => {
      register({} as any, mockDeps)
      expect(handlers['devtime:status']).toBeDefined()
    })

    it('registers devtime:close handler', () => {
      register({} as any, mockDeps)
      expect(handlers['devtime:close']).toBeDefined()
    })

    it('registers devtime:defaults handler', () => {
      register({} as any, mockDeps)
      expect(handlers['devtime:defaults']).toBeDefined()
    })

    it('registers devtime:report handler', () => {
      register({} as any, mockDeps)
      expect(handlers['devtime:report']).toBeDefined()
    })

    it('registers devtime:list-stories handler', () => {
      register({} as any, mockDeps)
      expect(handlers['devtime:list-stories']).toBeDefined()
    })

    it('devtime:status returns session info', async () => {
      register({} as any, mockDeps)
      const handler = handlers['devtime:status']!
      await handler({})
      expect(mockDeps.devtimeManager.getActiveSession).toHaveBeenCalled()
      expect(mockDeps.devtimeManager.getTotalMonthValue).toHaveBeenCalled()
      expect(mockDeps.storiesManager.isRepoTargeted).toHaveBeenCalled()
    })
  })

  describe('ledger handlers', () => {
    it('registers ledger:daily-costs handler', () => {
      register({} as any, mockDeps)
      expect(handlers['ledger:daily-costs']).toBeDefined()
    })

    it('registers ledger:cost-by-model handler', () => {
      register({} as any, mockDeps)
      expect(handlers['ledger:cost-by-model']).toBeDefined()
    })

    it('registers ledger:cost-by-story handler', () => {
      register({} as any, mockDeps)
      expect(handlers['ledger:cost-by-story']).toBeDefined()
    })

    it('registers ledger:session-stats handler', () => {
      register({} as any, mockDeps)
      expect(handlers['ledger:session-stats']).toBeDefined()
    })

    it('registers ledger:recent-calls handler', () => {
      register({} as any, mockDeps)
      expect(handlers['ledger:recent-calls']).toBeDefined()
    })

    it('registers ledger:all-time-cost handler', () => {
      register({} as any, mockDeps)
      expect(handlers['ledger:all-time-cost']).toBeDefined()
    })

    it('registers ledger:heatmap-data handler', () => {
      register({} as any, mockDeps)
      expect(handlers['ledger:heatmap-data']).toBeDefined()
    })
  })

  describe('database handlers', () => {
    it('registers db:log-intent handler', () => {
      register({} as any, mockDeps)
      expect(handlers['db:log-intent']).toBeDefined()
    })

    it('registers db:get-intents handler', () => {
      register({} as any, mockDeps)
      expect(handlers['db:get-intents']).toBeDefined()
    })

    it('registers db:log-event handler', () => {
      register({} as any, mockDeps)
      expect(handlers['db:log-event']).toBeDefined()
    })

    it('registers db:get-events handler', () => {
      register({} as any, mockDeps)
      expect(handlers['db:get-events']).toBeDefined()
    })

    it('registers db:vacuum handler', () => {
      register({} as any, mockDeps)
      expect(handlers['db:vacuum']).toBeDefined()
    })

    it('db:vacuum calls stateLedger.vacuum', async () => {
      register({} as any, mockDeps)
      const handler = handlers['db:vacuum']!
      await handler({})
      expect(mockDeps.stateLedger.vacuum).toHaveBeenCalled()
    })
  })

  describe('MCP handlers', () => {
    it('registers mcp:list-servers handler', () => {
      register({} as any, mockDeps)
      expect(handlers['mcp:list-servers']).toBeDefined()
    })

    it('registers mcp:save-servers handler', () => {
      register({} as any, mockDeps)
      expect(handlers['mcp:save-servers']).toBeDefined()
    })

    it('registers mcp:get-status handler', () => {
      register({} as any, mockDeps)
      expect(handlers['mcp:get-status']).toBeDefined()
    })

    it('registers mcp:test-server handler', () => {
      register({} as any, mockDeps)
      expect(handlers['mcp:test-server']).toBeDefined()
    })

    it('mcp:list-servers returns configured servers', async () => {
      mockDeps.settingsStore.getAll.mockReturnValue({ mcp: { servers: [{ name: 'test' }] } })
      register({} as any, mockDeps)
      const handler = handlers['mcp:list-servers']!
      const result = await handler({})
      expect(result.ok).toBe(true)
      expect(result.data).toEqual([{ name: 'test' }])
    })

    it('mcp:save-servers persists servers', async () => {
      register({} as any, mockDeps)
      const handler = handlers['mcp:save-servers']!
      const servers = [{ name: 'test' }]
      await handler({}, servers)
      expect(mockDeps.settingsStore.setAll).toHaveBeenCalledWith({ mcp: { servers } })
    })
  })

  describe('environment handlers', () => {
    it('registers env:scan handler', () => {
      register({} as any, mockDeps)
      expect(handlers['env:scan']).toBeDefined()
    })

    it('registers env:install handler', () => {
      register({} as any, mockDeps)
      expect(handlers['env:install']).toBeDefined()
    })

    it('registers env:get-versions handler', () => {
      register({} as any, mockDeps)
      expect(handlers['env:get-versions']).toBeDefined()
    })

    it('env:get-versions returns version info', async () => {
      register({} as any, mockDeps)
      const handler = handlers['env:get-versions']!
      const result = await handler({})
      expect(result.ok).toBe(true)
      expect(result.data).toHaveProperty('node')
      expect(result.data).toHaveProperty('electron')
      expect(result.data).toHaveProperty('appVersion')
      expect(result.data).toHaveProperty('platform')
    })
  })

  describe('git handlers', () => {
    it('registers git:branch handler', () => {
      register({} as any, mockDeps)
      expect(handlers['git:branch']).toBeDefined()
    })

    it('registers git:init-workspace handler', () => {
      register({} as any, mockDeps)
      expect(handlers['git:init-workspace']).toBeDefined()
    })

    it('git:branch returns branch name', async () => {
      register({} as any, mockDeps)
      const handler = handlers['git:branch']!
      const result = await handler({})
      expect(result.ok).toBe(true)
    })
  })

  describe('ui handlers', () => {
    it('registers touchbar:rebuild handler', () => {
      register({} as any, mockDeps)
      expect(handlers['touchbar:rebuild']).toBeDefined()
    })

    it('registers window:exit-fullscreen handler', () => {
      register({} as any, mockDeps)
      expect(handlers['window:exit-fullscreen']).toBeDefined()
    })

    it('registers layout:goto-line handler', () => {
      register({} as any, mockDeps)
      expect(handlers['layout:goto-line']).toBeDefined()
    })

    it('registers wizard:get-username handler', () => {
      register({} as any, mockDeps)
      expect(handlers['wizard:get-username']).toBeDefined()
    })

    it('registers app:get-user-guide handler', () => {
      register({} as any, mockDeps)
      expect(handlers['app:get-user-guide']).toBeDefined()
    })

    it('registers check-cli-tools handler', () => {
      register({} as any, mockDeps)
      expect(handlers['check-cli-tools']).toBeDefined()
    })

    it('registers save-preferences handler', () => {
      register({} as any, mockDeps)
      expect(handlers['save-preferences']).toBeDefined()
    })
  })

  describe('command center handlers', () => {
    it('registers command:request-telemetry handler', () => {
      register({} as any, mockDeps)
      expect(handlers['command:request-telemetry']).toBeDefined()
    })

    it('registers app:set-root-path handler', () => {
      register({} as any, mockDeps)
      expect(handlers['app:set-root-path']).toBeDefined()
    })
  })

  describe('review handlers', () => {
    it('registers review:session-complete handler', () => {
      register({} as any, mockDeps)
      expect(handlers['review:session-complete']).toBeDefined()
    })
  })

  describe('chat handlers', () => {
    it('registers chat:send-system handler', () => {
      register({} as any, mockDeps)
      expect(handlers['chat:send-system']).toBeDefined()
    })
  })
})
