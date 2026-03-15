import { app } from 'electron';
import * as path from 'path';
import * as net from 'net';
import { ChildProcess, spawn } from 'child_process';
import log from '../utils/logger';
import { modelRegistry } from '../models/model-registry';
import { authManager } from '../auth-manager';

export class LocalModelManager {
  private childProcess: ChildProcess | null = null;
  private port: number | null = null;

  public async start(): Promise<{ running: boolean, port: number | null }> {
    if (this.childProcess) {
      return this.getStatus();
    }

    try {
      this.port = await this.findEphemeralPort();
      
      const binaryPath = path.join(app.getAppPath(), 'resources', 'llama-server');
      const modelPath = path.join(app.getAppPath(), 'resources', 'models', 'bitnet-b158-2b.gguf');
      
      log.info(`Starting local model server on port ${this.port}...`);
      
      this.childProcess = spawn(binaryPath, [
        '--model', modelPath,
        '--port', String(this.port),
        '--host', '127.0.0.1'
      ], {
        stdio: 'inherit',
        windowsHide: true
      });

      this.childProcess.on('error', (err) => {
        log.error('Local model server failed to start:', err);
        this.stop();
      });

      this.childProcess.on('exit', (code) => {
        log.info(`Local model server exited with code ${code}`);
        this.childProcess = null;
        this.port = null;
      });

      // Register the model in the registry
      modelRegistry.registerModel({
        id: 'bitnet-b158-2b',
        provider: 'ollama', // Using ollama provider for compatibility
        name: 'BitNet B1.58 2B (Local)',
        contextWindow: 4096,
        costPer1kIn: 0,
        costPer1kOut: 0
      });

      // Update authManager to point ollama at our local server
      authManager.setBaseUrl('ollama', `http://localhost:${this.port}`);

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
