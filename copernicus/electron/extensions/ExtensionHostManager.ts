import { ChildProcess, fork } from 'node:child_process'
import path from 'node:path'
import log from 'electron-log'
import { EventEmitter } from 'node:events'

export class ExtensionHostManager extends EventEmitter {
  private child: ChildProcess | null = null
  private crashCount = 0
  private lastCrashTime = 0

  start(): void {
    this.spawnHost()
  }

  stop(): void {
    if (this.child) {
      this.child.kill()
      this.child = null
    }
  }

  private spawnHost(): void {
    const hostPath = path.join(__dirname, 'host', 'index.js')

    log.info('[ExtensionHostManager] Spawning extension host process...')

    this.child = fork(hostPath, [], {
      stdio: ['ignore', 'pipe', 'pipe', 'ipc']
    })

    if (this.child.stdout) {
      this.child.stdout.on('data', (data) => {
        log.info(`[ExtensionHost] ${data.toString().trim()}`)
      })
    }

    if (this.child.stderr) {
      this.child.stderr.on('data', (data) => {
        log.error(`[ExtensionHost] ${data.toString().trim()}`)
      })
    }

    this.child.on('message', (msg) => {
      // Stub: handle messages
      log.info('[ExtensionHostManager] Received message from host:', msg)
    })

    this.child.on('exit', (code, signal) => {
      log.warn(`[ExtensionHostManager] Host process exited with code ${code} signal ${signal}`)
      this.child = null
      this.handleCrash()
    })
  }

  private handleCrash(): void {
    const now = Date.now()
    if (now - this.lastCrashTime > 10000) {
      // Reset crash count if it's been more than 10 seconds since the last crash
      this.crashCount = 0
    }

    this.crashCount++
    this.lastCrashTime = now

    if (this.crashCount > 3) {
      log.error('[ExtensionHostManager] Extension host crashed 3 times in 10 seconds. Stopping restarts.')
      this.emit('host-crashed')
      return
    }

    setTimeout(() => {
      log.info(`[ExtensionHostManager] Restarting host (attempt ${this.crashCount})...`)
      this.spawnHost()
    }, 500)
  }
}
