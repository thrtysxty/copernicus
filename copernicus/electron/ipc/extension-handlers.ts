import { ipcMain } from 'electron'
import { handleIpc } from '../utils/handle-ipc'
import { ExtensionRegistry } from '../extensions/ExtensionRegistry'
import { ExtensionLoader } from '../extensions/ExtensionLoader'
import { getExtensionHostManager } from '../main'

export function registerExtensionHandlers(registry: ExtensionRegistry, loader: ExtensionLoader): () => void {
  ipcMain.handle('extensions:list',          () => handleIpc(() => registry.getExtensions()))
  ipcMain.handle('extensions:workflow-nodes', () => handleIpc(() => registry.getWorkflowNodes()))
  ipcMain.handle('extensions:tiles',         () => handleIpc(() => registry.getTiles()))
  ipcMain.handle('extensions:providers',     () => handleIpc(() => registry.getProviders()))
  ipcMain.handle('extensions:reload',        () => handleIpc(async () => {
    registry.clear()
    await loader.loadAll()
    return registry.getExtensions()
  }))

  ipcMain.handle('extension:fire-event', (_event, msg: { event: string }) => handleIpc(async () => {
    const hostManager = getExtensionHostManager()
    if (hostManager) {
      await hostManager.activationBus.fire(msg.event)
    }
    return { ok: true }
  }))

  ipcMain.handle('extension:request-approval', (_event, result: { id: string; approved: boolean }) => handleIpc(() => {
    const hostManager = getExtensionHostManager()
    if (hostManager) {
      hostManager.resolveApproval(result.id, result.approved)
    }
    return { ok: true }
  }))

  return () => {
    ;[
      'extensions:list',
      'extensions:workflow-nodes',
      'extensions:tiles',
      'extensions:providers',
      'extensions:reload',
      'extension:request-approval',
    ].forEach(channel => ipcMain.removeHandler(channel))
  }
}
