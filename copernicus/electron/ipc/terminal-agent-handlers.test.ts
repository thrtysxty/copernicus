import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ipcMain, BrowserWindow } from 'electron'
import { register } from './terminal-agent-handlers'

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}))

vi.mock('../utils/handle-ipc', () => ({
  handleIpc: vi.fn(async (channelOrFn, _argsOrNothing, fnOrNothing) => {
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

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('terminal-agent-handlers', () => {
  let handlers: Record<string, Function> = {}

  const mockLayoutStore = {
    getTerminals: vi.fn(),
    setActiveTerminal: vi.fn(),
    addTerminal: vi.fn(),
    setTerminalOpen: vi.fn(),
  }

  const mockDeps = {
    layoutStore: mockLayoutStore,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = {}

    vi.mocked(ipcMain.handle).mockImplementation((channel, handler) => {
      handlers[channel] = handler
    })
  })

  it('registers terminal:attach-agent handler', () => {
    register({} as BrowserWindow, mockDeps as any)

    expect(ipcMain.handle).toHaveBeenCalledWith(
      'terminal:attach-agent',
      expect.any(Function)
    )
  })

  it('activates existing terminal when found', async () => {
    mockLayoutStore.getTerminals.mockReturnValue([
      { id: 'agent-test-123', label: 'Test Agent', isBusy: false },
    ])

    register({} as BrowserWindow, mockDeps as any)

    const handler = handlers['terminal:attach-agent']!
    const result = await handler({} as any, { agentId: 'test-123', label: 'Test Agent' })

    expect(result.ok).toBe(true)
    expect(result.data.message).toBe('Existing terminal activated.')
    expect(mockLayoutStore.setActiveTerminal).toHaveBeenCalledWith('agent-test-123')
    expect(mockLayoutStore.addTerminal).not.toHaveBeenCalled()
  })

  it('creates new terminal when not found', async () => {
    mockLayoutStore.getTerminals.mockReturnValue([])

    register({} as BrowserWindow, mockDeps as any)

    const handler = handlers['terminal:attach-agent']!
    const result = await handler({} as any, { agentId: 'new-agent', label: 'New Agent' })

    expect(result.ok).toBe(true)
    expect(result.data.message).toBe('New terminal created and activated.')
    expect(mockLayoutStore.addTerminal).toHaveBeenCalledWith('agent-new-agent', 'New Agent', true)
    expect(mockLayoutStore.setTerminalOpen).toHaveBeenCalledWith(true)
  })

  it('handles IPC errors gracefully', async () => {
    mockLayoutStore.getTerminals.mockImplementation(() => {
      throw new Error('Layout store error')
    })

    register({} as BrowserWindow, mockDeps as any)

    const handler = handlers['terminal:attach-agent']!
    const result = await handler({} as any, { agentId: 'test', label: 'Test' })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('Layout store error')
  })
})
