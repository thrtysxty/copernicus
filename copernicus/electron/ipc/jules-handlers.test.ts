import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ipcMain } from 'electron'

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn(),
  },
}))

vi.mock('../utils/handle-ipc', () => ({
  handleIpc: vi.fn(async (fn) => {
    try {
      const result = await fn()
      return { ok: true, data: result }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }),
}))

vi.mock('../jules/dispatcher', () => ({
  dispatchJulesSession: vi.fn(),
}))

vi.mock('@google/jules-sdk', () => ({
  JulesApiError: class JulesApiError extends Error {},
  JulesError: class JulesError extends Error {},
  JulesNetworkError: class JulesNetworkError extends Error {},
}))

vi.mock('../db/state-ledger', () => ({
  stateLedger: {
    getStoryById: vi.fn((_id: any) => ({ id: 42, title: 'Test Story', status: 'PLANNING' })),
    listJulesSessions: vi.fn(() => []),
    upsertJulesSession: vi.fn(),
    getJulesSessionsByStory: vi.fn(() => []),
  },
}))

describe('jules-handlers', () => {
  let handlers: Record<string, Function> = {}
  let mockDeps: any

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    handlers = {}

    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: Function) => {
      handlers[channel] = handler
    })

    mockDeps = {
      julesClient: {
        session: vi.fn(),
        listSources: vi.fn(),
      },
      julesMonitor: {
        startWatching: vi.fn(),
      },
      authManager: {
        getApiKey: vi.fn(() => 'test-api-key'),
      },
    }
  })

  async function getRegister() {
    const { registerJulesHandlers } = await import('./jules-handlers')
    return registerJulesHandlers
  }

  describe('jules:dispatch-session', () => {
    it('dispatches a session and returns sessionId', async () => {
      const { dispatchJulesSession } = await import('../jules/dispatcher')
      vi.mocked(dispatchJulesSession).mockResolvedValue({ ok: true, sessionId: 'sess-abc123' })

      const register = await getRegister()
      register(mockDeps as any)

      const handler = handlers['jules:dispatch-session']!
      const result = await handler({} as any, { storyId: 42, repo: 'org/repo', branch: 'story/042', requirePlanApproval: false })

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({ sessionId: 'sess-abc123' })
      expect(mockDeps.julesMonitor.startWatching).toHaveBeenCalledWith('sess-abc123')
    })

    it('returns error on API failure', async () => {
      const { dispatchJulesSession } = await import('../jules/dispatcher')
      vi.mocked(dispatchJulesSession).mockRejectedValue(new Error('Jules API unavailable'))

      const register = await getRegister()
      register(mockDeps as any)

      const handler = handlers['jules:dispatch-session']!
      const result = await handler({} as any, { storyId: 42, repo: 'org/repo', branch: 'story/042', requirePlanApproval: false })

      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/Jules API/)
    })
  })
})
