import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ipcMain } from 'electron'
import { registerOpenRouterHandlers } from './openrouter-handlers'
import * as openrouterProvider from '../llm/providers/openrouter'
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() }
}))

vi.mock('../utils/handle-ipc', () => ({
  handleIpc: vi.fn((fn) => {
    return fn()
      .then((data: any) => ({ ok: true, data }))
      .catch((e: Error) => ({ ok: false, error: e.message }))
  })
}))

vi.mock('../llm/providers/openrouter', () => ({
  listOpenRouterModels: vi.fn(),
  getOpenRouterCredits: vi.fn()
}))

describe('openrouter-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers openrouter channels', () => {
    registerOpenRouterHandlers()
    expect(ipcMain.handle).toHaveBeenCalledWith('openrouter:list-models', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('openrouter:get-credits', expect.any(Function))
  })

  it('list-models handler resolves data', async () => {
    registerOpenRouterHandlers()
    const callArgs = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === 'openrouter:list-models')
    expect(callArgs).toBeDefined()

    const handlerFn = callArgs![1] as Function
    vi.mocked(openrouterProvider.listOpenRouterModels).mockResolvedValueOnce([
      { id: 'or-model-1', name: 'OpenRouter Model', contextLength: 128000, pricing: { prompt: 1, completion: 2 } }
    ])

    const result = await handlerFn({} as any)
    expect(result.ok).toBe(true)
    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe('or-model-1')
  })

  it('get-credits handler resolves balance', async () => {
    registerOpenRouterHandlers()
    const callArgs = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === 'openrouter:get-credits')
    expect(callArgs).toBeDefined()

    const handlerFn = callArgs![1] as Function
    vi.mocked(openrouterProvider.getOpenRouterCredits).mockResolvedValueOnce(5.50)

    const result = await handlerFn({} as any)
    expect(result.ok).toBe(true)
    expect(result.data).toBe(5.50)
  })
})
