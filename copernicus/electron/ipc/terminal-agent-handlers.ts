import { ipcMain, BrowserWindow } from 'electron'
import { handleIpc } from '../utils/handle-ipc'
import { IpcHandlerDeps, TerminalSession } from './deps'
import log from 'electron-log'

export function register(_win: BrowserWindow, deps: IpcHandlerDeps) {
  const { layoutStore } = deps

  ipcMain.handle('terminal:attach-agent', (_, { agentId, label }: { agentId: string, label: string }) => {
    return handleIpc('terminal:attach-agent', [agentId, label], () => {
      const tabId = `agent-${agentId}`
      const existingTerminal = layoutStore.getTerminals().find((t: TerminalSession) => t.id === tabId)

      if (existingTerminal) {
        layoutStore.setActiveTerminal(tabId)
        log.info('[terminal-agent-handlers] Activated existing terminal:', tabId)
        return { ok: true, message: 'Existing terminal activated.' }
      } else {
        layoutStore.addTerminal(tabId, label, true) // Ephemeral: true means it will close after agent finishes
        layoutStore.setTerminalOpen(true)
        log.info('[terminal-agent-handlers] Created new terminal:', tabId)
        return { ok: true, message: 'New terminal created and activated.' }
      }
    })
  })
}
