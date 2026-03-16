import { ipcMain, BrowserWindow, app } from 'electron'
import { handleIpc } from '../utils/handle-ipc'
import { LogTailer } from '../debug/LogTailer'

let tailer: LogTailer | null = null

export function registerLogHandlers(win: BrowserWindow) {
  if (!tailer) {
    tailer = new LogTailer(app.getPath('logs'))
    tailer.startTailing((entry) => {
      if (!win.isDestroyed()) {
        win.webContents.send('log:line', entry)
      }
    })
  }

  ipcMain.handle('log:list-sources', () => handleIpc(() => tailer!.listSources()))
  ipcMain.handle('log:get-history', (_e, limit: number) => handleIpc(() => tailer!.getHistory(limit)))
}
