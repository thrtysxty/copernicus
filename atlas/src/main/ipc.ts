import { ipcMain, BrowserWindow } from 'electron';
import { PtyManager } from './pty';

export function setupIpc(ptyManager: PtyManager) {
  // Only register handlers once
  if (ipcMain.eventNames().includes('pty:create')) {
      // Already registered? eventNames returns channel names for 'on', not 'handle'?
      // ipcMain.handle doesn't have a check method easily.
      // We can wrap in try-catch or removeHandler.
      ipcMain.removeHandler('pty:create');
  }

  ipcMain.handle('pty:create', (event, { id, cols, rows }) => {
    try {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) throw new Error('No window found for event');

        const pty = ptyManager.createPty(id, cols, rows, window);
        
        pty.onData((data) => {
          if (window && !window.isDestroyed()) {
             window.webContents.send('pty:data', { id, data });
          }
        });
        
        return { success: true, id };
    } catch (error: any) {
        console.error('Failed to create PTY:', error);
        return { success: false, error: error.message };
    }
  });

  ipcMain.on('pty:resize', (event, { id, cols, rows }) => {
    ptyManager.resizePty(id, cols, rows);
  });

  ipcMain.on('pty:write', (event, { id, data }) => {
    ptyManager.writePty(id, data);
  });

  ipcMain.on('pty:kill', (event, { id }) => {
    ptyManager.killPty(id);
  });
}
