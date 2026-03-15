import { ipcMain, BrowserWindow } from 'electron'
import { LogTailer, LogLine } from '../debug/LogTailer'
import { handleIpc } from '../utils/handle-ipc'
import path from 'node:path'
import os from 'node:os'

let logTailer: LogTailer | null = null

export function register(win: BrowserWindow) {
  const COPERNICUS_HOME = process.env.COPERNICUS_E2E_HOME ?? path.join(os.homedir(), '.copernicus')
  const LOG_DIR = path.join(COPERNICUS_HOME, 'logs')

  if (!logTailer) {
    logTailer = new LogTailer(LOG_DIR)
    logTailer.on('line', (line: LogLine) => {
      win.webContents.send('log:new-line', line)
    })
  }

  ipcMain.handle('log:get-history', () => handleIpc('log:get-history', [], () => {
    return logTailer?.getHistory() ?? []
  }))

  ipcMain.handle('log:list-sources', () => handleIpc('log:list-sources', [], () => {
    return logTailer?.listSources() ?? []
  }))
}
