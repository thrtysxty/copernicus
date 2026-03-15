import { ipcMain, BrowserWindow } from 'electron'
import { handleIpc } from '../utils/handle-ipc'
import { IpcHandlerDeps } from './deps'
import { DiagnosticsRunner, DiagnosticResult } from '../debug/DiagnosticsRunner'

let cachedDiagnostics: DiagnosticResult[] = []

export async function runDiagnosticsOnFile(filePath: string, rootPath: string) {
  const runner = new DiagnosticsRunner(rootPath)
  let results: DiagnosticResult[] = []

  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
    results = await runner.runEslint(filePath)
    cachedDiagnostics = cachedDiagnostics.filter(d => d.source !== 'ESLint' || d.file !== filePath)
    cachedDiagnostics.push(...results)
  } else if (filePath.endsWith('.py')) {
    results = await runner.runRuff(filePath)
    cachedDiagnostics = cachedDiagnostics.filter(d => d.source !== 'Ruff' || d.file !== filePath)
    cachedDiagnostics.push(...results)
  }

  BrowserWindow.getAllWindows()[0]?.webContents.send('diag:results', cachedDiagnostics)
}

export function register(_win: BrowserWindow, deps: IpcHandlerDeps) {
  const getCwd = () => deps.settingsStore.get<string>('workspace', process.cwd())

  ipcMain.handle('diag:run-eslint', (_e, targetPath?: string) => handleIpc('diag:run-eslint', [], async () => {
    const runner = new DiagnosticsRunner(getCwd())
    const results = await runner.runEslint(targetPath)
    
    // Update cache
    if (targetPath) {
      cachedDiagnostics = cachedDiagnostics.filter(d => d.source !== 'ESLint' || d.file !== targetPath)
      cachedDiagnostics.push(...results)
    } else {
      cachedDiagnostics = cachedDiagnostics.filter(d => d.source !== 'ESLint')
      cachedDiagnostics.push(...results)
    }

    BrowserWindow.getAllWindows()[0]?.webContents.send('diag:results', cachedDiagnostics)
    return results
  }))

  ipcMain.handle('diag:run-ruff', (_e, targetPath?: string) => handleIpc('diag:run-ruff', [], async () => {
    const runner = new DiagnosticsRunner(getCwd())
    const results = await runner.runRuff(targetPath)
    
    // Update cache
    if (targetPath) {
      cachedDiagnostics = cachedDiagnostics.filter(d => d.source !== 'Ruff' || d.file !== targetPath)
      cachedDiagnostics.push(...results)
    } else {
      cachedDiagnostics = cachedDiagnostics.filter(d => d.source !== 'Ruff')
      cachedDiagnostics.push(...results)
    }

    BrowserWindow.getAllWindows()[0]?.webContents.send('diag:results', cachedDiagnostics)
    return results
  }))

  ipcMain.handle('diag:run-audit', (_e, type: 'npm' | 'pip') => handleIpc('diag:run-audit', [], async () => {
    const runner = new DiagnosticsRunner(getCwd())
    const results = await runner.runAudit(type)
    
    // Update cache (for audit, clear old audit results)
    cachedDiagnostics = cachedDiagnostics.filter(d => d.source !== 'Audit')
    cachedDiagnostics.push(...results)

    BrowserWindow.getAllWindows()[0]?.webContents.send('diag:results', cachedDiagnostics)
    return results
  }))

  ipcMain.handle('diag:get-all', () => handleIpc('diag:get-all', [], () => {
    return cachedDiagnostics
  }))
}
