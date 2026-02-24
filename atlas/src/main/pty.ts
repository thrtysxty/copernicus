import { spawn, IPty } from 'node-pty';
import { app, BrowserWindow } from 'electron';
import os from 'os';
import { execSync } from 'child_process';
import { buildSafeEnv, auditor, detector } from './security';
import { TelemetryParser } from './telemetry-parser';

export interface AgentPty {
  id: 'claude' | 'gemini' | 'jules';
  pty: IPty;
  cols: number;
  rows: number;
}

export class PtyManager {
  private ptys: Map<string, AgentPty> = new Map();

  constructor() {}

  createPty(id: string, cols: number, rows: number, window: BrowserWindow) {
    let shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    let args: string[] = [];
    
    // Determine command based on ID
    let command = shell;
    if (id === 'claude') command = 'claude';
    if (id === 'gemini') command = 'gemini';
    if (id === 'jules') {
        // Try jules or jules-cli
        if (this.commandExists('jules')) command = 'jules';
        else if (this.commandExists('jules-cli')) command = 'jules-cli';
        else command = shell;
    }

    // Check if command exists, if not fallback to shell with error message
    if (command !== shell && !this.commandExists(command)) {
        command = shell;
        args = ['-c', `echo "${id} CLI not found. Please install it."; ${shell}`];
    }

    // Build secure environment
    const env = buildSafeEnv(id);
    
    // Set workspace root (active project)
    const workspaceRoot = process.cwd();

    const ptyProcess = spawn(command, args, {
      name: 'xterm-256color',
      cols: cols || 80,
      rows: rows || 30,
      cwd: workspaceRoot,
      env: env as any
    });

    // Auditor & Detector tap
    ptyProcess.onData((data) => {
      // 1. Audit Log (stripped of ANSI)
      auditor.log(id, 'OUT', data);

      // 2. Scan for risk patterns
      const alerts = detector.scan(id, data);
      if (alerts.length > 0) {
        window.webContents.send('security:alert', { id, alerts });
      }

      // 3. Telemetry Parsing (Task tracking, Teleports)
      TelemetryParser.scan(id, data, window);
    });

    // If we fell back to shell because binary was missing, write the message
    if (command === shell && (id === 'claude' || id === 'gemini' || id === 'jules')) {
        let intendedBinary = id;
        if (id === 'jules') intendedBinary = 'jules';
        
        if (!this.commandExists(intendedBinary) && (id === 'jules' ? !this.commandExists('jules-cli') : true)) {
            setTimeout(() => {
                this.writePty(id, `echo "CLI '${id}' not found. Please install it."\r\n`);
            }, 500);
        }
    }

    this.ptys.set(id, {
      id: id as any,
      pty: ptyProcess,
      cols: cols,
      rows: rows
    });

    return ptyProcess;
  }

  private commandExists(command: string): boolean {
      try {
          execSync(`which ${command}`, { stdio: 'ignore' });
          return true;
      } catch {
          return false;
      }
  }

  getPty(id: string) {
    return this.ptys.get(id);
  }

  resizePty(id: string, cols: number, rows: number) {
    const pty = this.ptys.get(id);
    if (pty) {
      pty.pty.resize(cols, rows);
    }
  }

  writePty(id: string, data: string) {
    const pty = this.ptys.get(id);
    if (pty) {
      // Log input
      auditor.log(id, 'IN', data);
      
      // Also scan input for telemetry (e.g. user manually typing teleport)
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        TelemetryParser.scan(id, data, windows[0]);
      }

      pty.pty.write(data);
    }
  }

  killPty(id: string) {
    const pty = this.ptys.get(id);
    if (pty) {
      pty.pty.kill();
      this.ptys.delete(id);
    }
  }
}
