export * from './env-sanitizer';
export * from './pty-auditor';
export * from './pattern-detector';
export * from './git-guard';

import { ipcMain, BrowserWindow } from 'electron';
import { gitGuard } from './git-guard';

export function setupSecurityIpc() {
  // IPC for git push confirmation
  ipcMain.on('security:git-push-response', (event, { agentId, allowed }) => {
    console.log(`[Security] Git push response for ${agentId}: ${allowed}`);
    // Future: Use an EventEmitter to signal back to the PTY write logic
  });
}
