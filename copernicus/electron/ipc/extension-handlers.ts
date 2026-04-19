import { ipcMain } from 'electron'
import { handleIpc } from '../utils/handle-ipc'
import { ExtensionRegistry } from '../extensions/ExtensionRegistry'
import { ExtensionLoader } from '../extensions/ExtensionLoader'
import { ExtensionInstaller } from '../extensions/ExtensionInstaller'
import { getExtensionHostManager } from '../main'
import log from 'electron-log'

export function registerExtensionHandlers(registry: ExtensionRegistry, loader: ExtensionLoader): () => void {
  const installer = new ExtensionInstaller()

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

  ipcMain.handle('extension:list', () => handleIpc(() => {
    return { installed: registry.getExtensions() }
  }))

  ipcMain.handle('extension:search', (_event, query: string) => handleIpc(async () => {
    return installer.search(query)
  }))

  ipcMain.handle('extension:install', (_event, packageName: string) => handleIpc(async () => {
    try {
      const { path, manifest } = await installer.install(packageName)
      const copernicusManifest = manifest.copernicus || {}

      const hostManager = getExtensionHostManager()
      if (hostManager) {
        await hostManager.activateExtension(
          packageName,
          copernicusManifest.displayName || packageName,
          copernicusManifest.capabilities,
          path,
          true
        )
      }

      registry.clear()
      await loader.loadAll()
      return { installed: registry.getExtensions() }
    } catch (e: any) {
      log.error(`Failed to install extension ${packageName}:`, e)
      try {
        await installer.uninstall(packageName)
      } catch (uninstErr) {
        log.error(`Failed to rollback installation of ${packageName}:`, uninstErr)
      }
      throw e
    }
  }))

  ipcMain.handle('extension:uninstall', (_event, packageName: string) => handleIpc(async () => {
    const hostManager = getExtensionHostManager()
    if (hostManager) {
      hostManager.activationBus.fire(`onUninstall:${packageName}`)
    }

    await installer.uninstall(packageName)

    registry.clear()
    await loader.loadAll()
    return { installed: registry.getExtensions() }
  }))

  return () => {
    ;[
      'extensions:list',
      'extensions:workflow-nodes',
      'extensions:tiles',
      'extensions:providers',
      'extensions:reload',
      'extension:request-approval',
      'extension:list',
      'extension:search',
      'extension:install',
      'extension:uninstall'
    ].forEach(channel => ipcMain.removeHandler(channel))
  }
}
