import { ipcMain } from 'electron'
import { handleIpc } from '../utils/handle-ipc'
import { providerRegistry } from '../llm/provider-registry'
import { registerBuiltinProviders } from '../llm/register-builtins'
import { loadProvidersConfig } from '../llm/config-loader'

export function registerProviderHandlers() {
  // Ensure builtin providers are registered
  registerBuiltinProviders()

  ipcMain.handle('providers:list', () => handleIpc(async () => {
    // Reload config file each time providers:list is called (Story 627)
    loadProvidersConfig()
    return providerRegistry.list().map(p => ({
      id: p.id,
      displayName: p.displayName,
      hasKey: p.resolveKey() !== null,
      supportsToolCalling: p.supportsToolCalling
    }))
  }))

  ipcMain.handle('providers:reload', () => handleIpc(async () => {
    return loadProvidersConfig()
  }))

  ipcMain.handle('providers:list-models', (_e, providerId: string) => handleIpc(async () => {
    const provider = providerRegistry.get(providerId)
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`)
    }
    if (!provider.listModels) {
      return []
    }
    return provider.listModels()
  }))
}
