import { ipcMain } from 'electron';
import { handleIpc } from '../utils/handle-ipc';
import { stateLedger } from '../db/state-ledger';
import { IntelligenceDocument } from '../intelligence/types';

export function registerIntelHandlers() {
  ipcMain.handle('intel:list', (_e, { projectId }: { projectId: string }) => handleIpc(() => {
    return stateLedger.listIntelDocs(projectId);
  }));

  ipcMain.handle('intel:get', (_e, { id }: { id: string }) => handleIpc(() => {
    return stateLedger.getIntelDoc(id);
  }));

  ipcMain.handle('intel:create', (_e, data: {
    projectId: string;
    type: string;
    title: string;
    description?: string;
    content?: string;
    pathScope?: string[];
    providers?: any[];
  }) => handleIpc(() => {
    return stateLedger.createIntelDoc(data);
  }));

  ipcMain.handle('intel:update', (_e, data: { id: string } & Partial<IntelligenceDocument>) => handleIpc(() => {
    const { id, ...partial } = data;
    return stateLedger.updateIntelDoc(id, partial);
  }));

  ipcMain.handle('intel:delete', (_e, { id }: { id: string }) => handleIpc(() => {
    return { ok: stateLedger.deleteIntelDoc(id) };
  }));
}
