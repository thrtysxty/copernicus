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

describe('worktree-handlers', () => {
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

  async function getRegister() {
    const { registerWorktreeHandlers } = await import('./worktree-handlers')
    return registerWorktreeHandlers
  }

  describe('worktree:create', () => {
    it('rejects path traversal branch names', async () => {
      mockManager.create.mockRejectedValue(new Error('Branch name must not contain path traversal sequences'))

      const register = await getRegister()
      register(mockManager as any)

      const handler = handlers['worktree:create']!
      const result = await handler({} as any, { branch: '../../outside-repo', storyId: 1, nodeId: null, mergeMode: 'gated' })

      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/path traversal/)
    })

    it('creates worktree successfully', async () => {
      mockManager.create.mockResolvedValue({ path: '/tmp/worktree', branch: 'story/001' })

      const register = await getRegister()
      register(mockManager as any)

      const handler = handlers['worktree:create']!
      const result = await handler({} as any, { branch: 'story/001', storyId: 1, nodeId: null, mergeMode: 'gated' })

      expect(mockManager.create).toHaveBeenCalledWith('story/001', 1, null, 'gated')
      expect(result.ok).toBe(true)
      expect(result.data).toEqual({ path: '/tmp/worktree', branch: 'story/001' })
    })

    it('returns error if worktree already exists (duplicate)', async () => {
      mockManager.create.mockRejectedValue(new Error('Worktree already exists for this branch'))

      const register = await getRegister()
      register(mockManager as any)

      const handler = handlers['worktree:create']!
      const result = await handler({} as any, { branch: 'story/001', storyId: 1, nodeId: null, mergeMode: 'gated' })

      expect(result.ok).toBe(false)
      expect(result.error).toBe('Worktree already exists for this branch')
    })
  })

  describe('worktree:list', () => {
    it('returns list of worktrees', async () => {
      const mockList = [
        { id: '1', branch: 'story/1' },
        { id: '2', branch: 'story/2' }
      ]
      mockManager.list.mockResolvedValue(mockList)

      const register = await getRegister()
      register(mockManager as any)

      const handler = handlers['worktree:list']!
      const result = await handler({} as any)

      expect(result.ok).toBe(true)
      expect(result.data).toEqual(mockList)
    })

    it('returns empty array if polling is stopped', async () => {
      mockManager.isPollingStopped = true

      const register = await getRegister()
      register(mockManager as any)

      const handler = handlers['worktree:list']!
      const result = await handler({} as any)

      expect(result.ok).toBe(true)
      expect(result.data).toEqual([])
      expect(mockManager.list).not.toHaveBeenCalled()
    })
  })

  describe('worktree:remove', () => {
    it('removes worktree successfully', async () => {
      mockManager.remove.mockResolvedValue(undefined)

      const register = await getRegister()
      register(mockManager as any)

      const handler = handlers['worktree:remove']!
      const result = await handler({} as any, { id: 'wt-123' })

      expect(mockManager.remove).toHaveBeenCalledWith('wt-123')
      expect(result.ok).toBe(true)
    })

    it('returns error for nonexistent worktree', async () => {
      mockManager.remove.mockRejectedValue(new Error('Worktree not found'))

      const register = await getRegister()
      register(mockManager as any)

      const handler = handlers['worktree:remove']!
      const result = await handler({} as any, { id: 'missing' })

      expect(result.ok).toBe(false)
      expect(result.error).toBe('Worktree not found')
    })
  })

  describe('worktree:diff', () => {
    it('returns worktree diff', async () => {
      mockManager.getDiff.mockResolvedValue('diff string')

      const register = await getRegister()
      register(mockManager as any)

      const handler = handlers['worktree:diff']!
      const result = await handler({} as any, { id: 'wt-123' })

      expect(mockManager.getDiff).toHaveBeenCalledWith('wt-123')
      expect(result.ok).toBe(true)
      expect(result.data).toBe('diff string')
    })
  })

  describe('worktree:merge', () => {
    it('merges worktree successfully', async () => {
      mockManager.merge.mockResolvedValue(undefined)

      const register = await getRegister()
      register(mockManager as any)

      const handler = handlers['worktree:merge']!
      const result = await handler({} as any, { id: 'wt-123' })

      expect(mockManager.merge).toHaveBeenCalledWith('wt-123')
      expect(result.ok).toBe(true)
    })
  })

  describe('worktree:poll', () => {
    it('polls worktrees successfully', async () => {
      mockManager.poll.mockResolvedValue(undefined)

      const register = await getRegister()
      register(mockManager as any)

      const handler = handlers['worktree:poll']!
      const result = await handler({} as any)

      expect(mockManager.poll).toHaveBeenCalled()
      expect(result.ok).toBe(true)
    })
  })
})
