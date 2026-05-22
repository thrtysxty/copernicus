import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ipcMain, BrowserWindow } from 'electron'

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
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
  }),
}))

vi.mock('../utils/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('../memory/memoryService', () => ({
  memoryService: {
    logWork: vi.fn(),
  },
}))

vi.mock('../db/state-ledger', () => ({
  stateLedger: {
    getProjectByPath: vi.fn(() => null),
  },
}))

// Mock node:child_process with both named and default exports so promisify works
vi.mock('node:child_process', () => {
  const mockExec = vi.fn()
  const mockExecFile = vi.fn()
  const mockSpawn = vi.fn()
  const mockExecSync = vi.fn()
  const mockFork = vi.fn()
  const all = { exec: mockExec, execFile: mockExecFile, spawn: mockSpawn, execSync: mockExecSync, fork: mockFork }
  return { ...all, default: all }
})

vi.mock('node:util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:util')>()
  return {
    ...actual,
    promisify: vi.fn((fn: any) => {
      // Return a function that calls fn with callback style and wraps in a promise
      return (...args: any[]) => new Promise((resolve, reject) => {
        fn(...args, (err: any, result: any) => {
          if (err) reject(err)
          else resolve(result)
        })
      })
    }),
  }
})

describe('git-handlers', () => {
  let handlers: Record<string, Function> = {}
  let mockExec: any
  let mockExecFile: any

  const mockDeps = {
    settingsStore: { get: vi.fn(() => '/test/project') },
    authManager: { getApiKey: vi.fn(() => 'test-token') },
  }

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    handlers = {}

    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: Function) => {
      handlers[channel] = handler
    })

    const cp = await import('node:child_process')
    mockExec = cp.exec
    mockExecFile = cp.execFile
  })

  async function getRegister() {
    const { register } = await import('./git-handlers')
    return register
  }

  describe('git:check-repo', () => {
    it('returns hasGit true when inside a git repo', async () => {
      mockExec.mockImplementation((...args: any[]) => {
        const cb = args.find((a: any) => typeof a === 'function')
        if (cb) cb(null, { stdout: 'true\n', stderr: '' })
      })

      const register = await getRegister()
      register({} as BrowserWindow, mockDeps as any)

      const handler = handlers['git:check-repo']!
      const result = await handler({} as any, { path: '/test/project' })

      expect(result.ok).toBe(true)
      expect(result.data.hasGit).toBe(true)
    })

    it('returns hasGit false when not a git repo', async () => {
      mockExec.mockImplementation((...args: any[]) => {
        const cb = args.find((a: any) => typeof a === 'function')
        if (cb) cb(new Error('Not a git repository'), null)
      })

      const register = await getRegister()
      register({} as BrowserWindow, mockDeps as any)

      const handler = handlers['git:check-repo']!
      const result = await handler({} as any, { path: '/tmp' })

      expect(result.ok).toBe(true)
      expect(result.data.hasGit).toBe(false)
    })
  })

  describe('git:current-branch', () => {
    it('returns branch name on success', async () => {
      mockExec.mockImplementation((...args: any[]) => {
        const cb = args.find((a: any) => typeof a === 'function')
        if (cb) cb(null, { stdout: 'feature-branch\n', stderr: '' })
      })

      const register = await getRegister()
      register({} as BrowserWindow, mockDeps as any)

      const handler = handlers['git:current-branch']!
      const result = await handler({} as any)

      expect(result.ok).toBe(true)
      expect(result.data).toBe('feature-branch')
    })

    it('returns error when git command fails', async () => {
      mockExec.mockImplementation((...args: any[]) => {
        const cb = args.find((a: any) => typeof a === 'function')
        if (cb) cb(new Error('Not a git repository'), null)
      })

      const register = await getRegister()
      register({} as BrowserWindow, mockDeps as any)

      const handler = handlers['git:current-branch']!
      const result = await handler({} as any)

      expect(result.ok).toBe(false)
      expect(result.error).toBe('Not a git repository')
    })
  })

  describe('git:diff-file', () => {
    it('returns diff output on success', async () => {
      mockExec.mockImplementation((...args: any[]) => {
        const cb = args.find((a: any) => typeof a === 'function')
        if (cb) cb(null, { stdout: 'diff content here\n', stderr: '' })
      })

      const register = await getRegister()
      register({} as BrowserWindow, mockDeps as any)

      const handler = handlers['git:diff-file']!
      const result = await handler({} as any, { file: 'src/test.ts' })

      expect(result.ok).toBe(true)
      expect(result.data).toBe('diff content here\n')
    })

    it('returns error when git diff fails', async () => {
      mockExec.mockImplementation((...args: any[]) => {
        const cb = args.find((a: any) => typeof a === 'function')
        if (cb) cb(new Error('fatal: ambiguous argument'), null)
      })

      const register = await getRegister()
      register({} as BrowserWindow, mockDeps as any)

      const handler = handlers['git:diff-file']!
      const result = await handler({} as any, { file: 'missing.ts' })

      expect(result.ok).toBe(false)
      expect(result.error).toBe('fatal: ambiguous argument')
    })
  })

  describe('git:stage', () => {
    it('stages file and returns ok', async () => {
      mockExec.mockImplementation((...args: any[]) => {
        const cb = args.find((a: any) => typeof a === 'function')
        if (cb) cb(null, { stdout: '', stderr: '' })
      })

      const register = await getRegister()
      register({} as BrowserWindow, mockDeps as any)

      const handler = handlers['git:stage']!
      const result = await handler({} as any, { file: 'src/test.ts' })

      expect(result.ok).toBe(true)
    })
  })

  describe('git:checkout', () => {
    it('checks out branch and returns ok', async () => {
      mockExecFile.mockImplementation((...args: any[]) => {
        const cb = args.find((a: any) => typeof a === 'function')
        if (cb) cb(null, { stdout: '', stderr: '' })
      })

      const register = await getRegister()
      register({} as BrowserWindow, mockDeps as any)

      const handler = handlers['git:checkout']!
      const result = await handler({} as any, { branch: 'main' })

      expect(result.ok).toBe(true)
    })
  })

  describe('git:new-branch', () => {
    it('creates and checks out new branch', async () => {
      mockExecFile.mockImplementation((...args: any[]) => {
        const cb = args.find((a: any) => typeof a === 'function')
        if (cb) cb(null, { stdout: '', stderr: '' })
      })

      const register = await getRegister()
      register({} as BrowserWindow, mockDeps as any)

      const handler = handlers['git:new-branch']!
      const result = await handler({} as any, { name: 'feature/new' })

      expect(result.ok).toBe(true)
    })
  })
})
