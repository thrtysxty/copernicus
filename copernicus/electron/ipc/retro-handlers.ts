import { ipcMain, BrowserWindow } from 'electron'
import { stateLedger } from '../db/state-ledger'
import { handleIpc } from '../utils/handle-ipc'
import { retroSynthesizer } from '../retro/retro-synthesizer'
import { retroTrigger } from '../retro/retro-trigger'
import { SettingsStore } from '../settings-store'
const settingsStore = new SettingsStore()

export function registerRetroHandlers() {
  ipcMain.handle('retro:gate-status', (_e, projectId: string) => handleIpc(() => {
    const sprintGateEnabled = (settingsStore.get('retro') as any)?.sprintGate ?? false
    if (!sprintGateEnabled) {
      return { blocked: false }
    }
    const reports = stateLedger.listRetroReports(projectId)
    const pendingReport = reports.find((r: any) => r.status === 'pending_review')
    if (pendingReport) {
      return { blocked: true, retroId: pendingReport.id }
    }
    return { blocked: false }
  }))

  ipcMain.handle('retro:list', (_e, projectId: string) => handleIpc(() => {
    return stateLedger.listRetroReports(projectId)
  }))

  ipcMain.handle('retro:get', (_e, id: string) => handleIpc(() => {
    return stateLedger.getRetroReport(id)
  }))

  ipcMain.handle('retro:create', (_e, data: {
    project_id: string
    scope: string
    status: string
    ts_generated: number
    ts_approved?: number
    sessions_range: string
    inflection_ids?: string
    items: {
      item_type: string
      content: string
      target?: string
      importance?: number
      supersedes_memory_id?: string
      status: string
      edited_content?: string
      ts: number
    }[]
  }) => handleIpc(() => {
    return stateLedger.createRetroReport(data)
  }))

  ipcMain.handle('retro:update-item', (_e, id: string, data: { status: string; edited_content?: string }) => handleIpc(() => {
    return stateLedger.updateRetroItem(id, data)
  }))

  ipcMain.handle('retro:commit', (_e, _id: string) => handleIpc(() => {
    // reserved stub
    return { ok: true, message: 'not yet implemented' }
  }))

  ipcMain.handle('retro:generate', (_e, data: {
    projectId: string
    scope: string
    fromTs: number
    toTs: number
  }) => handleIpc(async () => {
    const retroId = await retroSynthesizer.synthesize(data)
    return { retroId }
  }))

  ipcMain.handle('retro:push-ready', (_e, id: string) => handleIpc(() => {
    stateLedger.pushRetroReady(id)
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
        win.webContents.send('retro:ready', { reportId: id })
    }
    return true
  }))

  ipcMain.handle('retro:trigger-manual', (_e, projectId: string) => handleIpc(async () => {
    const retroId = await retroTrigger.triggerManual(projectId)
    return { retroId }
  }))
}
