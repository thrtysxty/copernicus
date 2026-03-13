import { ipcMain } from 'electron';
import { handleIpc } from '../utils/handle-ipc';
import { securityManager } from '../security';
import { SecurityScorer } from '../security/SecurityScorer';
import * as path from 'path';
import { app } from 'electron';

let scorer: SecurityScorer | null = null;

export function register() {
  // Initialize scorer lazily or when registered
  const projectRoot = path.resolve(app.getAppPath(), '../../');
  if (!scorer && securityManager && securityManager.detector) {
    scorer = new SecurityScorer(securityManager.detector, projectRoot);
  }

  ipcMain.handle('security:score', () => handleIpc('security:score', [], async () => {
    if (!scorer) {
      if (securityManager && securityManager.detector) {
        scorer = new SecurityScorer(securityManager.detector, projectRoot);
      } else {
        throw new Error('SecurityManager not initialized');
      }
    }
    return await scorer.computeScore();
  }));
}
