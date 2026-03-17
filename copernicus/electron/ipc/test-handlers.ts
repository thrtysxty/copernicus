import { ipcMain, BrowserWindow } from 'electron'
import { handleIpc } from '../utils/handle-ipc'
import { testRunner } from '../test-runner/TestRunner'
import { FSManager } from '../fs-manager'

export function register(win: BrowserWindow, deps: { fsManager: FSManager }): () => void {
  testRunner.setWindow(win)

  ipcMain.handle('test:discover', async () => {
    return handleIpc('test:discover', [], async () => {
      testRunner.setRootPath(deps.fsManager.getRootPath())
      return await testRunner.discover()
    })
  })

  ipcMain.handle('test:run', async (_e, testId?: string, suiteId?: string) => {
    return handleIpc('test:run', [testId, suiteId], async () => {
      testRunner.setRootPath(deps.fsManager.getRootPath())
      await testRunner.run(testId, suiteId)
      return { ok: true }
    })
  })

  ipcMain.handle('test:stop', async () => {
    return handleIpc('test:stop', [], async () => {
      testRunner.stop()
      return { ok: true }
    })
  })

  ipcMain.handle('test:coverage', async () => {
    return handleIpc('test:coverage', [], async () => {
      testRunner.setRootPath(deps.fsManager.getRootPath())
      return await testRunner.runCoverage()
    })
  })

  return () => {
    ipcMain.removeHandler('test:discover')
    ipcMain.removeHandler('test:run')
    ipcMain.removeHandler('test:stop')
    ipcMain.removeHandler('test:coverage')
  }
}
