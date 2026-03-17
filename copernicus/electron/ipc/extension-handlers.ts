import { ipcMain } from 'electron'
import { handleIpc } from '../utils/handle-ipc'
import { ExtensionRegistry } from '../extensions/ExtensionRegistry'
import { ExtensionLoader } from '../extensions/ExtensionLoader'

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

  return () => {
    ;[
      'extensions:list',
      'extensions:workflow-nodes',
      'extensions:tiles',
      'extensions:providers',
      'extensions:reload',
    ].forEach(channel => ipcMain.removeHandler(channel))
  }
}
