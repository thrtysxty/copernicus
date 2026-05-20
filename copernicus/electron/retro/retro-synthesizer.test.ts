import { expect, test, describe, beforeEach, afterEach, vi } from 'vitest'
import { retroSynthesizer } from './retro-synthesizer'
import { stateLedger } from '../db/state-ledger'
import { fsManager } from '../fs-manager'
import fs from 'fs'
import path from 'path'
import os from 'os'

// Mock electron (BrowserWindow.getAllWindows used at end of synthesize)
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn().mockReturnValue([]),
  }
}))

// Mock dependencies
vi.mock('../db/state-ledger', () => ({
  stateLedger: {
    db: {
      prepare: vi.fn().mockReturnValue({
        all: vi.fn().mockReturnValue([]),
        run: vi.fn(),
        get: vi.fn()
      }),
      transaction: vi.fn((fn) => fn),
    },
    getAgentMemoryTimeRange: vi.fn().mockReturnValue([]),
    getAgentWorkLogTimeRange: vi.fn().mockReturnValue([]),
    createRetroReport: vi.fn().mockReturnValue('mock-retro-id'),
    pushRetroReady: vi.fn(),
  }
}))

vi.mock('../fs-manager', () => ({
  fsManager: {
    getRootPath: vi.fn().mockReturnValue('/tmp/mock-project')
  }
}))

vi.mock('../models/model-registry', () => ({
  modelRegistry: {
    getModels: vi.fn().mockReturnValue([
      { id: 'deepseek-v3.2:cloud', provider: 'anthropic' }
    ]),
    getActiveModel: vi.fn().mockReturnValue({ id: 'deepseek-v3.2:cloud', provider: 'anthropic' }),
  }
}))

vi.mock('../auth-manager', () => ({
  authManager: {
    getApiKey: vi.fn().mockReturnValue('mock-key'),
    getBaseUrl: vi.fn().mockReturnValue(''),
    resolveOpenAICompatibleKey: vi.fn().mockReturnValue(null),
  }
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('RetroSynthesizer', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-test-'))
    vi.mocked(fsManager.getRootPath).mockReturnValue(tmpDir)

    // Reset mocks
    vi.clearAllMocks()
    
    // Setup db.prepare mock default to empty
    const mockDbAll = vi.fn().mockReturnValue([])
    vi.mocked(stateLedger.db.prepare).mockReturnValue({ all: mockDbAll, run: vi.fn(), get: vi.fn(), reader: false, source: '', expanded: false, bind: vi.fn(), pluck: vi.fn(), expand: vi.fn(), raw: vi.fn(), columns: vi.fn(), iterate: vi.fn(), safeIntegers: vi.fn() } as any)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('Phase 1: .claude/retros/ files included in synthesis prompt', async () => {
    // Setup 3 memory rows
    const memoryRows = [
      { id: 'm1', content: 'learned X', importance: 3, ts: 100 },
      { id: 'm2', content: 'learned Y', importance: 4, ts: 101 },
      { id: 'm3', content: 'learned Z', importance: 5, ts: 102 },
    ]
    
    // Configure mock to return these memory rows via getAgentMemoryTimeRange, and empty work log
    vi.mocked(stateLedger.getAgentMemoryTimeRange).mockReturnValue(memoryRows as any)
    vi.mocked(stateLedger.getAgentWorkLogTimeRange).mockReturnValue([] as any)

    // Setup 1 prior retro
    const retrosPath = path.join(tmpDir, '.claude', 'retros')
    fs.mkdirSync(retrosPath, { recursive: true })
    fs.writeFileSync(path.join(retrosPath, 'retro_2023.md'), 'Prior Retro Content 2023')

    // Mock LLM response
    const mockStream = {
      getReader: vi.fn().mockReturnValue({
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"token": "{"}\n\n') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"token": "\\"memory_facts\\": []}"}\n\n') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: [DONE]\n\n') })
          .mockResolvedValueOnce({ done: true, value: undefined })
      })
    }
    mockFetch.mockResolvedValueOnce({ ok: true, body: mockStream } as any)

    const retroId = await retroSynthesizer.synthesize({
      projectId: 'proj1',
      scope: 'project',
      fromTs: 0,
      toTs: 200
    })

    expect(retroId).toBe('mock-retro-id')
    expect(stateLedger.createRetroReport).toHaveBeenCalledTimes(1)
    expect(stateLedger.pushRetroReady).toHaveBeenCalledWith('mock-retro-id')
    
    // Check that prompt included prior retro text
    const fetchCall = mockFetch.mock.calls[0][1]
    const body = JSON.parse(fetchCall.body)
    expect(body.messages[0].content).toContain('Prior Retro Content 2023')
    expect(body.messages[0].content).toContain('learned X')
    expect(body.messages[0].content).toContain('learned Y')
    expect(body.messages[0].content).toContain('learned Z')
  })

  test('Phase 2: parse error on first attempt -> retries once', async () => {
    const mockDbAll = vi.fn().mockReturnValue([])
    vi.mocked(stateLedger.db.prepare).mockReturnValue({ all: mockDbAll, run: vi.fn(), get: vi.fn(), reader: false, source: '', expanded: false, bind: vi.fn(), pluck: vi.fn(), expand: vi.fn(), raw: vi.fn(), columns: vi.fn(), iterate: vi.fn(), safeIntegers: vi.fn() } as any)

    // First LLM response: Invalid JSON
    const mockStream1 = {
      getReader: vi.fn().mockReturnValue({
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"token": "Not a JSON"}\n\n') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: [DONE]\n\n') })
          .mockResolvedValueOnce({ done: true, value: undefined })
      })
    }
    
    // Second LLM response: Valid JSON
    const mockStream2 = {
      getReader: vi.fn().mockReturnValue({
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"token": "{"}\n\n') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"token": "\\"memory_facts\\": []}"}\n\n') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: [DONE]\n\n') })
          .mockResolvedValueOnce({ done: true, value: undefined })
      })
    }

    mockFetch.mockResolvedValueOnce({ ok: true, body: mockStream1 } as any)
    mockFetch.mockResolvedValueOnce({ ok: true, body: mockStream2 } as any)

    await retroSynthesizer.synthesize({
      projectId: 'proj1',
      scope: 'project',
      fromTs: 0,
      toTs: 200
    })

    expect(mockFetch).toHaveBeenCalledTimes(2)
    const retryCall = mockFetch.mock.calls[1][1]
    const retryBody = JSON.parse(retryCall.body)
    expect(retryBody.messages[0].content).toContain('YOUR PREVIOUS RESPONSE FAILED TO PARSE AS JSON')
  })

  test('synthesize() creates report with status pending_review and fires retro:ready', async () => {
    const mockDbAll = vi.fn().mockReturnValue([])
    vi.mocked(stateLedger.db.prepare).mockReturnValue({ all: mockDbAll, run: vi.fn(), get: vi.fn(), reader: false, source: '', expanded: false, bind: vi.fn(), pluck: vi.fn(), expand: vi.fn(), raw: vi.fn(), columns: vi.fn(), iterate: vi.fn(), safeIntegers: vi.fn() } as any)

    const mockStream = {
      getReader: vi.fn().mockReturnValue({
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"token": "{"}\n\n') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"token": "\\"memory_facts\\": []}"}\n\n') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: [DONE]\n\n') })
          .mockResolvedValueOnce({ done: true, value: undefined })
      })
    }
    mockFetch.mockResolvedValueOnce({ ok: true, body: mockStream } as any)

    await retroSynthesizer.synthesize({
      projectId: 'proj1',
      scope: 'project',
      fromTs: 0,
      toTs: 200
    })

    expect(stateLedger.createRetroReport).toHaveBeenCalledWith(expect.objectContaining({
      status: 'pending_review'
    }))
    expect(stateLedger.pushRetroReady).toHaveBeenCalledWith('mock-retro-id')
  })
})
