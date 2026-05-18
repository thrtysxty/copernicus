import { config } from './config'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'
import http from 'http'
import log from 'electron-log'
import { app } from 'electron'

export class BackendManager {
  private process: ChildProcess | null = null
  private port: number = config.backend.port

  async start(): Promise<void> {
    if (this.process) return

    this.port = parseInt(process.env.COPERNICUS_BACKEND_PORT ?? '5001', 10);
    const healthCheckUrl = `${config.backend.url}/api/health`;

    const alreadyRunning = await new Promise<boolean>((resolve) => {
      const req = http.get(healthCheckUrl, { timeout: 1000 }, (res) => {
        resolve(res.statusCode === 200)
      })
      req.on('error', () => resolve(false))
      req.on('timeout', () => { req.destroy(); resolve(false) })
    })
    if (alreadyRunning) {
      log.info(`[BackendManager] Backend service already running at ${healthCheckUrl} — skipping spawn`)
      this.process = null
      return
    }
    log.info(`[BackendManager] Backend service not running — proceeding to spawn`)

    const isPackaged = app.isPackaged
    let command: string
    let args: string[] = []
    let logMessage: string

    if (isPackaged) {
      const backendBinaryName = process.platform === 'win32' ? 'copernicus-backend.exe' : 'copernicus-backend';
      const backendBinaryPath = path.join(process.resourcesPath, backendBinaryName);

      if (fs.existsSync(backendBinaryPath)) {
        command = backendBinaryPath;
        logMessage = `[BackendManager] Starting packaged backend binary: ${backendBinaryPath}`;
        // On macOS/Linux, ensure the binary is executable
        if (process.platform !== 'win32') {
          try {
            fs.chmodSync(backendBinaryPath, '755');
          } catch (e) {
            log.error(`[BackendManager] Failed to chmod backend binary: ${(e as Error).message}`);
          }
        }
      } else {
        // Fallback for development or if binary isn't found in packaged app (shouldn't happen in a proper build)
        const appPath = app.getAppPath();
        const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
        command = pythonPath;
        args.push(path.join(appPath, '..', 'backend', 'app.py'));
        logMessage = `[BackendManager] Packaged app: Backend binary not found, falling back to script: ${command} ${args[0]}`;
      }
    } else {
      // Development mode
      const appPath = app.getAppPath();
      const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
      command = pythonPath;
      args.push(path.join(appPath, '..', 'backend', 'app.py'));
      logMessage = `[BackendManager] Starting development backend script: ${command} ${args[0]}`;
    }

    log.info(logMessage);

    this.process = spawn(command, args, {
      env: {
        ...process.env,
        FLASK_ENV: isPackaged ? 'production' : 'development',
        COPERNICUS_BACKEND_PORT: this.port.toString(), // Ensure the spawned process gets the port
        // PYTHONPATH is not needed for binary, but keep for script fallback
        PYTHONPATH: isPackaged && !args.length ? undefined : path.join(app.getAppPath(), '..')
      },
      stdio: 'pipe'
    })

    this.process.stdout?.on('data', (data) => {
      log.info(`[Backend stdout] ${data.toString().trim()}`)
    })

    this.process.stderr?.on('data', (data) => {
      const msg = data.toString().trim()
      if (msg.includes('Error') || msg.includes('Exception')) {
        log.error(`[Backend stderr] ${msg}`)
      } else {
        log.info(`[Backend info] ${msg}`)
      }
    })

    this.process.on('close', (code) => {
      // Only log exit if it was a process we managed
      if (this.process !== null) {
        log.info(`[BackendManager] Flask backend exited with code ${code}`);
      }
      this.process = null
    })

    this.process.on('error', (err) => {
      log.error(`[BackendManager] Failed to start backend: ${err.message}`)
      this.process = null; // Ensure process is null on error
    })
  }

  stop(): void {
    if (this.process) { // Only kill if we actually spawned and manage this process
      log.info('[BackendManager] Stopping Flask backend...')
      this.process.kill()
      this.process = null
    }
  }

  getPort(): number {
    return this.port
  }
}

export const backendManager = new BackendManager()
