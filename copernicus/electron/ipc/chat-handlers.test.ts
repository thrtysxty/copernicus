import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ipcMain, BrowserWindow } from 'electron'
import { register } from './chat-handlers'
import { IpcHandlerDeps } from './deps'

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}))

vi.mock('../utils/handle-ipc', () => ({
  handleIpc: vi.fn(async (channelOrFn, argsOrNothing, fnOrNothing) => {
    // Handle both signatures: handleIpc(fn) and handleIpc(channel, args, fn)
    const fn = typeof channelOrFn === 'function' ? channelOrFn : fnOrNothing
    try {
      const result = await fn!()
      // If result already has error property, pass through
      if (result && typeof result === 'object' && 'error' in result) {
        return result
      }
      return { ok: true, data: result }
    } catch (e: any) {
      const message = typeof e === 'string' ? e : (e?.message ?? String(e))
      return { ok: false, error: message }
    }
  }),
}))

vi.mock('../config', () => ({
  config: {
    backend: { url: 'http://127.0.0.1:5001' },
  },
}))

vi.mock('../local-model/KnowledgeRouter', () => ({
  knowledgeRouter: {
    getContext: vi.fn(),
  },
}))

vi.mock('../local-model/LocalModelManager', () => ({
  localModelManager: {
    isRunning: vi.fn(() => false),
  },
}))

vi.mock('../memory/auto-extractor', () => ({
  autoExtractor: {
    extract: vi.fn(),
  },
}))

vi.mock('../db/state-ledger', () => ({
  stateLedger: {
    getProjectByPath: vi.fn(() => null),
  },
}))

vi.mock('../fs-manager', () => ({
  fsManager: {
    getRootPath: vi.fn(() => ''),
  },
}))

describe('chat-handlers', () => {
  let handlers: Record<string, Function> = {}
  let mockDeps: Partial<IpcHandlerDeps>

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = {}

    vi.mocked(ipcMain.handle).mockImplementation((channel, handler) => {
      handlers[channel] = handler
    })

    mockDeps = {
      modelRegistry: {
        getModels: vi.fn(() => []),
        getFastModel: vi.fn(() => ({ id: 'fast-model' })),
      } as any,
      llmService: {
        streamChat: vi.fn(),
        generateText: vi.fn(),
      } as any,
    }
  })

  describe('chat:send', () => {
    it('returns { ok: true, data } when streamChat succeeds', async () => {
      vi.mocked(mockDeps.llmService!.streamChat).mockResolvedValue(undefined)

      register({} as BrowserWindow, mockDeps as IpcHandlerDeps)

      const handler = handlers['chat:send']
      expect(handler).toBeDefined()

      const payload = { model: 'test-model', messages: [{ role: 'user', content: 'hello' }] }
      const result = await handler!({} as any, payload)

      expect(result.ok).toBe(true)
      expect(mockDeps.llmService!.streamChat).toHaveBeenCalledWith(payload)
    })

    it('returns { ok: false, error } when streamChat throws', async () => {
      const testError = new Error('Connection timeout')
      vi.mocked(mockDeps.llmService!.streamChat).mockRejectedValue(testError)

      register({} as BrowserWindow, mockDeps as IpcHandlerDeps)

      const handler = handlers['chat:send']
      const payload = { model: 'test-model', messages: [{ role: 'user', content: 'hello' }] }
      const result = await handler!({} as any, payload)

      expect(result.ok).toBe(false)
      expect((result as any).error).toBe('Connection timeout')
    })

    it('returns { ok: false, error } when streamChat throws non-Error', async () => {
      vi.mocked(mockDeps.llmService!.streamChat).mockRejectedValue('string error')

      register({} as BrowserWindow, mockDeps as IpcHandlerDeps)

      const handler = handlers['chat:send']
      const payload = { model: 'test-model' }
      const result = await handler!({} as any, payload)

      expect(result.ok).toBe(false)
      expect((result as any).error).toBe('string error')
    })

    it('returns error object when sending image to non-vision model', async () => {
      vi.mocked(mockDeps.modelRegistry!.getModels).mockReturnValue([
        { id: 'test-model', supportsVision: false },
      ])

      register({} as BrowserWindow, mockDeps as IpcHandlerDeps)

      const handler = handlers['chat:send']
      const payload = { model: 'test-model', imageBase64: 'data:image/png;base64,xxx' }
      const result = await handler!({} as any, payload)

      // Vision check returns early with error object (before handleIpc wraps)
      expect((result as any).error).toBe('VISION_NOT_SUPPORTED')
      expect(mockDeps.llmService!.streamChat).not.toHaveBeenCalled()
    })
  })

  describe('chat:confirm-model-switch', () => {
    it('returns { ok: true } after notifying windows and backend', async () => {
      global.fetch = vi.fn(() => Promise.resolve({ ok: true } as Response))

      register({} as BrowserWindow, mockDeps as IpcHandlerDeps)

      const handler = handlers['chat:confirm-model-switch']
      const payload = { accepted: true, sessionId: 'test-123' }
      const result = await handler!({} as any, payload)

      expect(result.ok).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:5001/api/orchestration/resolve-confirmation',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('test-123'),
        })
      )
    })

    it('returns { ok: true } even if backend notification fails', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Backend unavailable')))

      register({} as BrowserWindow, mockDeps as IpcHandlerDeps)

      const handler = handlers['chat:confirm-model-switch']
      const payload = { accepted: false, sessionId: 'test-456' }
      const result = await handler!({} as any, payload)

      // Should still return ok: true since backend failure is logged but not thrown
      expect(result.ok).toBe(true)
    })
  })

  describe('agent:send-code-stream', () => {
    it('returns { ok: true } after sending to window', async () => {
      const mockWindow = { webContents: { send: vi.fn() } } as unknown as BrowserWindow

      register(mockWindow, mockDeps as IpcHandlerDeps)

      const handler = handlers['agent:send-code-stream']
      const payload = { sessionId: 's1', filePath: '/test.ts', proposedDiff: 'diff content' }
      const result = await handler!({} as any, payload)

      expect(result.ok).toBe(true)
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('agent:code-stream', payload)
    })
  })

  describe('chat:compress-delta', () => {
    it('returns compressed summary', async () => {
      vi.mocked(mockDeps.llmService!.generateText).mockResolvedValue('compressed summary text')

      register({} as BrowserWindow, mockDeps as IpcHandlerDeps)

      const handler = handlers['chat:compress-delta']
      const payload = {
        rows: [{ content: 'fact 1' }, { content: 'fact 2' }],
        maxTokens: 50,
      }
      const result = await handler!({} as any, payload)

      expect(result.ok).toBe(true)
      expect((result as any).data.summary).toBe('compressed summary text')
    })
  })
})
