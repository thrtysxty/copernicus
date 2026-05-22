import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ipcMain, BrowserWindow } from 'electron'
import { register } from './terminal-handlers'

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

vi.mock('../utils/path-guard', () => ({
  assertSafePath: vi.fn((p: string) => p),
}))

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock node:child_process with both named and default exports
vi.mock('node:child_process', () => {
  const mockExecFile = vi.fn()
  const all = { execFile: mockExecFile, exec: vi.fn(), spawn: vi.fn(), execSync: vi.fn(), fork: vi.fn() }
  return { ...all, default: all }
})

describe('terminal-handlers', () => {
  let handlers: Record<string, Function> = {}
  let eventHandlers: Record<string, Function> = {}
  let mockExecFile: any

  const mockPtyManager = {
    create: vi.fn(),
    resize: vi.fn().mockResolvedValue({ ok: true }),
    write: vi.fn().mockResolvedValue({ ok: true }),
    kill: vi.fn(),
    createEphemeral: vi.fn(),
  }

  const mockFsManager = {
    getRootPath: vi.fn(() => '/mock/project'),
  }

  const mockDeps = {
    ptyManager: mockPtyManager,
    fsManager: mockFsManager,
    spawn: vi.fn(),
  }

  const mockWin = {
    webContents: {
      send: vi.fn(),
    },
  } as unknown as BrowserWindow

  beforeEach(async () => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    handlers = {}
    eventHandlers = {}

    vi.mocked(ipcMain.handle).mockImplementation((channel, handler) => {
      handlers[channel] = handler
    })

    vi.mocked(ipcMain.on).mockImplementation((channel, handler) => {
      eventHandlers[channel] = handler
    })

    const cp = await import('node:child_process')
    mockExecFile = cp.execFile
  })

  it('registers terminal:create handler', () => {
    register(mockWin, mockDeps as any)
    expect(ipcMain.on).toHaveBeenCalledWith('terminal-create', expect.any(Function))
  })

  it('terminal-create calls ptyManager.create with resolved cwd', async () => {
    const { assertSafePath } = await import('../utils/path-guard')
    vi.mocked(assertSafePath).mockReturnValue('/safe/cwd')

    register(mockWin, mockDeps as any)

    const handler = eventHandlers['terminal-create']
    handler({}, { id: 'term-1', cols: 80, rows: 24, cwd: '/test/cwd' })

    expect(mockPtyManager.create).toHaveBeenCalledWith('term-1', 80, 24, '/safe/cwd', mockWin)
  })

  it('terminal-create falls back to home dir when cwd is unsafe', async () => {
    const { assertSafePath } = await import('../utils/path-guard')
    vi.mocked(assertSafePath).mockImplementation(() => {
      throw new Error('Unsafe path')
    })

    register(mockWin, mockDeps as any)

    const handler = eventHandlers['terminal-create']
    handler({}, { id: 'term-1', cols: 80, rows: 24, cwd: '/unsafe' })

    expect(mockPtyManager.create).toHaveBeenCalledWith('term-1', 80, 24, expect.any(String), mockWin)
  })

  it('registers terminal:resize handler', () => {
    register(mockWin, mockDeps as any)
    expect(ipcMain.handle).toHaveBeenCalledWith('terminal:resize', expect.any(Function))
  })

  it('terminal:resize calls ptyManager.resize', async () => {
    register(mockWin, mockDeps as any)

    const handler = handlers['terminal:resize']
    const result = await handler({} as any, { id: 'term-1', cols: 100, rows: 30 })

    expect(result.ok).toBe(true)
    expect(mockPtyManager.resize).toHaveBeenCalledWith('term-1', 100, 30)
  })

  it('registers terminal:input handler', () => {
    register(mockWin, mockDeps as any)
    expect(ipcMain.handle).toHaveBeenCalledWith('terminal:input', expect.any(Function))
  })

  it('terminal:input calls ptyManager.write', async () => {
    register(mockWin, mockDeps as any)

    const handler = handlers['terminal:input']
    const result = await handler({} as any, { id: 'term-1', data: 'ls -la' })

    expect(result.ok).toBe(true)
    expect(mockPtyManager.write).toHaveBeenCalledWith('term-1', 'ls -la')
  })

  it('registers terminal-write handler', () => {
    register(mockWin, mockDeps as any)
    expect(ipcMain.on).toHaveBeenCalledWith('terminal-write', expect.any(Function))
  })

  it('terminal-write calls ptyManager.write', () => {
    register(mockWin, mockDeps as any)

    const handler = eventHandlers['terminal-write']
    handler({}, { id: 'term-1', data: 'echo hello' })

    expect(mockPtyManager.write).toHaveBeenCalledWith('term-1', 'echo hello')
  })

  it('registers terminal-kill handler', () => {
    register(mockWin, mockDeps as any)
    expect(ipcMain.on).toHaveBeenCalledWith('terminal-kill', expect.any(Function))
  })

  it('terminal-kill calls ptyManager.kill', () => {
    register(mockWin, mockDeps as any)

    const handler = eventHandlers['terminal-kill']
    handler({}, { id: 'term-1' })

    expect(mockPtyManager.kill).toHaveBeenCalledWith('term-1')
  })

  it('registers terminal:stop-agent handler', () => {
    register(mockWin, mockDeps as any)
    expect(ipcMain.handle).toHaveBeenCalledWith('terminal:stop-agent', expect.any(Function))
  })

  it('terminal:stop-agent calls ptyManager.kill', async () => {
    register(mockWin, mockDeps as any)

    const handler = handlers['terminal:stop-agent']
    const result = await handler({} as any, { id: 'agent-1' })

    expect(result.ok).toBe(true)
    expect(mockPtyManager.kill).toHaveBeenCalledWith('agent-1')
  })

  it('registers terminal:spawn handler', () => {
    register(mockWin, mockDeps as any)
    expect(ipcMain.handle).toHaveBeenCalledWith('terminal:spawn', expect.any(Function))
  })

  it('terminal:spawn creates ephemeral terminal', async () => {
    register(mockWin, mockDeps as any)

    const handler = handlers['terminal:spawn']
    const result = await handler({} as any, {
      command: 'npm test',
      cwd: '/mock/project',
      label: 'Test Runner',
    })

    expect(result.ok).toBe(true)
    expect(mockPtyManager.createEphemeral).toHaveBeenCalled()
    expect(typeof result.data).toBe('string')
  })

  it('registers terminal:spawn-agent handler', () => {
    register(mockWin, mockDeps as any)
    expect(ipcMain.handle).toHaveBeenCalledWith('terminal:spawn-agent', expect.any(Function))
  })

  it('terminal:spawn-agent sends activate-tab event', async () => {
    const mockAllWindows = [{ webContents: { send: vi.fn() } }]
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue(mockAllWindows as any)

    register(mockWin, mockDeps as any)

    const handler = handlers['terminal:spawn-agent']
    await handler({}, { agentId: 'test-agent' })

    expect(mockAllWindows[0].webContents.send).toHaveBeenCalledWith('terminal:activate-tab', {
      agentId: 'test-agent',
    })
  })

  it('registers system:make handler', () => {
    register(mockWin, mockDeps as any)
    expect(ipcMain.on).toHaveBeenCalledWith('system:make', expect.any(Function))
  })

  it('system:make spawns make command for allowed targets', () => {
    register(mockWin, mockDeps as any)

    const allowedTargets = ['dev', 'test', 'build', 'lint', 'backlog', 'deploy']
    const handler = eventHandlers['system:make']

    allowedTargets.forEach(target => {
      handler({}, target)
      expect(mockDeps.spawn).toHaveBeenCalledWith('make', [target], expect.any(Object))
    })
  })

  it('system:make ignores disallowed targets', () => {
    register(mockWin, mockDeps as any)

    const handler = eventHandlers['system:make']
    handler({}, 'dangerous-target')

    expect(mockDeps.spawn).not.toHaveBeenCalled()
  })

  it('registers runtime:check-docker handler', () => {
    register(mockWin, mockDeps as any)
    expect(ipcMain.handle).toHaveBeenCalledWith('runtime:check-docker', expect.any(Function))
  })

  it('runtime:check-docker returns true when docker is available', async () => {
    mockExecFile.mockImplementation((...args: any[]) => {
      const cb = args.find((a: any) => typeof a === 'function')
      if (cb) cb(null, '', '')
    })

    register(mockWin, mockDeps as any)

    const handler = handlers['runtime:check-docker']
    const result = await handler({} as any)

    expect(result.ok).toBe(true)
    expect(result.data).toBe(true)
  })

  it('runtime:check-docker returns false when docker is not available', async () => {
    mockExecFile.mockImplementation((...args: any[]) => {
      const cb = args.find((a: any) => typeof a === 'function')
      if (cb) cb(new Error('not found'), '', '')
    })

    register(mockWin, mockDeps as any)

    const handler = handlers['runtime:check-docker']
    const result = await handler({} as any)

    expect(result.ok).toBe(true)
    expect(result.data).toBe(false)
  })

  it('registers runtime:list-containers handler', () => {
    register(mockWin, mockDeps as any)
    expect(ipcMain.handle).toHaveBeenCalledWith('runtime:list-containers', expect.any(Function))
  })

  it('runtime:list-containers parses container list', async () => {
    const jsonOutput = JSON.stringify({ Names: 'test-container', Status: 'running' })
    mockExecFile.mockImplementation((...args: any[]) => {
      const cb = args.find((a: any) => typeof a === 'function')
      if (cb) cb(null, jsonOutput, '')
    })

    register(mockWin, mockDeps as any)

    const handler = handlers['runtime:list-containers']
    const result = await handler({} as any)

    expect(result.ok).toBe(true)
    expect(result.data).toHaveLength(1)
  })

  it('runtime:list-containers returns empty array on error', async () => {
    mockExecFile.mockImplementation((...args: any[]) => {
      const cb = args.find((a: any) => typeof a === 'function')
      if (cb) cb(new Error('docker not running'), '', '')
    })

    register(mockWin, mockDeps as any)

    const handler = handlers['runtime:list-containers']
    const result = await handler({} as any)

    expect(result.ok).toBe(true)
    expect(result.data).toEqual([])
  })
})
