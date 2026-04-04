import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import { ChildProcess, spawn } from 'child_process';
import log from '../utils/logger';
import { modelRegistry } from '../models/model-registry';
import { authManager } from '../auth-manager';

export class LocalModelManager {
  private childProcess: ChildProcess | null = null;
  private port: number | null = null;

  public isModelCached(): boolean {
    try {
      const cacheDir = path.join(os.homedir(), '.cache', 'huggingface', 'hub', 'models--mlx-community--gemma-4-8b-it-4bit');
      return fs.existsSync(cacheDir) && fs.readdirSync(cacheDir).length > 0;
    } catch (e) {
      return false;
    }
  }

  public async start(): Promise<{ running: boolean, port: number | null }> {
    if (this.childProcess) {
      return this.getStatus();
    }

    try {
      this.port = await this.findEphemeralPort();
      
      log.info(`Starting local model server on port ${this.port}...`);
      
      this.childProcess = spawn('python3', [
        '-m', 'mlx_lm.server',
        '--model', 'mlx-community/gemma-4-8b-it-4bit',
        '--port', String(this.port),
        '--host', '127.0.0.1'
      ], {
        stdio: 'inherit',
        windowsHide: true
      });

      this.childProcess.on('error', (err) => {
        log.error('Local model server failed to start:', err);
        this.childProcess = null;
        this.stop();
      });

      this.childProcess.on('exit', (code) => {
        log.info(`Local model server exited with code ${code}`);
        this.childProcess = null;
        this.port = null;
      });

      // Poll /health until server is ready (max 30s)
      const maxAttempts = 60;
      for (let i = 0; i < maxAttempts; i++) {
        if (!this.childProcess) {
          return { running: false, port: null };
        }
        try {
          const res = await fetch(`http://127.0.0.1:${this.port}/health`);
          if (res.ok) {
            // Register model and update authManager only after server is confirmed healthy
            modelRegistry.registerModel({
              id: 'gemma4-e4b',
              provider: 'ollama', // Using ollama provider for compatibility
              name: 'Gemma 4 e4b (MLX)',
              contextWindow: 131072,
              costPer1kIn: 0,
              costPer1kOut: 0
            });
            authManager.setBaseUrl('ollama', `http://localhost:${this.port}`);
            break;
          }
        } catch {
          // not ready yet
        }
        await new Promise(r => setTimeout(r, 500));
        if (i === maxAttempts - 1) {
          this.stop();
          return { running: false, port: null };
        }
      }
      return this.getStatus();
    } catch (error) {
      log.error('Failed to start local model manager:', error);
      return { running: false, port: null };
    }
  }

  public stop(): { running: boolean, port: number | null } {
    if (this.childProcess) {
      this.childProcess.kill();
      this.childProcess = null;
    }
    this.port = null;
    return this.getStatus();
  }

  public isRunning(): boolean {
    return this.childProcess !== null;
  }

  public getPort(): number | null {
    return this.port;
  }

  public getStatus(): { running: boolean, port: number | null } {
    return {
      running: this.isRunning(),
      port: this.port
    };
  }

  private findEphemeralPort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.unref();
      server.on('error', reject);
      server.listen(0, () => {
        const address = server.address() as net.AddressInfo;
        const port = address.port;
        server.close(() => resolve(port));
      });
    });
  }
}

export const localModelManager = new LocalModelManager();
