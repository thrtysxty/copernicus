import { ipcMain, BrowserWindow } from 'electron';
import { ptyManager } from '../pty-manager';
import { handleIpc } from '../utils/handle-ipc';
import { randomUUID } from 'crypto';

export function registerWizardPtyHandlers() {
  ipcMain.handle('wizard:spawn-auth-pty', (_e, { providerId, cmd }: { providerId: string; cmd: string }) =>
    handleIpc(async () => {
      const sessionId = `wizard-pty-${providerId}-${randomUUID()}`;

      const windows = BrowserWindow.getAllWindows();
      if (windows.length === 0 || !windows[0]) {
        throw new Error('No active window found');
      }

      ptyManager.createEphemeral(sessionId, cmd, process.cwd(), windows[0]);

      const ptyProcess = ptyManager.getPty(sessionId);
      if (ptyProcess) {
        ptyProcess.onData((data: string) => {
          if (windows[0] && !windows[0].isDestroyed()) {
            windows[0].webContents.send('wizard:pty-data', { sessionId, data });
          }
        });

        ptyProcess.onExit((event: { exitCode: number; signal?: number }) => {
          if (windows[0] && !windows[0].isDestroyed()) {
            windows[0].webContents.send('wizard:pty-exit', { sessionId, code: event.exitCode });
          }
        });
      }

      return { sessionId };
    })
  );
}