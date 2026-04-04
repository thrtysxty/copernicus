import { ipcMain } from 'electron'
import { handleIpc } from '../utils/handle-ipc'
import { listOpenRouterModels, getOpenRouterCredits } from '../llm/providers/openrouter'

export function registerOpenRouterHandlers(): void {
  ipcMain.handle('openrouter:list-models', (_e, ..._args: unknown[]) =>
    handleIpc(() => listOpenRouterModels())
  )

  ipcMain.handle('openrouter:get-credits', (_e, ..._args: unknown[]) =>
    handleIpc(() => getOpenRouterCredits())
  )
}
