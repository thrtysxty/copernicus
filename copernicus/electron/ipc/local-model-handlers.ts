import { ipcMain } from 'electron';
import { handleIpc } from '../utils/handle-ipc';
import { localModelManager } from '../local-model/LocalModelManager';

export function register() {
  ipcMain.handle('localmodel:start', () => 
    handleIpc('localmodel:start', [], () => localModelManager.start())
  );

  ipcMain.handle('localmodel:stop', () => 
    handleIpc('localmodel:stop', [], () => localModelManager.stop())
  );

  ipcMain.handle('localmodel:status', () => 
    handleIpc('localmodel:status', [], () => localModelManager.getStatus())
  );

  ipcMain.handle('localmodel:is-cached', () =>
    handleIpc('localmodel:is-cached', [], () => localModelManager.isModelCached())
  );
}
