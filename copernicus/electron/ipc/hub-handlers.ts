import { ipcMain } from 'electron';
import { handleIpc } from '../utils/handle-ipc';
// @ts-ignore
import { syncUserAction } from '../../../scripts/agent-daemon/lib/hub.mjs';

export function registerHubHandlers() {
  ipcMain.handle('hub:user-sync', (_event, action) =>
    handleIpc('hub:user-sync', [action], () => {
      syncUserAction(action);
      return { ok: true };
    })
  );
}
