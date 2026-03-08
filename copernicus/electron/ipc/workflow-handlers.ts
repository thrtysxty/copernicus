import { ipcMain, BrowserWindow } from 'electron'
import log from 'electron-log'
import { handleIpc } from '../utils/handle-ipc'
import { WORKFLOW_TEMPLATES } from '../workflow/templates'

export function register(_win: BrowserWindow, deps: any) {
  const { workflowEngine, socketManager } = deps

  // Workflow Handlers
  ipcMain.handle('workflow:update-node-data', (_e, { nodeId, field, value }: any) => handleIpc(() => {
    // This is primarily for external persistence if needed, 
    // but the renderer currently manages the graph state.
    log.info(`[Workflow] Update Node ${nodeId}: ${field} = ${value}`);
    return true;
  }));

  ipcMain.handle('workflow:ollama-status', () => handleIpc(async () => {
    try {
      const res = await fetch('http://localhost:11434/api/tags', {
        signal: AbortSignal.timeout(2000),
      });
      return { online: res.ok };
    } catch {
      return { online: false };
    }
  }));

  ipcMain.handle('workflow:run', (_event, payload) => handleIpc(() => {
    if (payload && payload.templateId) {
      const tpl = WORKFLOW_TEMPLATES.find(t => t.id === payload.templateId)
      if (!tpl) throw new Error('TEMPLATE_NOT_FOUND')
      if (payload.context) workflowEngine.updateContext(payload.context)
      return workflowEngine.runGraph(tpl.graph)
    }
    return workflowEngine.runGraph(payload)
  }))

  ipcMain.handle('workflow:status', () => handleIpc(() => ({
    state: workflowEngine.getState(),
    nodeStatuses: workflowEngine.getNodeStatusDetails(),
    context: workflowEngine.getContext(),
  })))

  ipcMain.handle('workflow:list-templates', () => handleIpc(() =>
    WORKFLOW_TEMPLATES.map(({ id, name, description }) => ({ id, name, description }))
  ))

  ipcMain.handle('workflow:get-template', (_event, id: string) => handleIpc(() => {
    const tpl = WORKFLOW_TEMPLATES.find(t => t.id === id)
    if (!tpl) throw new Error('NOT_FOUND')
    return tpl
  }))

  ipcMain.handle('workflow:reset', () => handleIpc(() => {
    workflowEngine.reset()
    return true
  }))

  // WebSocket Handlers
  ipcMain.handle('ws:subscribe-session', (_e, sessionId: string) => handleIpc(() => socketManager.subscribeSession(sessionId)))
  ipcMain.handle('ws:unsubscribe-session', (_e, sessionId: string) => handleIpc(() => socketManager.unsubscribeSession(sessionId)))
}
