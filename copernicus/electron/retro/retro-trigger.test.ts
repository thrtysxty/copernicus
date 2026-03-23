import { expect, test, describe, beforeEach, vi } from 'vitest'
import { retroTrigger } from './retro-trigger'
import { stateLedger } from '../db/state-ledger'
import { retroSynthesizer } from './retro-synthesizer'

vi.mock('../db/state-ledger', () => ({
  stateLedger: {
    listRetroReports: vi.fn(),
    getAllAgentMemoryForProject: vi.fn(),
  }
}))

vi.mock('./retro-synthesizer', () => ({
  retroSynthesizer: {
    synthesize: vi.fn().mockResolvedValue('mock-retro-id'),
  }
}))

vi.mock('../settings-store', () => {
  return {
    SettingsStore: vi.fn().mockImplementation(() => ({
      get: vi.fn().mockReturnValue({ sessionThreshold: 20 })
    }))
  }
})

describe('RetroTrigger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('checkAndTrigger triggers when count >= threshold', async () => {
    vi.mocked(stateLedger.listRetroReports).mockReturnValue([])
    const memoryRows = Array(20).fill({ event_type: 'session_start', ts: 100 })
    vi.mocked(stateLedger.getAllAgentMemoryForProject).mockReturnValue(memoryRows)

    await retroTrigger.checkAndTrigger('proj1')

    expect(retroSynthesizer.synthesize).toHaveBeenCalledWith({
      projectId: 'proj1',
      scope: 'project',
      fromTs: 0,
      toTs: expect.any(Number)
    })
  })

  test('checkAndTrigger does not trigger when count < threshold', async () => {
    vi.mocked(stateLedger.listRetroReports).mockReturnValue([])
    const memoryRows = Array(19).fill({ event_type: 'session_start', ts: 100 })
    vi.mocked(stateLedger.getAllAgentMemoryForProject).mockReturnValue(memoryRows)

    await retroTrigger.checkAndTrigger('proj1')

    expect(retroSynthesizer.synthesize).not.toHaveBeenCalled()
  })

  test('checkAndTrigger does not trigger if pending_review retro exists', async () => {
    vi.mocked(stateLedger.listRetroReports).mockReturnValue([{ status: 'pending_review' }])
    const memoryRows = Array(20).fill({ event_type: 'session_start', ts: 100 })
    vi.mocked(stateLedger.getAllAgentMemoryForProject).mockReturnValue(memoryRows)

    await retroTrigger.checkAndTrigger('proj1')

    expect(retroSynthesizer.synthesize).not.toHaveBeenCalled()
  })

  test('triggerManual forces trigger and returns retroId', async () => {
    vi.mocked(stateLedger.listRetroReports).mockReturnValue([])
    const id = await retroTrigger.triggerManual('proj1')

    expect(id).toBe('mock-retro-id')
    expect(retroSynthesizer.synthesize).toHaveBeenCalledWith({
      projectId: 'proj1',
      scope: 'project',
      fromTs: 0,
      toTs: expect.any(Number)
    })
  })
})
