import { ipcMain } from 'electron';
import { handleIpc } from '../utils/handle-ipc';
import { memoryService, AddMemoryParams, LogWorkParams } from '../memory/memoryService';
import log from 'electron-log';

export function registerMemoryHandlers() {
  log.info('[Memory] Registering IPC handlers');

  ipcMain.handle('memory:add', (_e, params: AddMemoryParams) =>
    handleIpc(async () => {
      log.info(`[Memory] Adding memory for project ${params.projectId}`);
      return memoryService.addMemory(params);
    })
  );

  ipcMain.handle('memory:get-working-set', (_e, projectId: string, bankId: string, limit?: number) =>
    handleIpc(async () => {
      log.info(`[Memory] Getting working set for project ${projectId}, bank ${bankId}`);
      return memoryService.getWorkingSet(projectId, bankId, limit);
    })
  );

  ipcMain.handle('memory:supersede', (_e, oldId: string, newId: string) =>
    handleIpc(async () => {
      log.info(`[Memory] Superseding ${oldId} with ${newId}`);
      memoryService.supersede(oldId, newId);
    })
  );

  ipcMain.handle('memory:log-work', (_e, params: LogWorkParams) =>
    handleIpc(async () => {
      log.info(`[Memory] Logging work for project ${params.projectId}`);
      return memoryService.logWork(params);
    })
  );

  ipcMain.handle('memory:get-work-log', (_e, projectId: string, bankId: string, limit?: number) =>
    handleIpc(async () => {
      log.info(`[Memory] Getting work log for project ${projectId}, bank ${bankId}`);
      return memoryService.getWorkLog(projectId, bankId, limit);
    })
  );
}
