import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ipcMain } from 'electron'
import { registerBrowserHandlers } from './browser-handlers'
import { execFileAsync } from '../utils/exec-async'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() }
}))

vi.mock('../utils/handle-ipc', () => ({
  handleIpc: vi.fn(async (fn) => {
    try {
      const result = await fn()
      return { ok: true, data: result }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  })
}))

vi.mock('../utils/exec-async', () => ({
  execFileAsync: vi.fn()
}))

describe('browser-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers all browser IPC channels', () => {
    registerBrowserHandlers()
    
    expect(ipcMain.handle).toHaveBeenCalledWith('browser:navigate', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('browser:snapshot', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('browser:screenshot', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('browser:click', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('browser:console', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('browser:eval', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('browser:network', expect.any(Function))
  })

  it('browser:navigate calls execFileAsync with correct args', async () => {
    registerBrowserHandlers()
    const callArgs = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === 'browser:navigate')
    expect(callArgs).toBeDefined()

    const handlerFn = callArgs![1] as Function
    vi.mocked(execFileAsync).mockResolvedValueOnce({ stdout: '{}', stderr: '' })

    await handlerFn({} as any, 'https://example.com')
    expect(execFileAsync).toHaveBeenCalledWith('agent-browser', ['open', 'https://example.com', '--json'])
  })

  it('browser:snapshot calls execFileAsync with correct args', async () => {
    registerBrowserHandlers()
    const callArgs = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === 'browser:snapshot')
    expect(callArgs).toBeDefined()

    const handlerFn = callArgs![1] as Function
    vi.mocked(execFileAsync).mockResolvedValueOnce({ stdout: '{}', stderr: '' })

    await handlerFn({} as any)
    expect(execFileAsync).toHaveBeenCalledWith('agent-browser', ['snapshot', '--json'])
  })

  it('browser:screenshot with full option passes --full flag', async () => {
    registerBrowserHandlers()
    const callArgs = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === 'browser:screenshot')
    expect(callArgs).toBeDefined()

    const handlerFn = callArgs![1] as Function
    vi.mocked(execFileAsync).mockResolvedValueOnce({ stdout: '{}', stderr: '' })

    await handlerFn({} as any, { full: true })
    expect(execFileAsync).toHaveBeenCalledWith('agent-browser', ['screenshot', '--json', '--full'])
  })

  it('browser:screenshot without full option omits --full flag', async () => {
    registerBrowserHandlers()
    const callArgs = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === 'browser:screenshot')
    expect(callArgs).toBeDefined()

    const handlerFn = callArgs![1] as Function
    vi.mocked(execFileAsync).mockResolvedValueOnce({ stdout: '{}', stderr: '' })

    await handlerFn({} as any, {})
    expect(execFileAsync).toHaveBeenCalledWith('agent-browser', ['screenshot', '--json'])
  })

  it('browser:click passes selector to execFileAsync', async () => {
    registerBrowserHandlers()
    const callArgs = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === 'browser:click')
    expect(callArgs).toBeDefined()

    const handlerFn = callArgs![1] as Function
    vi.mocked(execFileAsync).mockResolvedValueOnce({ stdout: '{}', stderr: '' })

    await handlerFn({} as any, 'button#submit')
    expect(execFileAsync).toHaveBeenCalledWith('agent-browser', ['click', 'button#submit', '--json'])
  })

  it('browser:console uses chrome-devtools-axi with limit', async () => {
    registerBrowserHandlers()
    const callArgs = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === 'browser:console')
    expect(callArgs).toBeDefined()

    const handlerFn = callArgs![1] as Function
    vi.mocked(execFileAsync).mockResolvedValueOnce({ stdout: '{}', stderr: '' })

    await handlerFn({} as any)
    expect(execFileAsync).toHaveBeenCalledWith('npx', ['-y', 'chrome-devtools-axi', 'console', '--json', '--limit', '50'])
  })

  it('browser:eval passes expression to chrome-devtools-axi', async () => {
    registerBrowserHandlers()
    const callArgs = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === 'browser:eval')
    expect(callArgs).toBeDefined()

    const handlerFn = callArgs![1] as Function
    vi.mocked(execFileAsync).mockResolvedValueOnce({ stdout: '{}', stderr: '' })

    await handlerFn({} as any, 'document.title')
    expect(execFileAsync).toHaveBeenCalledWith('npx', ['-y', 'chrome-devtools-axi', 'eval', 'document.title', '--json'])
  })

  it('browser:network fetches network requests with limit', async () => {
    registerBrowserHandlers()
    const callArgs = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === 'browser:network')
    expect(callArgs).toBeDefined()

    const handlerFn = callArgs![1] as Function
    vi.mocked(execFileAsync).mockResolvedValueOnce({ stdout: '{}', stderr: '' })

    await handlerFn({} as any)
    expect(execFileAsync).toHaveBeenCalledWith('npx', ['-y', 'chrome-devtools-axi', 'network', '--json', '--limit', '50'])
  })

  it('returns error when execFileAsync throws', async () => {
    registerBrowserHandlers()
    const callArgs = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === 'browser:navigate')
    expect(callArgs).toBeDefined()

    const handlerFn = callArgs![1] as Function
    vi.mocked(execFileAsync).mockRejectedValueOnce(new Error('Browser not available'))

    const result = await handlerFn({} as any, 'https://example.com')
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Browser not available')
  })
})
