import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ipcMain } from 'electron'
import { registerProjectHandlers } from './project-handlers'
import { stateLedger } from '../db/state-ledger'
import { settingsStore } from '../main'

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

vi.mock('../db/state-ledger', () => ({
  stateLedger: {
    getProjectByPath: vi.fn(),
    updateProjectTargetDevice: vi.fn()
  }
}))

vi.mock('../main', () => ({
  settingsStore: {
    get: vi.fn()
  }
}))

describe('project-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers project IPC channels', () => {
    registerProjectHandlers()
    
    expect(ipcMain.handle).toHaveBeenCalledWith('project:get-config', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('project:save-config', expect.any(Function))
  })

  it('project:get-config returns AGNOSTIC when no workspace', async () => {
    registerProjectHandlers()
    const callArgs = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === 'project:get-config')
    expect(callArgs).toBeDefined()

    const handlerFn = callArgs![1] as Function
    vi.mocked(settingsStore.get).mockReturnValue(null)

    const result = await handlerFn({} as any)
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ target_device: 'AGNOSTIC' })
  })

  it('project:get-config returns AGNOSTIC when project not found', async () => {
    registerProjectHandlers()
    const callArgs = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === 'project:get-config')
    expect(callArgs).toBeDefined()

    const handlerFn = callArgs![1] as Function
    vi.mocked(settingsStore.get).mockReturnValue('/path/to/workspace')
    vi.mocked(stateLedger.getProjectByPath).mockReturnValue(null)

    const result = await handlerFn({} as any)
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ target_device: 'AGNOSTIC' })
  })

  it('project:get-config returns project target_device', async () => {
    registerProjectHandlers()
    const callArgs = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === 'project:get-config')
    expect(callArgs).toBeDefined()

    const handlerFn = callArgs![1] as Function
    vi.mocked(settingsStore.get).mockReturnValue('/path/to/workspace')
    vi.mocked(stateLedger.getProjectByPath).mockReturnValue({ 
      id: 'proj-1', 
      path: '/path/to/workspace', 
      billing_mode: 'CAPEX', 
      target_device: 'MOBILE' 
    })

    const result = await handlerFn({} as any)
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ target_device: 'MOBILE' })
  })

  it('project:get-config returns AGNOSTIC when target_device is null', async () => {
    registerProjectHandlers()
    const callArgs = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === 'project:get-config')
    expect(callArgs).toBeDefined()

    const handlerFn = callArgs![1] as Function
    vi.mocked(settingsStore.get).mockReturnValue('/path/to/workspace')
    vi.mocked(stateLedger.getProjectByPath).mockReturnValue({ 
      id: 'proj-1', 
      path: '/path/to/workspace', 
      billing_mode: 'CAPEX', 
      target_device: undefined 
    })

    const result = await handlerFn({} as any)
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ target_device: 'AGNOSTIC' })
  })

  it('project:save-config rejects invalid target_device', async () => {
    registerProjectHandlers()
    const callArgs = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === 'project:save-config')
    expect(callArgs).toBeDefined()

    const handlerFn = callArgs![1] as Function
    vi.mocked(settingsStore.get).mockReturnValue('/path/to/workspace')

    const result = await handlerFn({} as any, { target_device: 'INVALID' })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/Invalid target_device/)
  })

  it('project:save-config throws when no workspace', async () => {
    registerProjectHandlers()
    const callArgs = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === 'project:save-config')
    expect(callArgs).toBeDefined()

    const handlerFn = callArgs![1] as Function
    vi.mocked(settingsStore.get).mockReturnValue(null)

    const result = await handlerFn({} as any, { target_device: 'MOBILE' })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('No active workspace to update')
  })

  it('project:save-config updates project target_device successfully', async () => {
    registerProjectHandlers()
    const callArgs = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === 'project:save-config')
    expect(callArgs).toBeDefined()

    const handlerFn = callArgs![1] as Function
    vi.mocked(settingsStore.get).mockReturnValue('/path/to/workspace')
    vi.mocked(stateLedger.updateProjectTargetDevice).mockReturnValue(undefined)

    const result = await handlerFn({} as any, { target_device: 'DESKTOP' })
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ success: true })
    expect(stateLedger.updateProjectTargetDevice).toHaveBeenCalledWith('/path/to/workspace', 'DESKTOP')
  })

  it('project:save-config accepts all valid target_device values', async () => {
    registerProjectHandlers()
    const callArgs = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === 'project:save-config')
    expect(callArgs).toBeDefined()

    const handlerFn = callArgs![1] as Function
    vi.mocked(settingsStore.get).mockReturnValue('/path/to/workspace')
    vi.mocked(stateLedger.updateProjectTargetDevice).mockReturnValue(undefined)

    const validDevices = ['MOBILE', 'DESKTOP', 'TABLET', 'AGNOSTIC']
    
    for (const device of validDevices) {
      vi.clearAllMocks()
      vi.mocked(settingsStore.get).mockReturnValue('/path/to/workspace')
      
      const result = await handlerFn({} as any, { target_device: device })
      expect(result.ok).toBe(true)
      expect(result.data).toEqual({ success: true })
    }
  })
})
