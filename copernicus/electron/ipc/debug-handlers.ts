import { ipcMain } from 'electron'
import { handleIpc } from '../utils/handle-ipc'
import { dapClient } from '../debug/DapClient'

export function registerDebugHandlers(): () => void {
  ipcMain.handle('debug:launch', (_e, config) =>
    handleIpc(() => dapClient.launch(config))
  )

  ipcMain.handle('debug:stop', () =>
    handleIpc(() => dapClient.stop())
  )

  ipcMain.handle('debug:pause', () =>
    handleIpc(() => dapClient.pause())
  )

  ipcMain.handle('debug:resume', () =>
    handleIpc(() => dapClient.resume())
  )

  ipcMain.handle('debug:step-over', () =>
    handleIpc(() => dapClient.stepOver())
  )

  ipcMain.handle('debug:step-into', () =>
    handleIpc(() => dapClient.stepInto())
  )

  ipcMain.handle('debug:step-out', () =>
    handleIpc(() => dapClient.stepOut())
  )

  ipcMain.handle('debug:set-breakpoints', (_e, { sourcePath, breakpoints }) =>
    handleIpc(() => dapClient.setBreakpoints(sourcePath, breakpoints))
  )

  ipcMain.handle('debug:get-call-stack', (_e, threadId) =>
    handleIpc(() => dapClient.getCallStack(threadId))
  )

  ipcMain.handle('debug:get-scopes', (_e, frameId) =>
    handleIpc(() => dapClient.getScopes(frameId))
  )

  ipcMain.handle('debug:get-variables', (_e, variablesReference) =>
    handleIpc(() => dapClient.getVariables(variablesReference))
  )

  ipcMain.handle('debug:evaluate', (_e, { expression, frameId, context }) =>
    handleIpc(() => dapClient.evaluate(expression, frameId, context))
  )

  return () => {
    ipcMain.removeHandler('debug:launch')
    ipcMain.removeHandler('debug:stop')
    ipcMain.removeHandler('debug:pause')
    ipcMain.removeHandler('debug:resume')
    ipcMain.removeHandler('debug:step-over')
    ipcMain.removeHandler('debug:step-into')
    ipcMain.removeHandler('debug:step-out')
    ipcMain.removeHandler('debug:set-breakpoints')
    ipcMain.removeHandler('debug:get-call-stack')
    ipcMain.removeHandler('debug:get-scopes')
    ipcMain.removeHandler('debug:get-variables')
    ipcMain.removeHandler('debug:evaluate')
  }
}
