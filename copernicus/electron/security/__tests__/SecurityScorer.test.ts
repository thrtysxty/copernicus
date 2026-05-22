import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import type { PatternDetector } from '../pattern-detector';

// Mock the lsp-manager import that SecurityScorer uses
vi.mock('../../lsp/lsp-manager', () => ({
  lspManager: {
    diagnosticsCache: new Map(),
  },
}))

// Mock child_process with both named and default exports
vi.mock('child_process', () => {
  const mockSpawn = vi.fn()
  const all = { spawn: mockSpawn, exec: vi.fn(), execFile: vi.fn(), execSync: vi.fn(), fork: vi.fn() }
  return { ...all, default: all }
})

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Don't mock PatternDetector — create real EventEmitter instances for detector
// The SecurityScorer only needs detector.on('alert') and detector.detect()
vi.mock('../pattern-detector', () => ({
  PatternDetector: vi.fn(),
}))

vi.mock('fs', () => {
  const all = {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    appendFile: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  }
  return { ...all, default: all }
})

vi.mock('os', () => ({
  homedir: vi.fn(() => '/home/user'),
}))

describe('SecurityScorer', () => {
  let detector: EventEmitter & { detect: ReturnType<typeof vi.fn> }
  let scorer: any
  let mockSpawn: any

  beforeEach(async () => {
    vi.clearAllMocks()

    const { SecurityScorer } = await import('../SecurityScorer')

    // Create a real EventEmitter as the detector
    detector = Object.assign(new EventEmitter(), { detect: vi.fn() })
    scorer = new SecurityScorer(detector as unknown as PatternDetector, '/test/project')
    mockSpawn = (await import('child_process')).spawn

    // Reset lspManager diagnostics
    const { lspManager } = await import('../../lsp/lsp-manager')
    ;(lspManager.diagnosticsCache as any) = new Map()

    // Reset scorer internal state
    scorer.cachedSentinelHits = 0
    scorer.cachedNpmAuditIssues = 0
    scorer.lastAuditTime = 0
    scorer.auditInProgress = false

    // Default spawn mock for npm audit (returns empty result)
    mockSpawn.mockReturnValue({
      stdout: { on: vi.fn() },
      on: vi.fn((event: string, cb: any) => { if (event === 'close') cb() }),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes with zero counts', async () => {
    const score = await scorer.computeScore()
    expect(score.lspErrors).toBe(0)
    expect(score.sentinelHits).toBe(0)
    expect(score.npmAuditIssues).toBe(0)
    expect(score.grade).toBe('A')
  })

  it('increments sentinel hits on alert event', async () => {
    detector.emit('alert', { patternId: 'test', severity: 'HIGH' })
    detector.emit('alert', { patternId: 'test', severity: 'HIGH' })

    const score = await scorer.computeScore()
    expect(score.sentinelHits).toBe(2)
  })

  it('calculates grade B with minor issues', async () => {
    const { lspManager } = await import('../../lsp/lsp-manager')
    ;(lspManager.diagnosticsCache as any) = new Map([
      ['file1.ts', [{ severity: 1 }]],
      ['file2.ts', [{ severity: 1 }]],
    ])

    detector.emit('alert', { patternId: 'test', severity: 'HIGH' })

    mockSpawn.mockReturnValue({
      stdout: { on: vi.fn((_: any, cb: any) => cb(JSON.stringify({ metadata: { vulnerabilities: { critical: 0, high: 1 } } }))) },
      on: vi.fn((event: string, cb: any) => { if (event === 'close') cb() }),
    })

    const score = await scorer.computeScore()
    expect(score.lspErrors).toBe(2)
    expect(score.npmAuditIssues).toBe(1)
    expect(score.grade).toBe('B')
  })

  it('calculates grade F with many issues', async () => {
    const { lspManager } = await import('../../lsp/lsp-manager')
    const diagnostics = Array(20).fill({ severity: 1 })
    ;(lspManager.diagnosticsCache as any) = new Map([['file.ts', diagnostics]])

    for (let i = 0; i < 5; i++) {
      detector.emit('alert', { patternId: 'test', severity: 'HIGH' })
    }

    mockSpawn.mockReturnValue({
      stdout: { on: vi.fn((_: any, cb: any) => cb(JSON.stringify({ metadata: { vulnerabilities: { critical: 5, high: 5 } } }))) },
      on: vi.fn((event: string, cb: any) => { if (event === 'close') cb() }),
    })

    const score = await scorer.computeScore()
    expect(score.grade).toBe('F')
  })

  it('throttles npm audit to once per 5 minutes', async () => {
    mockSpawn.mockReturnValue({
      stdout: { on: vi.fn((_: any, cb: any) => cb(JSON.stringify({ metadata: { vulnerabilities: { critical: 1, high: 0 } } }))) },
      on: vi.fn((event: string, cb: any) => { if (event === 'close') cb() }),
    })

    await scorer.computeScore()
    const firstCallCount = mockSpawn.mock.calls.length

    await scorer.computeScore()
    expect(mockSpawn.mock.calls.length).toBe(firstCallCount)
  })

  it('handles npm audit JSON parse errors gracefully', async () => {
    mockSpawn.mockReturnValue({
      stdout: { on: vi.fn((_: any, cb: any) => cb('invalid json')) },
      on: vi.fn((event: string, cb: any) => { if (event === 'close') cb() }),
    })

    const score = await scorer.computeScore()
    expect(score.npmAuditIssues).toBe(0)
  })

  it('handles npm audit spawn errors gracefully', async () => {
    mockSpawn.mockReturnValue({
      stdout: { on: vi.fn() },
      on: vi.fn((event: string, cb: any) => { if (event === 'error') cb(new Error('spawn failed')) }),
    })

    const score = await scorer.computeScore()
    expect(score.npmAuditIssues).toBe(0)
  })

  it('returns grade D for moderate issues', async () => {
    const { lspManager } = await import('../../lsp/lsp-manager')
    ;(lspManager.diagnosticsCache as any) = new Map([
      ['file1.ts', Array(6).fill({ severity: 1 })],
    ])

    for (let i = 0; i < 2; i++) {
      detector.emit('alert', { patternId: 'test', severity: 'HIGH' })
    }

    mockSpawn.mockReturnValue({
      stdout: { on: vi.fn((_: any, cb: any) => cb(JSON.stringify({ metadata: { vulnerabilities: { critical: 1, high: 2 } } }))) },
      on: vi.fn((event: string, cb: any) => { if (event === 'close') cb() }),
    })

    const score = await scorer.computeScore()
    expect(score.grade).toBe('D')
  })
})
