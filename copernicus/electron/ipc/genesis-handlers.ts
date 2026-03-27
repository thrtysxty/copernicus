import { ipcMain } from 'electron';
import { handleIpc } from '../utils/handle-ipc';
import { GenesisPayload } from '../genesis/types';
import { IpcHandlerDeps } from './deps';

export function register(_win: Electron.BrowserWindow, deps: IpcHandlerDeps) {
  const { genesisRunner } = deps;

  ipcMain.handle('genesis:run', (_e, payload: GenesisPayload) =>
    handleIpc('genesis:run', [payload], () => genesisRunner.run(payload))
  );

  ipcMain.handle('genesis:check-harness', (_e, repoPath: string) =>
    handleIpc('genesis:check-harness', [repoPath], () => genesisRunner.scaffoldRunner.checkHarness(repoPath))
  );

  ipcMain.handle('genesis:scaffold-harness', (_e, repoPath: string) =>
    handleIpc('genesis:scaffold-harness', [repoPath], () => genesisRunner.scaffoldRunner.scaffoldHarness(repoPath))
  );
}
