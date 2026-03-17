import { ipcMain, BrowserWindow } from 'electron'
import log from 'electron-log'
import { handleIpc } from '../utils/handle-ipc'
import { WORKFLOW_TEMPLATES } from '../workflow/templates'

import { IpcHandlerDeps } from './deps'

export function register(_win: BrowserWindow, deps: IpcHandlerDeps) {
  const { workflowEngine, socketManager } = deps

  // Workflow Handlers
  ipcMain.handle('workflow:update-node-data', (_e, { nodeId, field, value }: { nodeId: string; field: string; value: any }) => handleIpc('workflow:update-node-data', [{ nodeId, field, value }], () => {
    // This is primarily for external persistence if needed, 
    // but the renderer currently manages the graph state.
    log.info(`[Workflow] Update Node ${nodeId}: ${field} = ${value}`);
    return true;
  }));

  ipcMain.handle('workflow:save-schedule', (_e, { nodeId, scheduleNl, scheduleCron }: { nodeId: string; scheduleNl: string; scheduleCron: string }) => handleIpc('workflow:save-schedule', [{ nodeId, scheduleNl, scheduleCron }], () => {
    log.info(`[Workflow] Save Schedule for Node ${nodeId}: ${scheduleNl} -> ${scheduleCron}`);
    // Persistence is handled by graph save, but we could also store in stateLedger here if needed
    return true;
  }));

  ipcMain.handle('workflow:ollama-status', () => handleIpc('workflow:ollama-status', [], async () => {
    try {
      const res = await fetch('http://localhost:11434/api/tags', {
        signal: AbortSignal.timeout(2000),
      });
      return { online: res.ok };
    } catch {
      return { online: false };
    }
  }));

  ipcMain.handle('workflow:run', (_event, payload: any) => handleIpc('workflow:run', [payload], () => {
    if (payload && payload.templateId) {
      const tpl = WORKFLOW_TEMPLATES.find(t => t.id === payload.templateId)
      if (!tpl) throw new Error('TEMPLATE_NOT_FOUND')
      if (payload.context) workflowEngine.updateContext(payload.context)
      return workflowEngine.runGraph(tpl.graph)
    }
    return workflowEngine.runGraph(payload)
  }))

  ipcMain.handle('workflow:status', () => handleIpc('workflow:status', [], () => ({
    state: workflowEngine.getState(),
    nodeStatuses: workflowEngine.getNodeStatusDetails(),
    context: workflowEngine.getContext(),
  })))

  ipcMain.handle('workflow:list-templates', () => handleIpc('workflow:list-templates', [], () =>
    WORKFLOW_TEMPLATES.map(({ id, name, description }) => ({ id, name, description }))
  ))

  ipcMain.handle('workflow:get-template', (_event, id: string) => handleIpc('workflow:get-template', [id], () => {
    const tpl = WORKFLOW_TEMPLATES.find(t => t.id === id)
    if (!tpl) throw new Error('NOT_FOUND')
    return tpl
  }))

  ipcMain.handle('workflow:reset', () => handleIpc('workflow:reset', [], () => {
    workflowEngine.reset()
    return true
  }))

  ipcMain.handle('workflow:get-snapshots', (_e, workflowId: string) =>
    handleIpc('workflow:get-snapshots', [workflowId], () => deps.snapshotManager?.getForWorkflow(workflowId) ?? [])
  )

  ipcMain.handle('workflow:get-context', (_e, key: string) =>
    handleIpc('workflow:get-context', [key], () => {
      const context = workflowEngine.getContext()
      return context[key]
    })
  )

  ipcMain.handle('workflow:set-context', (_e, key: string, value: string) =>
    handleIpc('workflow:set-context', [key, value], () => {
      workflowEngine.updateContext({ [key]: value })
      return true
    })
  )

  ipcMain.handle('workflow:resume-node', (_e, nodeId: string) =>
    handleIpc('workflow:resume-node', [nodeId], () => {
      // In this prototype, resuming implies resetting the node's state so the loop or retry can proceed
      // Since WorkflowEngine doesn't have a direct "resume" for a specific node yet, we transition it.
      if (workflowEngine.getState() === 'PAUSED') {
        workflowEngine.transition('RUNNING');
      }
      return true
    })
  )

  ipcMain.handle('workflow:rewind', (_e, snapshotId: number) =>
    handleIpc('workflow:rewind', [snapshotId], () => {
      const result = deps.snapshotManager?.rewind(snapshotId)
      if (!result) throw new Error('SnapshotManager not initialized')
      _win.webContents.send('workflow:status', { rewoundTo: snapshotId, detachedHead: true })
      return { ...result, detachedHead: true }
    })
  )

  // WebSocket Handlers
  ipcMain.handle('ws:subscribe-session', (_e, sessionId: string) => handleIpc('ws:subscribe-session', [sessionId], () => socketManager.subscribeSession(sessionId)))
  ipcMain.handle('ws:unsubscribe-session', (_e, sessionId: string) => handleIpc('ws:unsubscribe-session', [sessionId], () => socketManager.unsubscribeSession(sessionId)))

  // Template Handlers
  ipcMain.handle('templates:list', () => handleIpc('templates:list', [], () => {
    return WORKFLOW_TEMPLATES.map(t => {
      const override = deps.stateLedger.getTemplateOverride(t.id)
      return {
        id: t.id,
        name: t.name,
        type: 'Workflow',
        content: override?.content ?? JSON.stringify(t, null, 2),
        isOverridden: !!override
      }
    })
  }))

  ipcMain.handle('templates:save', (_e, id: string, content: string) => handleIpc(() => deps.stateLedger.saveTemplateOverride(id, content)))

  ipcMain.handle('templates:reset', (_e, id: string) => handleIpc(() => deps.stateLedger.deleteTemplateOverride(id)))

  // Snapshot Handlers
  ipcMain.handle('snapshot:save', (_e, payload: any) => handleIpc('snapshot:save', [payload], () => {
    deps.stateLedger.saveSnapshot(payload);
  }));
  ipcMain.handle('snapshot:restore', (_e, panelId: string) => handleIpc('snapshot:restore', [panelId], () =>
    deps.stateLedger.getLatestSnapshot(panelId)
  ));
}
