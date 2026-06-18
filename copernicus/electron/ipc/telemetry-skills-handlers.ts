import { ipcMain } from 'electron';
import { handleIpc } from '../utils/handle-ipc';
import { config } from '../config';
import { memoryService } from '../memory/memoryService';
import { detectStack } from '../skills/stack-detector';
import { auditSkillDescriptions } from '../skills/description-auditor';
import { execAsync } from '../utils/exec-async';
import { cwd } from 'node:process';
import * as fs from 'fs';
import * as path from 'path';

export function registerTelemetryHandlers(
  _deps: {
    collectorProcess: { killed: boolean } | null;
    fsManager: { getRootPath: () => string | null };
    stateLedger: { getEditDecisionsCounts: (promptId: string) => any };
  }
): void {
  // review:generate-summary
  ipcMain.handle('review:generate-summary', (_e, { diff, storyId, storyTitle }: { diff: string; storyId: string; storyTitle: string }) =>
    handleIpc(async () => {
      const truncated = (diff as string).slice(0, 4000);
      const fileLines = truncated
        .split('\n')
        .filter((l: string) => l.startsWith('--- a/') || l.startsWith('+++ b/'))
        .map((l: string) => l.replace(/^(\+\+\+ b\/|--- a\/)/, '').trim())
        .filter((f: string, i: number, arr: string[]) => arr.indexOf(f) === i && f !== '/dev/null');
      return {
        storyId,
        storyTitle,
        changedFiles: fileLines.slice(0, 10),
        summary: `Story ${storyId} implementation complete. ${fileLines.length} file(s) changed.`,
        timestamp: new Date().toISOString(),
      };
    })
  );

  // telemetry:recovery-status
  ipcMain.handle('telemetry:recovery-status', (_e) =>
    handleIpc(async () => {
      try {
        const response = await fetch(`${config.otel.endpoint}/recovery-status`);
        if (response.ok) {
          return await response.json();
        }
      } catch (err) {
        console.warn('[Main] Failed to fetch recovery status:', err);
      }
      return { pendingRows: 0, recovered: 0 };
    })
  );

  // telemetry:status
  ipcMain.handle('telemetry:status', (_e) =>
    handleIpc(async () => {
      const collectorRunning = _deps.collectorProcess !== null && !_deps.collectorProcess.killed;

      let settingsWritten = false;
      try {
        const rootPath = _deps.fsManager.getRootPath();
        if (rootPath) {
          const settingsPath = path.join(rootPath, '.claude', 'settings.json');
          if (fs.existsSync(settingsPath)) {
            const content = fs.readFileSync(settingsPath, 'utf-8');
            settingsWritten = content.includes('// --- Copernicus Managed: OTel ---');
          }
        }
      } catch {
        // ignore
      }

      return { collectorRunning, settingsWritten };
    })
  );

  // health:check-all
  ipcMain.handle('health:check-all', (_e) =>
    handleIpc(async () => {
      const checks = await Promise.allSettled([
        // Backend reachable
        fetch(`${config.backend.url}/api/health`).then(() => ({ name: 'Backend', ok: true })).catch(() => ({ name: 'Backend', ok: false })),
        // Git valid
        execAsync('git rev-parse --git-dir', { cwd: cwd() }).then(() => ({ name: 'Git', ok: true })).catch(() => ({ name: 'Git', ok: false })),
      ]);
      return checks.map((r, i) => r.status === 'fulfilled' ? r.value : { name: ['Backend', 'Git'][i], ok: false });
    })
  );

  // db:get-edit-decisions
  ipcMain.handle('db:get-edit-decisions', (_e, { promptId }: { promptId: string }) =>
    handleIpc(() => _deps.stateLedger.getEditDecisionsCounts(promptId))
  );

  // memory:get-active-project
  ipcMain.handle('memory:get-active-project', (_e) =>
    handleIpc(() => memoryService.activeProjectId)
  );
}

export function registerSkillsHandlers(
  _deps: {
    fsManager: { getRootPath: () => string | null };
  }
): void {
  // skills:detect-stack
  ipcMain.handle('skills:detect-stack', () =>
    handleIpc(() => {
      const rootPath = _deps.fsManager.getRootPath();
      return detectStack(rootPath || '');
    })
  );

  // skills:audit
  ipcMain.handle('skills:audit', () =>
    handleIpc(async () => {
      const rootPath = _deps.fsManager.getRootPath();
      return auditSkillDescriptions(rootPath || '');
    })
  );
}