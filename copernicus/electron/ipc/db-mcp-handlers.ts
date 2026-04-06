// Story 631: GenAI Toolbox — Database MCP for Agent Intelligence
// Implementation provided by Jules
import { ipcMain } from 'electron'
import { handleIpc } from '../utils/handle-ipc'

export function registerDbMcpHandlers(): void {
  ipcMain.handle('db:query', (_e, _sql: string) => handleIpc(async () => {
    throw new Error('Not implemented')
  }))

  ipcMain.handle('db:list-tables', (_e) => handleIpc(async () => {
    throw new Error('Not implemented')
  }))

  ipcMain.handle('db:story-status', (_e, _storyId: string) => handleIpc(async () => {
    throw new Error('Not implemented')
  }))
}
