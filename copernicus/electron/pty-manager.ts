import * as pty from 'node-pty';
import os from 'os';
import { BrowserWindow } from 'electron';
import { PTYAuditor, securityManager } from './security';

const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

class PTYManager {
  private sessions: Map<string, { id: string, ptyProcess: pty.IPty }> = new Map();
  private auditor: PTYAuditor;

  constructor() {
    this.auditor = new PTYAuditor();
  }

  create(id: string, cols: number, rows: number, cwd: string = os.homedir(), window: BrowserWindow) {
    if (this.sessions.has(id)) {
      console.warn(`Terminal session ${id} already exists.`);
      return;
    }

    // Resolves AC 2: Use SecurityManager to prepare the environment
    const { env, sandboxPrefix } = securityManager.prepareSecureExecution(id);

    let executable = shell;
    let args: string[] = [];

    if (sandboxPrefix.length > 0) {
        executable = sandboxPrefix[0];
        args = [...sandboxPrefix.slice(1), shell];
    }

    const ptyProcess = pty.spawn(executable, args, {
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
      console.log(`Terminal ${id} exited with code ${exitCode} signal ${signal}`);
      this.sessions.delete(id);
      if (window && !window.isDestroyed()) {
        window.webContents.send('terminal-closed', { id });
      }
    });

    this.sessions.set(id, { id, ptyProcess });
    console.log(`Created terminal session: ${id}`);
  }

  resize(id: string, cols: number, rows: number) {
    const session = this.sessions.get(id);
    if (session) {
      try {
        session.ptyProcess.resize(cols, rows);
      } catch (err) {
        console.error(`Failed to resize terminal ${id}`, err);
      }
    }
  }

  write(id: string, data: string) {
    const session = this.sessions.get(id);
    if (session) {
      // Resolves AC 2: Pass every byte through PatternDetector analysis
      const analysis = securityManager.analyseData(data);
      if (analysis.length > 0) {
          console.warn(`[SECURITY] Potential dangerous pattern detected in PTY write:`, analysis);
          // For now we log and continue, but could block here if high-risk
      }

      this.auditor.log(id, 'IN', data);
      session.ptyProcess.write(data);
    } else {
      console.warn(`Write failed: Terminal ${id} not found.`);
    }
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
