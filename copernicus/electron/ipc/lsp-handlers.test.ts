import { describe, it, expect, vi, beforeEach } from 'vitest'
import { register } from './lsp-handlers'
import { ipcMain } from 'electron'

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}))

vi.mock('../utils/handle-ipc', () => ({
  handleIpc: vi.fn(async (_channel, _args, fn) => {
    try {
      const result = await fn()
      return { ok: true, data: result }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  })
}))

describe('lsp-handlers', () => {
  let handlers: Record<string, Function> = {}

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = {}

    // Intercept ipcMain.handle to capture the registered handlers
    vi.mocked(ipcMain.handle).mockImplementation((channel, handler) => {
      handlers[channel] = handler
    })
  })

  it('lsp:workspace-check correctly gathers and returns diagnostics from cache without running tsc', async () => {
    const mockLspManager = {
      diagnosticsCache: new Map([
        ['file:///test/file1.ts', [
          { severity: 1, message: 'Error 1', range: { start: { line: 0, character: 0 } } },
          { severity: 2, message: 'Warning 1', range: { start: { line: 1, character: 5 } } }
        ]],
        ['file:///test/file2.ts', [
          { severity: 1, message: 'Error 2', range: { start: { line: 10, character: 2 } } }
        ]]
      ])
    }
    const mockFsManager = {
      getRootPath: vi.fn().mockReturnValue('/mock/root')
    }
    const mockDeps = { lspManager: mockLspManager, fsManager: mockFsManager }

    register({} as any, mockDeps)

    const handler = handlers['lsp:workspace-check']
    expect(handler).toBeDefined()

    const result = await handler!({} as any)
    if (!result.ok) {
        console.error(result.error)
    }
    expect(result.ok).toBe(true)

    const data = result.data

    // We expect clean: false because there are severity 1 errors
    expect(data.clean).toBe(false)
    expect(data.errorCount).toBe(2)
    expect(data.warningCount).toBe(1)

    expect(data.errors).toHaveLength(2)
    expect(data.errors[0]).toEqual({
      file: '/test/file1.ts',
      line: 1,
      col: 1,
      severity: 'error',
      message: 'Error 1'
    })
    expect(data.errors[1]).toEqual({
      file: '/test/file2.ts',
      line: 11,
      col: 3,
      severity: 'error',
      message: 'Error 2'
    })
  })
})
