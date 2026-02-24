import { app } from 'electron';
import { join } from 'path';
import { createWriteStream, mkdirSync, existsSync, readdirSync, unlinkSync, statSync } from 'fs';
import { WriteStream } from 'fs';

export interface AuditChunk {
  ts: string;
  agent: string;
  dir: 'IN' | 'OUT';
  data: string;
}

export class PTYAuditor {
  private logDir: string;
  private activeLogs: Map<string, WriteStream> = new Map();
  private maxTotalSize = 500 * 1024 * 1024; // 500MB
  private maxAgeDays = 30;

  constructor() {
    this.logDir = join(app.getPath('home'), '.atlas', 'logs');
    this.ensureLogDir();
    this.rotateLogs();
  }

  private ensureLogDir() {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getLogPath(agentId: string): string {
    const date = new Date().toISOString().split('T')[0];
    return join(this.logDir, `pty-${agentId}-${date}.log`);
  }

  private stripAnsi(data: string): string {
    // eslint-disable-next-line no-control-regex
    return data.replace(/[\u001b\u009b][[()#;?]*(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~]*)*)?\u0007/g, '');
  }

  public log(agentId: string, direction: 'IN' | 'OUT', data: string) {
    const logPath = this.getLogPath(agentId);
    let stream = this.activeLogs.get(agentId);

    // If day changed, rotate file
    if (stream && (stream as any).path !== logPath) {
      stream.end();
      stream = undefined;
    }

    if (!stream) {
      stream = createWriteStream(logPath, { flags: 'a' });
      this.activeLogs.set(agentId, stream);
    }

    const chunk: AuditChunk = {
      ts: new Date().toISOString(),
      agent: agentId,
      dir: direction,
      data: this.stripAnsi(data)
    };

    stream.write(JSON.stringify(chunk) + '\n');
  }

  private rotateLogs() {
    try {
      const files = readdirSync(this.logDir)
        .filter(f => f.startsWith('pty-') && f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: join(this.logDir, f),
          mtime: statSync(join(this.logDir, f)).mtime.getTime(),
          size: statSync(join(this.logDir, f)).size
        }))
        .sort((a, b) => b.mtime - a.mtime); // Newest first

      let totalSize = 0;
      const now = Date.now();

      for (const file of files) {
        const ageDays = (now - file.mtime) / (1000 * 60 * 60 * 24);
        
        if (ageDays > this.maxAgeDays || totalSize > this.maxTotalSize) {
          if (existsSync(file.path)) unlinkSync(file.path);
          console.log(`[Security] Deleted old audit log: ${file.name}`);
        } else {
          totalSize += file.size;
        }
      }
    } catch (err) {
      console.error('[Security] Failed to rotate audit logs:', err);
    }
  }

  public dispose() {
    for (const stream of this.activeLogs.values()) {
      stream.end();
    }
    this.activeLogs.clear();
  }
}

// Singleton auditor
export const auditor = new PTYAuditor();
