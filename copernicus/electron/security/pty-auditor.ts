import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Strips ANSI escape codes from a string.
 */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

interface LogEntry {
  ts: string;
  agent: string;
  dir: 'IN' | 'OUT';
  data: string;
}

export class PTYAuditor {
  private logDir: string;
  private maxTotalSize: number; // Bytes
  private retentionDays: number; // Days
  private activeStreams: Map<string, fs.WriteStream> = new Map();
  private lastRotation: number = 0;

  constructor(
    logDir: string = path.join(os.homedir(), '.copernicus', 'logs'),
    maxTotalSizeMb: number = 500,
    retentionDays: number = 30
  ) {
    this.logDir = logDir;
    this.maxTotalSize = maxTotalSizeMb * 1024 * 1024;
    this.retentionDays = retentionDays;
    
    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      try {
        fs.mkdirSync(this.logDir, { recursive: true });
      } catch (err) {
        console.error(`Failed to create log directory ${this.logDir}:`, err);
      }
    }

    // Clean up old logs on startup (fire and forget)
    this.rotateLogs().catch(err => console.error('Error rotating logs:', err));
  }

  /**
   * Logs a chunk of data from a PTY stream.
   * This uses a WriteStream for performance.
   */
  public log(agentId: string, dir: 'IN' | 'OUT', data: string): void {
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      agent: agentId,
      dir: dir,
      data: stripAnsi(data),
    };

    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const logFile = path.join(this.logDir, `pty-${agentId}-${dateStr}.log`);

    // Get or create stream
    // Key by filename to handle daily rotation automatically
    const streamKey = logFile;
    let stream = this.activeStreams.get(streamKey);

    if (!stream) {
      // Close any other stream for this agent (e.g. yesterday's)
      // Actually, we might have multiple agents. But one agent usually has one active log per day.
      // We should close old streams occasionally.
      // For now, we rely on the map key being unique per day per agent.
      // If the day changes, a new stream is created. Old stream stays open until close() or rotation.
      // This is acceptable as long as we don't leak file descriptors indefinitely (rotation handles deletion).
      
      stream = fs.createWriteStream(logFile, { flags: 'a' });
      stream.on('error', (err) => console.error(`Error writing to audit log ${logFile}:`, err));
      this.activeStreams.set(streamKey, stream);
    }

    // Write
    const line = JSON.stringify(entry) + '\n';
    if (!stream.write(line)) {
      // Handle backpressure if needed, but for logs usually fine
    }
  }

  /**
   * Rotates logs based on retention policy.
   * - Deletes files older than retentionDays.
   * - Deletes oldest files if total size > maxTotalSize.
   */
  public async rotateLogs(): Promise<void> {
    // Prevent frequent rotation checks
    const now = Date.now();
    if (now - this.lastRotation < 60000) return; // Max once per minute
    this.lastRotation = now;

    try {
      if (!fs.existsSync(this.logDir)) return;

      const files = await fs.promises.readdir(this.logDir);
      const logFiles = files.filter(f => f.startsWith('pty-') && f.endsWith('.log'));
      
      const fileStats = await Promise.all(logFiles.map(async f => {
        const p = path.join(this.logDir, f);
        try {
          const stat = await fs.promises.stat(p);
          return { path: p, stat };
        } catch (e) {
          return null;
        }
      }));

      // Filter out nulls (files that might have been deleted)
      const validFiles = fileStats.filter((f): f is { path: string, stat: fs.Stats } => f !== null);

      // Sort by modification time (oldest first)
      validFiles.sort((a, b) => a.stat.mtimeMs - b.stat.mtimeMs);

      // 1. Delete files older than retention period
      const retentionMs = this.retentionDays * 24 * 60 * 60 * 1000;
      
      let totalSize = 0;
      const remainingFiles: typeof validFiles = [];

      for (const file of validFiles) {
        if (now - file.stat.mtimeMs > retentionMs) {
          // Close stream if open
          const stream = this.activeStreams.get(file.path);
          if (stream) {
            stream.end();
            this.activeStreams.delete(file.path);
          }
          try {
            await fs.promises.unlink(file.path);
            // eslint-disable-next-line no-console
            console.log(`Deleted old log file: ${file.path}`);
          } catch (e) {
            // Ignore if already deleted
          }
        } else {
          totalSize += file.stat.size;
          remainingFiles.push(file);
        }
      }

      // 2. Enforce total size limit
      // If total size > limit, delete oldest files until under limit
      let idx = 0;
      while (totalSize > this.maxTotalSize && idx < remainingFiles.length) {
        const file = remainingFiles[idx];
        // Close stream if open
        const stream = this.activeStreams.get(file.path);
        if (stream) {
          stream.end();
          this.activeStreams.delete(file.path);
        }
        try {
          await fs.promises.unlink(file.path);
          // eslint-disable-next-line no-console
          console.log(`Deleted log file to free space: ${file.path}`);
        } catch (e) {
          // Ignore
        }
        totalSize -= file.stat.size;
        idx++;
      }
    } catch (err) {
      console.error('Error during log rotation:', err);
    }
  }

  /**
   * Gracefully close all streams. Call on app exit.
   */
  public close(): void {
    for (const stream of this.activeStreams.values()) {
      stream.end();
    }
    this.activeStreams.clear();
  }
}
