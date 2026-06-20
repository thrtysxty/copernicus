import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WorkflowEngine } from './engine'
import { WorkflowGraph } from './types'
import type { EngineServices } from './engine'

vi.mock('../memory/memoryService', () => ({
  memoryService: {
    setActiveProject: vi.fn(),
    addMemory: vi.fn().mockResolvedValue(undefined),
    logWork: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../db/state-ledger', () => ({
  stateLedger: {
    init: vi.fn(),
    getActiveProject: vi.fn(() => ({ id: 'proj-1' })),
    getProjectByPath: vi.fn(() => ({ id: 'proj-1' })),
    logEvent: vi.fn(),
    vacuum: vi.fn(),
  },
}))

vi.mock('../codebase-indexer', () => ({
  CodebaseIndexer: vi.fn().mockImplementation(() => ({
    startIndexing: vi.fn().mockResolvedValue(undefined),
  })),
}))

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine
  let mockWin: any
  let mockServices: EngineServices

  beforeEach(() => {
    vi.clearAllMocks()

    mockWin = {
      webContents: {
        send: vi.fn(),
      },
    }

    mockServices = {
      win: mockWin as any,
      fsManager: {
        getRootPath: vi.fn().mockReturnValue('/mock/workspace'),
        writeFile: vi.fn(),
        readFile: vi.fn(),
      } as any,
      stateLedger: {
        logEvent: vi.fn(),
        getProjectByPath: vi.fn(() => ({ id: 'proj-1' })),
        getActiveProject: vi.fn(() => ({ id: 'proj-1' }))
      } as any,
      snapshotManager: {
        beginRun: vi.fn(),
        endRun: vi.fn(),
        capture: vi.fn()
      } as any,
      authManager: {
        getApiKey: vi.fn(),
      } as any,
      lspManager: {
        stop: vi.fn(),
        start: vi.fn(),
        workspaceCheck: vi.fn().mockResolvedValue({ errorCount: 0, diagnostics: [] }),
      } as any,
      worktreeManager: {
        stop: vi.fn(),
        setRepoRoot: vi.fn(),
        isPollingStopped: true,
      } as any,
      storiesManager: {
        setProjectRoot: vi.fn(),
      } as any,
    } as EngineServices

    engine = new WorkflowEngine()
    engine.setServices(mockServices as EngineServices)
  })

  describe('Core Execution', () => {
    it('executes a simple linear workflow and updates context', async () => {
      const graph: WorkflowGraph = {
        id: 'wf1',
        name: 'wf1',
        nodes: [
          { id: '1', type: 'trigger', label: 'T', x: 0, y: 0, data: { variant: 'manual' } },
          { id: '2', type: 'tool', label: 'L', x: 0, y: 0, data: { variant: 'log-event', message: 'Hello' } },
        ],
        edges: [{ id: 'e1', source: '1', target: '2' }],
      }

      await engine.runGraph(graph)
      expect(engine.getState()).toBe('COMPLETE')
      expect(engine.getContext()['2']).toBe('logged:Hello')
    })

    it('handles decision branches correctly', async () => {
      const graph: WorkflowGraph = {
        id: 'wf2',
        name: 'wf2',
        nodes: [
          { id: '1', type: 'tool', label: 'T', x: 0, y: 0, data: { variant: 'log-event', message: 'match' } },
          { id: '2', type: 'decision', label: 'D', x: 0, y: 0, data: { variant: 'output-match', pattern: 'match' } },
          { id: '3', type: 'tool', label: 'Yes', x: 0, y: 0, data: { variant: 'log-event', message: 'Yes' } },
          { id: '4', type: 'tool', label: 'No', x: 0, y: 0, data: { variant: 'log-event', message: 'No' } },
        ],
        edges: [
          { id: 'e1', source: '1', target: '2' },
          { id: 'e2', source: '2', target: '3', label: 'Yes' },
          { id: 'e3', source: '2', target: '4', label: 'No' },
        ],
      }

      await engine.runGraph(graph)
      expect(engine.getNodeStatuses()['3']).toBe('completed')
      expect(engine.getNodeStatuses()['4']).toBe('skipped')
    })

    it('pauses workflow on verification failure', async () => {
      const graph: WorkflowGraph = {
        id: 'wf3',
        name: 'wf3',
        nodes: [
          { id: '1', type: 'trigger', label: 'T', x: 0, y: 0, data: { variant: 'manual' } },
          { id: '2', type: 'verification', label: 'V', x: 0, y: 0, data: { variant: 'verification', checklist: ['AC1'] } },
        ],
        edges: [{ id: 'e1', source: '1', target: '2' }],
      }

      await expect(engine.runGraph(graph)).rejects.toThrow(/Verification failed/)
      expect(engine.getState()).toBe('PAUSED')
    })
  })

  describe('Agent Dispatch', () => {
    it('throws error if services are not injected', async () => {
      const localEngine = new WorkflowEngine()
      const node = { id: 'a1', type: 'agent', label: 'A1', data: { provider: 'anthropic', modelId: 'claude-3' } } as any
      await expect(localEngine.executeNode(node)).rejects.toThrow('ENGINE_SERVICES_NOT_INJECTED')
    })

    it('verifies auth check before agent dispatch', async () => {
      ;(mockServices.authManager.getApiKey as any).mockReturnValue(null)
      const node = { id: 'a1', type: 'agent', label: 'A1', data: { provider: 'anthropic', modelId: 'claude-3' } } as any
      await expect(engine.executeNode(node)).rejects.toThrow('AUTH_MISSING:anthropic')
    })
  })

  describe('Tool Dispatch', () => {
    it('executes file-read tool', async () => {
      ;(mockServices.fsManager.readFile as any).mockReturnValue('file content')
      const node = { id: 't1', type: 'tool', label: 'Read', data: { variant: 'file-read', filePath: 'test.txt' } } as any
      await engine.executeNode(node)
      expect(engine.getContext()['t1']).toBe('file content')
    })

    it('executes file-write tool', async () => {
      const node = { id: 't1', type: 'tool', label: 'Write', data: { variant: 'file-write', filePath: 'test.txt', content: 'hello' } } as any
      await engine.executeNode(node)
      expect(mockServices.fsManager.writeFile).toHaveBeenCalledWith('test.txt', 'hello')
      expect(engine.getContext()['t1']).toBe('written:test.txt')
    })
  })
})
