import { ipcMain } from 'electron';
import { handleIpc } from '../utils/handle-ipc';
import { memoryService, AddMemoryParams, LogWorkParams } from '../memory/memoryService';

export function registerMemoryHandlers() {
  ipcMain.handle('memory:add', (_e, params: AddMemoryParams) =>
    handleIpc(() => memoryService.addMemory(params))
  );

  ipcMain.handle('memory:get-working-set', (_e, projectId: string, bankId: string, limit?: number) =>
    handleIpc(() => memoryService.getWorkingSet(projectId, bankId, limit))
  );

  ipcMain.handle('memory:supersede', (_e, oldId: string, newId: string) =>
    handleIpc(() => {
      memoryService.supersede(oldId, newId);
    })
  );

  ipcMain.handle('memory:log-work', (_e, params: LogWorkParams) =>
    handleIpc(() => memoryService.logWork(params))
  );

  ipcMain.handle('memory:get-work-log', (_e, projectId: string, bankId: string, limit?: number) =>
    handleIpc(() => memoryService.getWorkLog(projectId, bankId, limit))
  );
}
