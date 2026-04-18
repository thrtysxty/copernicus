import { ipcMain, BrowserWindow } from 'electron'
import os from 'node:os'
import { execFile } from 'node:child_process'
import log from 'electron-log'
import { handleIpc } from '../utils/handle-ipc'
import { assertSafePath } from '../utils/path-guard'

import { IpcHandlerDeps } from './deps'

export function register(win: BrowserWindow, deps: IpcHandlerDeps) {
  const { ptyManager, fsManager } = deps

  // Terminal IPC
  ipcMain.on('terminal-create', (_event, { id, cols, rows, cwd }: { id: string; cols: number; rows: number; cwd?: string }) => {
    const cwdOrHome = cwd || os.homedir();
    let resolvedCwd: string;
    try {
      resolvedCwd = assertSafePath(cwdOrHome);
    } catch {
      resolvedCwd = os.homedir();
    }
    if (win) ptyManager.create(id, cols, rows, resolvedCwd, win);
  });

  ipcMain.handle('terminal:resize', (_e, { id, cols, rows }: { id: string; cols: number; rows: number }) => handleIpc('terminal:resize', [{ id, cols, rows }], () => ptyManager.resize(id, cols, rows)));

  ipcMain.handle('terminal:input', (_e, { id, data }: { id: string; data: string }) =>
    handleIpc('terminal:input', [id, data], async () => {
      await ptyManager.write(id, data)
      return { ok: true }
    })
  )

  ipcMain.on('terminal-write', (_event, payload: { id: string; data: string }) => {
    if (payload?.id && payload?.data) ptyManager.write(payload.id, payload.data);
  });

  ipcMain.on('terminal-kill', (_event, { id }: { id: string }) => ptyManager.kill(id));

  ipcMain.handle('terminal:stop-agent', (_event, { id }: { id: string }) => handleIpc('terminal:stop-agent', [{ id }], () => ptyManager.kill(id)));

  ipcMain.handle('terminal:spawn', (_e, { command, cwd, label, id }: { command: string; cwd: string; label: string; id?: string }) => handleIpc('terminal:spawn', [{ command, cwd, label, id }], async () => {
    const termId = id || `term-${Date.now()}`
    const resolvedCwd = assertSafePath(cwd)
    if (win) {
      win.webContents.send('terminal:spawn', { id: termId, label, ephemeral: true })
      ptyManager.createEphemeral(termId, command, resolvedCwd, win)
    }
    return termId
  }))

  ipcMain.on('terminal:spawn-agent', (_event, { agentId }: { agentId: string }) => {
    if (!/^[a-z0-9_-]+$/.test(agentId)) return;
    BrowserWindow.getAllWindows().forEach(w => w.webContents.send('terminal:activate-tab', { agentId }));
  })

  // System Execution
  ipcMain.on('system:make', (_, target: string) => {
    const ALLOWED = ['dev', 'test', 'build', 'lint', 'backlog', 'deploy'];
    if (ALLOWED.includes(target)) deps.spawn('make', [target], { cwd: fsManager.getRootPath(), shell: false })
  });

  // Container Runtime Handlers
  ipcMain.handle('runtime:check-docker', () => handleIpc('runtime:check-docker', [], async () => {
    return new Promise((resolve) => {
      execFile('which', ['docker'], { shell: false }, (error: any) => {
        if (error) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }));

  ipcMain.handle('runtime:list-containers', () => handleIpc('runtime:list-containers', [], async () => {
    return new Promise((resolve) => {
      execFile('docker', ['ps', '-a', '--format', '{{json .}}'], { shell: false }, (error: any, stdout: string) => {
        if (error) {
          log.error('Failed to list containers:', error);
          resolve([]);
          return;
        }

        try {
          const lines = stdout.trim().split('\n').filter(Boolean);
          const containers = lines.map(line => JSON.parse(line));
          resolve(containers);
        } catch (e) {
          log.error('Failed to parse container list:', e);
          resolve([]);
        }
      });
    });
  }));

  ipcMain.handle('runtime:manage-container', (_event, { id, action }: { id: string, action: 'start' | 'stop' | 'logs' }) => handleIpc('runtime:manage-container', [{ id, action }], async () => {
    if (action === 'logs') {
      const termId = `logs-${id}-${Date.now()}`;
      if (win) {
        win.webContents.send('terminal:spawn', { id: termId, label: `Logs: ${id.substring(0, 8)}`, ephemeral: true });
        ptyManager.createEphemeral(termId, `docker logs -f ${id}`, fsManager.getRootPath(), win);
      }
      return { ok: true, termId };
    }

    return new Promise((resolve, reject) => {
      execFile('docker', [action, id], { shell: false }, (error: any, _stdout: string, stderr: string) => {
        if (error) {
          log.error(`Failed to ${action} container ${id}:`, error, stderr);
          reject(new Error(stderr || error.message));
        } else {
          resolve({ ok: true });
        }
      });
    });
  }));

}
