import os from 'os';
import fs from 'fs';
import { BrowserWindow } from 'electron';
import { PTYAuditor, securityManager } from './security';
import log from './utils/logger';

// Safe load for native module — may fail in packaged app
let pty: typeof import('node-pty') | null = null;
try {
  pty = require('node-pty');
  log.info('[PTY] node-pty loaded successfully');
} catch (err) {
  log.error('[PTY] FATAL: node-pty failed to load:', err);
  pty = null;
}

const getShell = () => {
  if (os.platform() === 'win32') return 'powershell.exe';

  // Preferred shells in order (must be absolute paths for reliable spawning in packaged apps)
  const shells = ['/bin/zsh', '/bin/bash', '/bin/sh'];
  for (const s of shells) {
    try {
      if (fs.existsSync(s)) return s;
    } catch { /* ignore */ }
  }
  return '/bin/sh'; // absolute fallback
};

const shell = getShell();

export class PTYManager {
  private sessions: Map<string, { id: string, ptyProcess: any /* pty.IPty */ }> = new Map();
  private auditor: PTYAuditor;

  constructor() {
    this.auditor = new PTYAuditor();
  }

  create(id: string, cols: number, rows: number, cwd: string = os.homedir(), window: BrowserWindow) {
    if (!pty) {
      log.error(`[PTY] Cannot create terminal ${id}: node-pty module not loaded`);
      if (window && !window.isDestroyed()) {
        window.webContents.send('terminal-incoming', { id, data: '\r\n\x1b[31m[ERROR] Terminal unavailable: node-pty module failed to load.\x1b[0m\r\n' });
      }
      return;
    }
    if (this.sessions.has(id)) {
      log.warn(`Terminal session ${id} already exists.`);
      return;
    }

    // Ensure CWD exists
    if (!fs.existsSync(cwd)) {
      log.warn(`Terminal CWD does not exist: ${cwd}, falling back to home.`);
      cwd = os.homedir();
    }

    // Resolves AC 2: Use SecurityManager to prepare the environment
    const { env, sandboxPrefix } = securityManager.prepareSecureExecution(id);

    let executable = shell;
    let args: string[] = [];

    if (sandboxPrefix.length > 0 && sandboxPrefix[0]) {
        executable = sandboxPrefix[0];
        args = [...sandboxPrefix.slice(1), shell];
    }

    try {
      const ptyProcess = pty?.spawn(executable, args, {
        name: 'xterm-256color',
        cols: cols,
        rows: rows,
        cwd: cwd,
        env: env as any
      });

      ptyProcess.onData((data) => {
        this.auditor.log(id, 'OUT', data);

        if (window && !window.isDestroyed()) {
          window.webContents.send('terminal-incoming', { id, data });
        }
      });

      ptyProcess.onExit(({ exitCode, signal }) => {
        log.info(`Terminal ${id} exited with code ${exitCode} signal ${signal}`);
        this.sessions.delete(id);
        if (window && !window.isDestroyed()) {
          window.webContents.send('terminal-closed', { id });
        }
      });

      this.sessions.set(id, { id, ptyProcess });
      log.info(`Created terminal session: ${id} with shell ${executable}`);
    } catch (err) {
      log.error(`Failed to spawn terminal ${id}:`, err);
      if (window && !window.isDestroyed()) {
        const msg = err instanceof Error ? err.message : String(err);
        window.webContents.send('terminal-incoming', { id, data: `\r\n\x1b[31m[ERROR] Failed to spawn terminal: ${msg}\x1b[0m\r\n` });
      }
    }
  }

  createEphemeral(id: string, command: string, cwd: string, window: BrowserWindow) {
    const cols = 120, rows = 30
    // Use security manager to build environment for ephemeral runs too
    const { env } = securityManager.prepareSecureExecution(id);

    const ptyProcess = pty!.spawn(shell, ['-c', command], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: cwd || os.homedir(),
      env: env as any,
    })

    this.sessions.set(id, { id, ptyProcess })

    ptyProcess.onData(data => {
      this.auditor.log(id, 'OUT', data);
      if (window && !window.isDestroyed()) {
        window.webContents.send('terminal-incoming', { id, data })
      }
    })

    ptyProcess.onExit(({ exitCode }) => {
      this.sessions.delete(id)
      if (window && !window.isDestroyed()) {
        // Small delay so the user can read final output before tab closes
        setTimeout(() => {
          window.webContents.send('terminal:remove', { id, exitCode })
        }, exitCode === 0 ? 1500 : 4000)
      }
    })
  }

  resize(id: string, cols: number, rows: number) {
    const session = this.sessions.get(id);
    if (session) {
      try {
        session.ptyProcess.resize(cols, rows);
      } catch (err) {
        log.error(`Failed to resize terminal ${id}`, err);
      }
    }
  }

  // Resolves AC 3: Async write with GitGuard check
  async write(id: string, data: string): Promise<void> {
    log.info('[PTY] write called:', { id });
    const session = this.sessions.get(id);
    if (!session) {
      log.warn(`Write failed: Terminal ${id} not found.`);
      return;
    }

    // Pattern detection — fires alert events and writes to security-alerts.jsonl
    securityManager.analyseData(id, data);

    // GitGuard check — blocks git push/force/remote-add/config-user until confirmed
    const GIT_GATE_PATTERN = /\bgit\s+(push|remote\s+add|config\s+.*user)\b/;
    if (GIT_GATE_PATTERN.test(data)) {
      const allowed = await securityManager.checkGitCommand(id, data);
      if (!allowed) {
        log.warn(`[PTY:${id}] GitGuard BLOCKED: ${data.trim().substring(0, 80)}`);
        // Inform the renderer that the command was blocked
        const focusedWin = (await import('electron')).BrowserWindow.getFocusedWindow();
        focusedWin?.webContents.send('terminal-blocked', {
          id,
          reason: 'GitGuard denied this operation',
        });
        return;
      }
    }

    this.auditor.log(id, 'IN', data);
    session.ptyProcess.write(data);
  }

  getPty(id: string): any /* pty.IPty */ | undefined {
    const session = this.sessions.get(id);
    return session?.ptyProcess;
  }

  kill(id: string) {
    const session = this.sessions.get(id);
    if (session) {
      session.ptyProcess.kill();
      this.sessions.delete(id);
    }
  }

  killAll() {
    for (const id of this.sessions.keys()) {
      this.kill(id);
    }
    this.auditor.close();
  }
}

export const ptyManager = new PTYManager();
