import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ipcMain } from 'electron'
import { registerMemoryHandlers } from './memory-handlers'
import { memoryService } from '../memory/memoryService'

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

vi.mock('../memory/memoryService', () => ({
  memoryService: {
    addMemory: vi.fn(),
    getWorkingSet: vi.fn(),
    supersede: vi.fn(),
    logWork: vi.fn(),
    getWorkLog: vi.fn()
  }
}))

describe('memory-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers all memory IPC channels', () => {
    registerMemoryHandlers()
    
    expect(ipcMain.handle).toHaveBeenCalledWith('memory:add', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('memory:get-working-set', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('memory:supersede', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('memory:log-work', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('memory:get-work-log', expect.any(Function))
  })

  it('memory:add calls memoryService.addMemory with params', async () => {
    registerMemoryHandlers()
    const callArgs = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === 'memory:add')
    expect(callArgs).toBeDefined()

    const handlerFn = callArgs![1] as Function
    const mockParams = { projectId: 'proj-1', content: 'Test memory', bankId: 'bank-1' }
    vi.mocked(memoryService.addMemory).mockResolvedValue({ id: 'mem-1' })

    const result = await handlerFn({} as any, mockParams)
    expect(result.ok).toBe(true)
    expect(memoryService.addMemory).toHaveBeenCalledWith(mockParams)
    expect(result.data).toEqual({ id: 'mem-1' })
  })

  it('memory:get-working-set calls memoryService.getWorkingSet', async () => {
    registerMemoryHandlers()
    const callArgs = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === 'memory:get-working-set')
    expect(callArgs).toBeDefined()

    const handlerFn = callArgs![1] as Function
    const mockSet = [{ id: 'mem-1', content: 'Memory 1' }]
    vi.mocked(memoryService.getWorkingSet).mockResolvedValue(mockSet)

    const result = await handlerFn({} as any, 'proj-1', 'bank-1', 10)
    expect(result.ok).toBe(true)
    expect(memoryService.getWorkingSet).toHaveBeenCalledWith('proj-1', 'bank-1', 10)
    expect(result.data).toEqual(mockSet)
  })

  it('memory:get-working-set works without limit parameter', async () => {
    registerMemoryHandlers()
    const callArgs = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === 'memory:get-working-set')
    expect(callArgs).toBeDefined()

    const handlerFn = callArgs![1] as Function
    vi.mocked(memoryService.getWorkingSet).mockResolvedValue([])

    await handlerFn({} as any, 'proj-1', 'bank-1')
    expect(memoryService.getWorkingSet).toHaveBeenCalledWith('proj-1', 'bank-1', undefined)
  })

  it('memory:supersede calls memoryService.supersede', async () => {
    registerMemoryHandlers()
    const callArgs = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === 'memory:supersede')
    expect(callArgs).toBeDefined()

    const handlerFn = callArgs![1] as Function
    vi.mocked(memoryService.supersede).mockReturnValue(undefined)

    const result = await handlerFn({} as any, 'mem-old', 'mem-new')
    expect(result.ok).toBe(true)
    expect(memoryService.supersede).toHaveBeenCalledWith('mem-old', 'mem-new')
  })

  it('memory:log-work calls memoryService.logWork with params', async () => {
    registerMemoryHandlers()
    const callArgs = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === 'memory:log-work')
    expect(callArgs).toBeDefined()

    const handlerFn = callArgs![1] as Function
    const mockParams = { projectId: 'proj-1', bankId: 'bank-1', work: 'Implemented feature', duration: 30 }
    vi.mocked(memoryService.logWork).mockResolvedValue({ id: 'log-1' })

    const result = await handlerFn({} as any, mockParams)
    expect(result.ok).toBe(true)
    expect(memoryService.logWork).toHaveBeenCalledWith(mockParams)
    expect(result.data).toEqual({ id: 'log-1' })
  })

  it('memory:get-work-log calls memoryService.getWorkLog', async () => {
    registerMemoryHandlers()
    const callArgs = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === 'memory:get-work-log')
    expect(callArgs).toBeDefined()

    const handlerFn = callArgs![1] as Function
    const mockLog = [{ id: 'log-1', work: 'Fixed bug', duration: 15 }]
    vi.mocked(memoryService.getWorkLog).mockResolvedValue(mockLog)

    const result = await handlerFn({} as any, 'proj-1', 'bank-1', 20)
    expect(result.ok).toBe(true)
    expect(memoryService.getWorkLog).toHaveBeenCalledWith('proj-1', 'bank-1', 20)
    expect(result.data).toEqual(mockLog)
  })

  it('returns error when memoryService throws', async () => {
    registerMemoryHandlers()
    const callArgs = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === 'memory:add')
    expect(callArgs).toBeDefined()

    const handlerFn = callArgs![1] as Function
    vi.mocked(memoryService.addMemory).mockRejectedValue(new Error('Database connection failed'))

    const result = await handlerFn({} as any, { projectId: 'proj-1', content: 'Test', bankId: 'bank-1' })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Database connection failed')
  })
})
