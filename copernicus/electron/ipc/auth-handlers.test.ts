import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ipcMain, BrowserWindow } from 'electron'
import { register } from './auth-handlers'

// Mock electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
  shell: {
    openExternal: vi.fn(() => Promise.resolve()),
  },
}))

// Mock handleIpc wrapper - handles both promise-returning and regular functions
vi.mock('../utils/handle-ipc', () => ({
  handleIpc: vi.fn((...args: any[]) => {
    let fn: Function
    if (typeof args[0] === 'function') {
      fn = args[0]
    } else {
      fn = args[2]
    }
    return Promise.resolve(fn()).then((result: any) => {
      // If result is already { ok, data/error }, return it directly
      if (result && typeof result === 'object' && 'ok' in result) {
        return result
      }
      return { ok: true, data: result }
    }).catch((e: any) => {
      return { ok: false, error: e.message }
    })
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

describe('auth-handlers', () => {
  let handlers: Record<string, Function> = {}
  let mockDeps: any
  let mockWin: Partial<BrowserWindow>

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = {}

    // Intercept ipcMain.handle to capture registered handlers
    vi.mocked(ipcMain.handle).mockImplementation((channel, handler) => {
      handlers[channel] = handler
    })

    mockWin = {
      webContents: {
        send: vi.fn(),
      } as unknown as import('electron').WebContents,
      show: vi.fn(),
      focus: vi.fn(),
    }

    mockDeps = {
      authManager: {
        storeApiKey: vi.fn(),
        getApiKey: vi.fn(),
        getBaseUrl: vi.fn(),
        revokeKey: vi.fn(),
        resolveOpenAICompatibleKey: vi.fn(),
        getAuthStatus: vi.fn(),
        revokeApiKey: vi.fn(),
        setBaseUrl: vi.fn(),
      },
      githubManager: {},
      modelRegistry: {},
      settingsStore: {
        get: vi.fn((key, defaultValue) => {
          if (key === 'googleOAuthClientId') return ''
          if (key === 'github:trusted-repos') return []
          if (key === 'github:tracked-repos') return []
          if (key === 'github:target-repo') return null
          return defaultValue
        }),
        set: vi.fn(),
        setAll: vi.fn(),
      },
      storiesManager: {
        setProjectRoot: vi.fn(),
        targetProject: vi.fn(),
      },
      devtimeManager: {},
      fsManager: {
        getRootPath: vi.fn(() => '/mock/workspace'),
      },
      workflowEngine: {},
      stateLedger: {},
      codebaseIndexer: {},
      hybridRetriever: {},
      browserSession: {},
      ptyManager: {
        createEphemeral: vi.fn(),
      },
      socketManager: {},
      llmService: {},
      lspManager: {},
      backendManager: {},
      julesClient: {
        reinit: vi.fn(),
      },
      julesMonitor: {},
      julesManager: {},
      genesisRunner: {},
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
      worktreeManager: {},
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('OAuth handlers', () => {
    describe('oauth:start-anthropic', () => {
      it('registers oauth:start-anthropic handler', () => {
        register(mockWin as any, mockDeps)
        expect(handlers['oauth:start-anthropic']).toBeDefined()
      })

      it('returns error object instead of throwing', async () => {
        register(mockWin as any, mockDeps)
        const handler = handlers['oauth:start-anthropic']!
        if (!handler) throw new Error('handler not registered: oauth:start-anthropic')
        const result = await handler({})

        expect(result.ok).toBe(false)
        expect(result.error).toContain('Anthropic does not support OAuth')
        expect(result.error).toContain('console.anthropic.com')
      })
    })

    describe('oauth:start-google', () => {
      it('registers oauth:start-google handler', () => {
        register(mockWin as any, mockDeps)
        expect(handlers['oauth:start-google']).toBeDefined()
      })

      it('returns error object instead of throwing', async () => {
        register(mockWin as any, mockDeps)
        const handler = handlers['oauth:start-google']!
        if (!handler) throw new Error('handler not registered: oauth:start-google')
        const result = await handler({})

        expect(result.ok).toBe(false)
        expect(result.error).toBe('Use app:start-oauth-listener instead')
      })
    })

    describe('app:start-oauth-listener', () => {
      it('registers app:start-oauth-listener handler', () => {
        register(mockWin as any, mockDeps)
        expect(handlers['app:start-oauth-listener']).toBeDefined()
      })
    })
  })

  describe('Auth handlers', () => {
    it('registers auth:status handler', () => {
      register(mockWin as any, mockDeps)
      expect(handlers['auth:status']).toBeDefined()
    })

    it('registers auth:store-api-key handler', () => {
      register(mockWin as any, mockDeps)
      expect(handlers['auth:store-api-key']).toBeDefined()
    })

    it('registers auth:revoke handler', () => {
      register(mockWin as any, mockDeps)
      expect(handlers['auth:revoke']).toBeDefined()
    })

    it('registers auth:get-api-key handler', () => {
      register(mockWin as any, mockDeps)
      expect(handlers['auth:get-api-key']).toBeDefined()
    })

    it('registers auth:resolve-openai-config handler', () => {
      register(mockWin as any, mockDeps)
      expect(handlers['auth:resolve-openai-config']).toBeDefined()
    })

    it('registers auth:validate-ollama-cloud handler', () => {
      register(mockWin as any, mockDeps)
      expect(handlers['auth:validate-ollama-cloud']).toBeDefined()
    })

    it('registers auth:revoke-key handler', () => {
      register(mockWin as any, mockDeps)
      expect(handlers['auth:revoke-key']).toBeDefined()
    })

    it('auth:status calls authManager.getAuthStatus', async () => {
      mockDeps.authManager.getAuthStatus.mockResolvedValue({ authenticated: true })
      register(mockWin as any, mockDeps)
      const handler = handlers['auth:status']!
      if (!handler) throw new Error('handler not registered: auth:status')
      await handler({})
      expect(mockDeps.authManager.getAuthStatus).toHaveBeenCalled()
    })

    it('auth:store-api-key stores key and reinitializes Jules client', async () => {
      register(mockWin as any, mockDeps)
      const handler = handlers['auth:store-api-key']!
      if (!handler) throw new Error('handler not registered: auth:store-api-key')
      await handler({}, 'jules', 'test-key', 'https://jules.example.com')
      expect(mockDeps.authManager.storeApiKey).toHaveBeenCalledWith('jules', 'test-key', 'https://jules.example.com', 'apikey')
      expect(mockDeps.julesClient.reinit).toHaveBeenCalledWith('test-key')
    })

    it('auth:revoke calls authManager.revokeApiKey', async () => {
      register(mockWin as any, mockDeps)
      const handler = handlers['auth:revoke']!
      await handler({}, 'openai')
      expect(mockDeps.authManager.revokeApiKey).toHaveBeenCalledWith('openai')
    })

    it('auth:get-api-key returns null for openai provider', async () => {
      mockDeps.authManager.resolveOpenAICompatibleKey.mockReturnValue(null)
      register(mockWin as any, mockDeps)
      const handler = handlers['auth:get-api-key']!
      const result = await handler({}, 'openai')
      expect(result.ok).toBe(true)
      expect(result.data).toBeNull()
    })

    it('auth:get-api-key returns resolved key for openrouter provider', async () => {
      mockDeps.authManager.resolveOpenAICompatibleKey.mockReturnValue({ key: 'or-key' })
      register(mockWin as any, mockDeps)
      const handler = handlers['auth:get-api-key']!
      const result = await handler({}, 'openrouter')
      expect(result.ok).toBe(true)
      expect(result.data).toBe('or-key')
    })

    it('auth:resolve-openai-config returns resolved config', async () => {
      mockDeps.authManager.resolveOpenAICompatibleKey.mockReturnValue({ key: 'test', baseUrl: 'https://api.test.com' })
      register(mockWin as any, mockDeps)
      const handler = handlers['auth:resolve-openai-config']!
      const result = await handler({})
      expect(result.ok).toBe(true)
      expect(result.data).toEqual({ key: 'test', baseUrl: 'https://api.test.com' })
    })

    describe('auth:validate-ollama-cloud', () => {
      it('returns false when no key exists', async () => {
        mockDeps.authManager.getApiKey.mockReturnValue(null)
        register(mockWin as any, mockDeps)
        const handler = handlers['auth:validate-ollama-cloud']!
        const result = await handler({})
        expect(result.ok).toBe(true)
        expect(result.data).toBe(false)
      })

      it('logs error and returns false on fetch failure', async () => {
        mockDeps.authManager.getApiKey.mockReturnValue('test-key')
        mockDeps.authManager.getBaseUrl.mockReturnValue('https://ollama.com')

        // Mock global fetch to reject
        const originalFetch = global.fetch
        global.fetch = vi.fn(() => Promise.reject(new Error('Network error')))

        register(mockWin as any, mockDeps)
        const handler = handlers['auth:validate-ollama-cloud']!
        const result = await handler({})

        expect(result.ok).toBe(true)
        expect(result.data).toBe(false)

        // Verify logger was called with error
        const log = await import('../utils/logger')
        expect(log.default.error).toHaveBeenCalledWith('[auth:validate-ollama-cloud]', expect.any(Error))

        global.fetch = originalFetch
      })

      it('returns true when fetch succeeds with ok response', async () => {
        mockDeps.authManager.getApiKey.mockReturnValue('test-key')
        mockDeps.authManager.getBaseUrl.mockReturnValue('https://ollama.com')

        const mockResponse = { ok: true }
        const originalFetch = global.fetch
        global.fetch = vi.fn(() => Promise.resolve(mockResponse as Response))

        register(mockWin as any, mockDeps)
        const handler = handlers['auth:validate-ollama-cloud']!
        const result = await handler({})

        expect(result.ok).toBe(true)
        expect(result.data).toBe(true)

        global.fetch = originalFetch
      })

      it('returns false when fetch succeeds with non-ok response', async () => {
        mockDeps.authManager.getApiKey.mockReturnValue('test-key')
        mockDeps.authManager.getBaseUrl.mockReturnValue('https://ollama.com')

        const mockResponse = { ok: false }
        const originalFetch = global.fetch
        global.fetch = vi.fn(() => Promise.resolve(mockResponse as Response))

        register(mockWin as any, mockDeps)
        const handler = handlers['auth:validate-ollama-cloud']!
        const result = await handler({})

        expect(result.ok).toBe(true)
        expect(result.data).toBe(false)

        global.fetch = originalFetch
      })
    })

    it('auth:revoke-key calls authManager.revokeKey', async () => {
      register(mockWin as any, mockDeps)
      const handler = handlers['auth:revoke-key']!
      await handler({}, 'google')
      expect(mockDeps.authManager.revokeKey).toHaveBeenCalledWith('google')
    })
  })

  describe('GitHub handlers', () => {
    it('registers github:set-trust handler', () => {
      register(mockWin as any, mockDeps)
      expect(handlers['github:set-trust']).toBeDefined()
    })

    it('registers github:add-repo handler', () => {
      register(mockWin as any, mockDeps)
      expect(handlers['github:add-repo']).toBeDefined()
    })

    it('registers github:remove-repo handler', () => {
      register(mockWin as any, mockDeps)
      expect(handlers['github:remove-repo']).toBeDefined()
    })

    it('registers github:get-trust-list handler', () => {
      register(mockWin as any, mockDeps)
      expect(handlers['github:get-trust-list']).toBeDefined()
    })

    it('registers github:set-target-repo handler', () => {
      register(mockWin as any, mockDeps)
      expect(handlers['github:set-target-repo']).toBeDefined()
    })

    it('registers github:get-target-repo handler', () => {
      register(mockWin as any, mockDeps)
      expect(handlers['github:get-target-repo']).toBeDefined()
    })

    it('registers github:search handler', () => {
      register(mockWin as any, mockDeps)
      expect(handlers['github:search']).toBeDefined()
    })

    it('registers github:clone-repo handler', () => {
      register(mockWin as any, mockDeps)
      expect(handlers['github:clone-repo']).toBeDefined()
    })

    it('registers github:test-connection handler', () => {
      register(mockWin as any, mockDeps)
      expect(handlers['github:test-connection']).toBeDefined()
    })

    it('github:set-trust adds repo to trusted list', async () => {
      const trustedRepos: string[] = []
      mockDeps.settingsStore.get.mockImplementation((key: string) => {
        if (key === 'github:trusted-repos') return trustedRepos
        return []
      })

      register(mockWin as any, mockDeps)
      const handler = handlers['github:set-trust']!
      await handler({}, 'owner/repo', true)

      expect(mockDeps.settingsStore.set).toHaveBeenCalledWith('github:trusted-repos', ['owner/repo'])
    })

    it('github:set-trust removes repo from trusted list', async () => {
      const trustedRepos = ['owner/repo', 'other/repo']
      mockDeps.settingsStore.get.mockImplementation((key: string) => {
        if (key === 'github:trusted-repos') return trustedRepos
        return []
      })

      register(mockWin as any, mockDeps)
      const handler = handlers['github:set-trust']!
      await handler({}, 'owner/repo', false)

      expect(mockDeps.settingsStore.set).toHaveBeenCalledWith('github:trusted-repos', ['other/repo'])
    })

    it('github:add-repo adds to tracked repos', async () => {
      mockDeps.settingsStore.get.mockImplementation((key: string) => {
        if (key === 'github:tracked-repos') return []
        return []
      })

      register(mockWin as any, mockDeps)
      const handler = handlers['github:add-repo']!
      const result = await handler({}, 'owner/repo')

      expect(result.ok).toBe(true)
      expect(mockDeps.settingsStore.set).toHaveBeenCalledWith('github:tracked-repos', ['owner/repo'])
    })

    it('github:remove-repo removes from both tracked and trusted', async () => {
      mockDeps.settingsStore.get.mockImplementation((key: string) => {
        if (key === 'github:tracked-repos') return ['owner/repo']
        if (key === 'github:trusted-repos') return ['owner/repo']
        return []
      })

      register(mockWin as any, mockDeps)
      const handler = handlers['github:remove-repo']!
      const result = await handler({}, 'owner/repo')

      expect(result.ok).toBe(true)
      expect(mockDeps.settingsStore.set).toHaveBeenCalledWith('github:tracked-repos', [])
      expect(mockDeps.settingsStore.set).toHaveBeenCalledWith('github:trusted-repos', [])
    })

    it('github:get-trust-list returns trusted and tracked repos', async () => {
      mockDeps.settingsStore.get.mockImplementation((key: string) => {
        if (key === 'github:trusted-repos') return ['trusted/repo']
        if (key === 'github:tracked-repos') return ['tracked/repo']
        return []
      })

      register(mockWin as any, mockDeps)
      const handler = handlers['github:get-trust-list']!
      const result = await handler({})

      expect(result.ok).toBe(true)
      expect(result.data).toEqual({
        trusted: ['trusted/repo'],
        tracked: ['tracked/repo'],
      })
    })

    it('github:set-target-repo sets target and updates Jules baseUrl', async () => {
      register(mockWin as any, mockDeps)
      const handler = handlers['github:set-target-repo']!
      await handler({}, 'owner/repo')

      expect(mockDeps.settingsStore.set).toHaveBeenCalledWith('github:target-repo', 'owner/repo')
      expect(mockDeps.authManager.setBaseUrl).toHaveBeenCalledWith('jules', 'owner/repo')
    })

    it('github:get-target-repo returns target repo', async () => {
      mockDeps.settingsStore.get.mockReturnValue('owner/repo')

      register(mockWin as any, mockDeps)
      const handler = handlers['github:get-target-repo']!
      const result = await handler({})

      expect(result.ok).toBe(true)
      expect(result.data).toBe('owner/repo')
    })

    it('github:search throws when no token', async () => {
      mockDeps.authManager.getApiKey.mockReturnValue(null)

      register(mockWin as any, mockDeps)
      const handler = handlers['github:search']!
      const result = await handler({}, 'query')

      expect(result.ok).toBe(false)
      expect(result.error).toBe('NO_TOKEN')
    })

    it('github:clone-repo spawns terminal with git clone command', async () => {
      register(mockWin as any, mockDeps)
      const handler = handlers['github:clone-repo']!
      const result = await handler({}, { repoUrl: 'https://github.com/owner/repo.git', repoName: 'repo' })

      expect(result.ok).toBe(true)
      expect(result.data?.termId ?? result.termId).toMatch(/git-clone-\d+/)
      expect(mockDeps.ptyManager.createEphemeral).toHaveBeenCalled()
    })

    it('github:test-connection throws when no token', async () => {
      mockDeps.authManager.getApiKey.mockReturnValue(null)

      register(mockWin as any, mockDeps)
      const handler = handlers['github:test-connection']!
      const result = await handler({})

      expect(result.ok).toBe(false)
      expect(result.error).toBe('NO_TOKEN')
    })

    it('github:test-connection returns user info on success', async () => {
      mockDeps.authManager.getApiKey.mockReturnValue('test-token')

      const mockResponse = {
        ok: true,
        json: vi.fn(() => Promise.resolve({ login: 'testuser', avatar_url: 'https://avatar.url' })),
      }
      const originalFetch = global.fetch
      global.fetch = vi.fn(() => Promise.resolve(mockResponse as unknown as Response))

      register(mockWin as any, mockDeps)
      const handler = handlers['github:test-connection']!
      const result = await handler({})

      expect(result.ok).toBe(true)
      expect(result.data).toEqual({ login: 'testuser', avatar_url: 'https://avatar.url' })

      global.fetch = originalFetch
    })

    it('github:test-connection throws Unauthorized on 401', async () => {
      mockDeps.authManager.getApiKey.mockReturnValue('invalid-token')

      const mockResponse = {
        ok: false,
        status: 401,
      }
      const originalFetch = global.fetch
      global.fetch = vi.fn(() => Promise.resolve(mockResponse as unknown as Response))

      register(mockWin as any, mockDeps)
      const handler = handlers['github:test-connection']!
      const result = await handler({})

      expect(result.ok).toBe(false)
      expect(result.error).toContain('Unauthorized')

      global.fetch = originalFetch
    })

    it('github:test-connection throws on other HTTP errors', async () => {
      mockDeps.authManager.getApiKey.mockReturnValue('test-token')

      const mockResponse = {
        ok: false,
        status: 500,
      }
      const originalFetch = global.fetch
      global.fetch = vi.fn(() => Promise.resolve(mockResponse as unknown as Response))

      register(mockWin as any, mockDeps)
      const handler = handlers['github:test-connection']!
      const result = await handler({})

      expect(result.ok).toBe(false)
      expect(result.error).toContain('HTTP 500')

      global.fetch = originalFetch
    })
  })
})
