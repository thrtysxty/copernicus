import { ipcMain } from 'electron'
import { handleIpc } from '../utils/handle-ipc'
import { ReplayEngine } from '../debug/ReplayEngine'
import { stateLedger } from '../db/state-ledger'

const replayEngine = new ReplayEngine(stateLedger.db)

export function registerReplayHandlers() {
  ipcMain.handle('replay:list-runs', (_e, limit: number) =>
    handleIpc(() => replayEngine.listRuns(limit)))
  ipcMain.handle('replay:get-steps', (_e, run_id: string) =>
    handleIpc(() => replayEngine.getSteps(run_id)))
  ipcMain.handle('replay:get-step-detail', (_e, id: number) =>
    handleIpc(() => replayEngine.getStepDetail(id)))
}
