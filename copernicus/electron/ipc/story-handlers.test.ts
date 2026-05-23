import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ipcMain } from 'electron'
import { register } from './story-handlers'

vi.mock('../utils/handle-ipc', () => ({
  handleIpc: vi.fn(async (channelOrFn: any, fnOrNothing?: any) => {
    const fn = typeof channelOrFn === 'function' ? channelOrFn : fnOrNothing
    try {
      const result = await fn!()
      if (result && typeof result === 'object' && 'error' in result) {
        return result
      }
      return { ok: true, data: result }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? String(e) }
    }
  }),
}))

vi.mock('../db/state-ledger', () => ({
  stateLedger: {
    getStoryById: vi.fn((_id: string) => null),
    getStoriesFromDb: vi.fn(() => []),
    listStoriesFromDb: vi.fn(() => []),
    upsertStory: vi.fn(),
    updateStoryFields: vi.fn(),
    deleteStory: vi.fn(),
  },
}))

describe('story-handlers', () => {
  let handlers: Record<string, Function> = {}
  let mockWindow: any
  let mockDeps: any

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = {}
    mockDeps = {
      storiesManager: {
        createStory: vi.fn(),
        updateStoryStatus: vi.fn(),
        setStoryStatus: vi.fn(),
        archiveStory: vi.fn(),
        deleteStory: vi.fn(),
        setField: vi.fn(),
        getStoryContent: vi.fn((_id: string) => '# Test Story\n**Status:** PLANNING'),
        getStoryPath: vi.fn((_id: string) => '/test/story.md'),
        listStories: vi.fn(() => []),
        syncFromDisk: vi.fn(() => 0),
        isRepoTargeted: vi.fn(() => false),
        targetProject: vi.fn(() => 0),
        importFromPath: vi.fn(() => 0),
        throughput: vi.fn(() => 0),
        statusDistribution: vi.fn(() => ({})),
        bugsByAssignee: vi.fn(() => ({})),
      } as unknown as any,
      stateLedger: {
        getStoriesThroughput: vi.fn(() => 0),
        getStoriesStatusDistribution: vi.fn(() => ({})),
        getStoriesBugsByAssignee: vi.fn(() => ({})),
      },
    }

    mockWindow = {
      webContents: {
        send: vi.fn(),
      },
    }

    ipcMain.handle = (channel: string, handler: Function) => {
      handlers[channel] = handler
    }

    register(mockWindow, mockDeps as any)
  })

  afterEach(() => {
    vi.clearAllMocks()
    handlers = {}
  })

  describe('stories:create', () => {
    it('returns { ok: true, data: story } for happy path', async () => {
      const payload = { title: 'Test Story', type: 'Feature' }
      const result = await handlers['stories:create']!({} as any, payload)

      expect(result.ok).toBe(true)
      expect(result.data).toBe('story_001')
      expect(mockDeps.storiesManager.createStory).toHaveBeenCalledWith(payload)
    })

    it('handles string title argument', async () => {
      const payload = 'Quick Story'
      const result = await handlers['stories:create']!({} as any, payload)

      expect(result.ok).toBe(true)
      expect(mockDeps.storiesManager.createStory).toHaveBeenCalledWith({
        title: 'Quick Story',
        type: undefined,
        epic: undefined,
        priority: undefined,
      })
    })
  })

  describe('stories:update', () => {
    it('returns { ok: true } for valid status transition to IN_PROGRESS', async () => {
      const payload = { id: 'story_001', status: 'IN_PROGRESS' }
      const result = await handlers['stories:update']!({} as any, payload.id, payload.status)

      expect(result.ok).toBe(true)
      expect(mockDeps.storiesManager.updateStoryStatus).toHaveBeenCalledWith('story_001', 'IN_PROGRESS')
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('story:status-changed', {
        id: 'story_001',
        status: 'IN_PROGRESS',
      })
    })

    it('returns { ok: false, error } when handler throws', async () => {
      mockDeps.storiesManager.updateStoryStatus = vi.fn(() => {
        throw new Error('Invalid status transition')
      })

      const result = await handlers['stories:update']!({} as any, 'story_001', 'INVALID')

      expect(result.ok).toBe(false)
      expect(result.error).toBe('Invalid status transition')
    })
  })

  describe('stories:set-status', () => {
    it('returns { ok: true } after setting story status by number', async () => {
      const payload = { storyNumber: 1, status: 'COMPLETE' }
      const result = await handlers['stories:set-status']!({} as any, payload)

      expect(result.ok).toBe(true)
      expect(mockDeps.storiesManager.setStoryStatus).toHaveBeenCalledWith(1, 'COMPLETE')
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('stories:status-changed', {
        storyNumber: 1,
        status: 'COMPLETE',
      })
    })

    it('returns { ok: false, error } when setStoryStatus throws', async () => {
      mockDeps.storiesManager.setStoryStatus = vi.fn(() => {
        throw new Error('Story not found')
      })

      const result = await handlers['stories:set-status']!({} as any, { storyNumber: 999, status: 'READY' })

      expect(result.ok).toBe(false)
      expect(result.error).toBe('Story not found')
    })
  })

  describe('stories:archive', () => {
    it('returns { ok: true } after archiving story', async () => {
      const result = await handlers['stories:archive']!({} as any, 'story_001')

      expect(result.ok).toBe(true)
      expect(mockDeps.storiesManager.archiveStory).toHaveBeenCalledWith('story_001')
    })

    it('returns { ok: false, error } for invalid id', async () => {
      const result = await handlers['stories:archive']!({} as any, 'invalid-id')

      expect(result.ok).toBe(false)
      expect(result.error).toBe('undefined')
    })
  })

  describe('stories:delete', () => {
    it('returns { ok: true } after deleting story', async () => {
      const result = await handlers['stories:delete']!({} as any, 'story_001')

      expect(result.ok).toBe(true)
      expect(mockDeps.storiesManager.deleteStory).toHaveBeenCalledWith('story_001')
    })

    it('returns { ok: false, error } when handler throws', async () => {
      mockDeps.storiesManager.deleteStory = vi.fn(() => {
        throw new Error('Story not found')
      })

      const result = await handlers['stories:delete']!({} as any, 'nonexistent')

      expect(result.ok).toBe(false)
      expect(result.error).toBe('Story not found')
    })

    it('returns { ok: false, error } for invalid id', async () => {
      const result = await handlers['stories:delete']!({} as any, 'invalid')

      expect(result.ok).toBe(false)
      expect(result.error).toBe('undefined')
    })
  })

  describe('stories:set-field', () => {
    it('returns { ok: true } after updating a single field', async () => {
      const payload = { id: 'story_001', field: 'priority', value: 'P1' }
      const result = await handlers['stories:set-field']!({} as any, payload)

      expect(result.ok).toBe(true)
      expect(mockDeps.storiesManager.setField).toHaveBeenCalledWith('story_001', 'priority', 'P1')
    })

    it('returns { ok: false, error } when handler throws', async () => {
      mockDeps.storiesManager.setField = vi.fn(() => {
        throw new Error('Invalid field')
      })

      const result = await handlers['stories:set-field']!({} as any, { id: 'story_001', field: 'invalid', value: 'x' })

      expect(result.ok).toBe(false)
      expect(result.error).toBe('Invalid field')
    })

    it('returns { ok: false, error } for invalid id', async () => {
      const result = await handlers['stories:set-field']!({} as any, { id: 'invalid', field: 'priority', value: 'P1' })

      expect(result.ok).toBe(false)
      expect(result.error).toBe('undefined')
    })
  })

  describe('stories:sync', () => {
    it('returns { ok: true } after syncing from disk', async () => {
      const result = await handlers['stories:sync']!({} as any)

      expect(result.ok).toBe(true)
      expect(mockDeps.storiesManager.syncFromDisk).toHaveBeenCalled()
    })

    it('returns { ok: false, error } when handler throws', async () => {
      mockDeps.storiesManager.syncFromDisk = vi.fn(() => {
        throw new Error('Sync failed')
      })

      const result = await handlers['stories:sync']!({} as any)

      expect(result.ok).toBe(false)
      expect(result.error).toBe('Sync failed')
    })
  })

  describe('stories:list', () => {
    it('returns { ok: true } with list of stories', async () => {
      mockDeps.storiesManager.listStories = vi.fn(() => [{ id: 'story_001', title: 'Test' }])

      const result = await handlers['stories:list']!({} as any)

      expect(result.ok).toBe(true)
      expect(result.data).toHaveLength(1)
    })

    it('returns { ok: false, error } when handler throws', async () => {
      mockDeps.storiesManager.listStories = vi.fn(() => {
        throw new Error('List failed')
      })

      const result = await handlers['stories:list']!({} as any)

      expect(result.ok).toBe(false)
      expect(result.error).toBe('List failed')
    })
  })

  describe('Full lifecycle test', () => {
    it('complete lifecycle: create → update to COMPLETE → archive', async () => {
      // Step 1: Create story
      const createResult = await handlers['stories:create']!({} as any, { title: 'Lifecycle Test', type: 'Feature' })
      expect(createResult.ok).toBe(true)
      expect(createResult.data).toBe('story_001')

      // Step 2: Update to COMPLETE
      const updateResult = await handlers['stories:update']!({} as any, 'story_001', 'COMPLETE')
      expect(updateResult.ok).toBe(true)
      expect(mockDeps.storiesManager.updateStoryStatus).toHaveBeenCalledWith('story_001', 'COMPLETE')

      // Step 3: Archive
      const archiveResult = await handlers['stories:archive']!({} as any, 'story_001')
      expect(archiveResult.ok).toBe(true)
      expect(mockDeps.storiesManager.archiveStory).toHaveBeenCalledWith('story_001')
    })

    it('lifecycle with set-status and delete', async () => {
      // Create
      const createResult = await handlers['stories:create']!({} as any, { title: 'Test', type: 'Epic' })
      expect(createResult.ok).toBe(true)

      // Set status via set-status handler
      const statusResult = await handlers['stories:set-status']!({} as any, { storyNumber: 1, status: 'READY' })
      expect(statusResult.ok).toBe(true)

      // Delete
      const deleteResult = await handlers['stories:delete']!({} as any, 'story_001')
      expect(deleteResult.ok).toBe(true)
    })
  })

  describe('story:scaffold', () => {
    it('returns { ok: true, data: story } for scaffold command', async () => {
      const result = await handlers['story:scaffold']!({} as any, 'New Story', 'Feature')

      expect(result.ok).toBe(true)
      expect(mockDeps.storiesManager.createStory).toHaveBeenCalledWith({
        title: 'New Story',
        type: 'Feature',
        epic: '',
        priority: 'P2',
      })
    })

    it('handles empty title with default', async () => {
      const result = await handlers['story:scaffold']!({} as any, '', 'Bug')

      expect(result.ok).toBe(true)
      expect(mockDeps.storiesManager.createStory).toHaveBeenCalledWith({
        title: 'New Story', // trimmed empty string
        type: 'Bug',
        epic: '',
        priority: 'P2',
      })
    })
  })

  describe('stories:hydrate', () => {
    it('returns { ok: true } and sends editor:open for valid id', async () => {
      mockDeps.storiesManager.getStoryContent = vi.fn(() => '# Test Story')
      mockDeps.storiesManager.getStoryPath = vi.fn(() => '/path/to/story.md')

      const result = await handlers['stories:hydrate']!({} as any, 'story_001')

      expect(result.ok).toBe(true)
      expect(mockDeps.storiesManager.getStoryContent).toHaveBeenCalledWith('story_001')
      expect(mockDeps.storiesManager.getStoryPath).toHaveBeenCalledWith('story_001')
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('editor:open', {
        path: '/path/to/story.md',
        content: '# Test Story',
      })
    })

    it('returns { ok: false, error } for invalid id', async () => {
      const result = await handlers['stories:hydrate']!({} as any, 'invalid')

      expect(result.ok).toBe(false)
      expect(result.error).toBe('undefined')
    })
  })

  describe('stories:get-content', () => {
    it('returns { ok: true } with story content', async () => {
      const result = await handlers['stories:get-content']!({} as any, 'story_001')

      expect(result.ok).toBe(true)
      expect(mockDeps.storiesManager.getStoryContent).toHaveBeenCalledWith('story_001')
    })

    it('returns { ok: false, error } when handler throws', async () => {
      mockDeps.storiesManager.getStoryContent = vi.fn(() => {
        throw new Error('Not found')
      })

      const result = await handlers['stories:get-content']!({} as any, 'nonexistent')

      expect(result.ok).toBe(false)
      expect(result.error).toBe('Not found')
    })
  })
})
