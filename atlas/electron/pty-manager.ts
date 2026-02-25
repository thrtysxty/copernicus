import * as pty from 'node-pty';
import { BrowserWindow, IpcMainEvent } from 'electron';
import os from 'os';

const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

interface TerminalSession {
  id: string;
  ptyProcess: pty.IPty;
}

class PtyManager {
  private sessions: Map<string, TerminalSession> = new Map();

  create(id: string, cols: number, rows: number, cwd: string = os.homedir(), window: BrowserWindow) {
    if (this.sessions.has(id)) {
      console.warn(`Terminal session ${id} already exists.`);
      return;
    }

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: process.env as Record<string, string>,
    });

    ptyProcess.onData((data) => {
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
      } catch (e) {
        console.error(`Failed to resize terminal ${id}`, e);
      }
    }
  }

  write(id: string, data: string) {
    const session = this.sessions.get(id);
    if (session) {
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
  }
}

export const ptyManager = new PtyManager();
