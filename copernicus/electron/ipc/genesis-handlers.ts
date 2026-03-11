import { ipcMain } from 'electron';
import { handleIpc } from '../utils/handle-ipc';
import { GenesisPayload } from '../genesis/types';
import { IpcHandlerDeps } from './deps';

export function register(_win: Electron.BrowserWindow, deps: IpcHandlerDeps) {
  const { genesisRunner } = deps;

  ipcMain.handle('genesis:run', (_e, payload: GenesisPayload) =>
    handleIpc('genesis:run', [payload], () => genesisRunner.run(payload))
  );
}
