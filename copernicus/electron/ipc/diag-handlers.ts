import { ipcMain, BrowserWindow } from 'electron'
import { handleIpc } from '../utils/handle-ipc'
import { IpcHandlerDeps } from './deps'
import { DiagnosticsRunner, DiagnosticsIssue } from '../debug/DiagnosticsRunner'

let cachedDiagnostics: DiagnosticsIssue[] = []

export async function runDiagnosticsOnFile(filePath: string, rootPath: string) {
  const runner = new DiagnosticsRunner(rootPath)
  const results = await runner.run(filePath)
  
  if (results.length > 0 || filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js') || filePath.endsWith('.jsx') || filePath.endsWith('.py')) {
    // Update cache
    cachedDiagnostics = cachedDiagnostics.filter(d => d.file !== filePath || (d.source !== 'ESLint' && d.source !== 'Ruff'))
    cachedDiagnostics.push(...results)
    
    BrowserWindow.getAllWindows()[0]?.webContents.send('diag:results', cachedDiagnostics)
  }
}

export function register(_win: BrowserWindow, deps: IpcHandlerDeps) {
  const getCwd = () => deps.settingsStore.get<string>('workspace', process.cwd())

  ipcMain.handle('diag:run', (_e, file: string) => handleIpc(() => {
    const runner = new DiagnosticsRunner(getCwd())
    return runner.run(file)
  }))

  ipcMain.handle('diag:run-eslint', (_e, targetPath?: string) => handleIpc(() => {
    const runner = new DiagnosticsRunner(getCwd())
    return runner.runEslint(targetPath)
  }))

  ipcMain.handle('diag:run-ruff', (_e, targetPath?: string) => handleIpc(() => {
    const runner = new DiagnosticsRunner(getCwd())
    return runner.runRuff(targetPath)
  }))

  ipcMain.handle('diag:run-audit', (_e, type: 'npm' | 'pip') => handleIpc(() => {
    const runner = new DiagnosticsRunner(getCwd())
    return runner.runAudit(type)
  }))

  ipcMain.handle('diag:get-all', () => handleIpc(() => {
    return cachedDiagnostics
  }))
}
