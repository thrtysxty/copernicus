import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'
import log from 'electron-log'
import { app } from 'electron'

export class BackendManager {
  private process: ChildProcess | null = null
  private port: number = 5001

  async start(): Promise<void> {
    if (this.process) return

    // Find the backend entry point relative to the app path
    // In dev: project_root/backend/app.py
    // In prod: app.getAppPath()/backend/app.py (if bundled)
    const isPackaged = app.isPackaged
    const backendPath = isPackaged 
      ? path.join(process.resourcesPath, 'backend', 'app.py')
      : path.join(app.getAppPath(), '..', 'backend', 'app.py')

    if (!fs.existsSync(backendPath)) {
      log.warn(`[BackendManager] Backend not found at ${backendPath}. Assuming external process or skipping.`)
      return
    }

    log.info(`[BackendManager] Starting Flask backend: python3 ${backendPath}`)

    this.process = spawn('python3', [backendPath], {
      env: {
        ...process.env,
        FLASK_ENV: isPackaged ? 'production' : 'development',
        PYTHONPATH: path.join(app.getAppPath(), '..')
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
      log.info(`[BackendManager] Flask backend exited with code ${code}`)
      this.process = null
    })

    this.process.on('error', (err) => {
      log.error(`[BackendManager] Failed to start backend: ${err.message}`)
    })
  }

  stop(): void {
    if (this.process) {
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
