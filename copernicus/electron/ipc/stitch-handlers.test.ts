import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerStitchHandlers } from './stitch-handlers'
import { ipcMain } from 'electron'
import { authManager } from '../auth-manager'
import { Stitch, StitchToolClient, StitchError } from '@google/stitch-sdk'

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}))

vi.mock('../auth-manager', () => ({
  authManager: {
    getApiKey: vi.fn(),
  },
}))

vi.mock('../utils/handle-ipc', () => ({
  handleIpc: vi.fn(async (fn) => {
    try {
      const result = await fn()
      if (result && typeof result === 'object' && 'ok' in result) {
        return result
      }
      return { ok: true, data: result }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  })
}))

vi.mock('@google/stitch-sdk', () => {
  class MockStitch {
    projects() {}
  }
  return {
    Stitch: MockStitch,
    StitchToolClient: vi.fn(),
    StitchError: class extends Error {
      code: string
      constructor(params: { code: string, message: string }) {
        super(params.message)
        this.code = params.code
        Object.setPrototypeOf(this, new.target.prototype)
      }
    }
  }
})

describe('stitch-handlers', () => {
  let handlers: Record<string, Function> = {}

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = {}

    // Intercept ipcMain.handle to capture the registered handlers
    vi.mocked(ipcMain.handle).mockImplementation((channel, handler) => {
      handlers[channel] = handler
    })

    registerStitchHandlers()
  })

  it('registers all required handlers', () => {
    expect(ipcMain.handle).toHaveBeenCalledWith('stitch:ping', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('stitch:extract-design', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('stitch:screenshot', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('stitch:design-dna', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('stitch:verify-ui', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('stitch:generate', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('stitch:edit', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('stitch:variants', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('stitch:list-screens', expect.any(Function))
  })

  it('fails if no api key is present', async () => {
    vi.mocked(authManager.getApiKey).mockReturnValue(null)
    const handler = handlers['stitch:ping']
    const result = await handler!({} as any, 'test-project')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('STITCH_API_KEY is not set')
  })

  it('creates a new stitch client when api key is provided', async () => {
    vi.mocked(authManager.getApiKey).mockReturnValue('test-api-key')

    // mock stitch via vi.spyOn to not mess with class prototype globally
    const mockProjects = vi.fn().mockResolvedValue({})
    const spy = vi.spyOn(Stitch.prototype, 'projects').mockImplementation(mockProjects)

    const handler = handlers['stitch:ping']
    const result = await handler!({} as any, 'test-project')

    expect(spy).toHaveBeenCalled()
    expect(result.ok).toBe(true)
    expect(StitchToolClient).toHaveBeenCalledWith({ apiKey: 'test-api-key' })
    spy.mockRestore()
  })

  it('returns stitch error code in error message', async () => {
    vi.mocked(authManager.getApiKey).mockReturnValue('test-api-key')

    const mockError = new StitchError({ code: 'NOT_FOUND', message: 'Project not found' } as any)
    const mockProjects = vi.fn().mockRejectedValue(mockError)
    const spy = vi.spyOn(Stitch.prototype, 'projects').mockImplementation(mockProjects)

    const handler = handlers['stitch:ping']

    const result = await handler!({} as any, 'test-project')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('NOT_FOUND')
    expect(result.error).toContain('Project not found')
    spy.mockRestore()
  })
})
