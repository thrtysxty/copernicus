import { ExtensionActivationBus } from './ExtensionActivationBus'
import { ChildProcess, fork } from 'node:child_process'
import path from 'node:path'
import log from 'electron-log'
import { EventEmitter } from 'node:events'
import { ExtensionTrustStore } from './ExtensionTrustStore'
import { CopernicusManifest, WorkflowNodeDefinition, TileDefinition, ProviderDefinition, ViewDefinition } from './types'
import { BrowserWindow } from 'electron'
import { ExtensionRegistry } from './ExtensionRegistry'
import { ApiCallRequestMessage, ApiCallResultMessage } from './ExtensionHostProtocol'
import { randomUUID } from 'node:crypto'

export class ExtensionHostManager extends EventEmitter {
  private child: ChildProcess | null = null
  private crashCount = 0
  private lastCrashTime = 0
  private trustStore = new ExtensionTrustStore()
  private pendingApprovals = new Map<string, (approved: boolean) => void>()
  public activationBus: ExtensionActivationBus;

  constructor(private registry: ExtensionRegistry) {
    super()
    this.activationBus = new ExtensionActivationBus(this)
  }

  resolveApproval(id: string, approved: boolean): void {
    const resolver = this.pendingApprovals.get(id)
    if (resolver) {
      resolver(approved)
      this.pendingApprovals.delete(id)
    }
  }

  start(): void {
    this.spawnHost()
    // Fire wildcard activation events on startup for backward compat
    setTimeout(() => this.activationBus.fire('*'), 500)
  }

  stop(): void {
    if (this.child) {
      this.child.kill()
      this.child = null
    }
  }

  async activateExtension(extensionName: string, displayName: string, capabilities: CopernicusManifest['capabilities'], extensionPath: string, forceActivate: boolean = false): Promise<void> {
    if (!forceActivate) {
      try {
        const pkg = require(path.join(extensionPath, 'package.json'));
        const events = pkg.copernicus?.activationEvents || [];
        this.activationBus.register(extensionPath, extensionName, displayName, capabilities, events);
      } catch (e) {
        log.warn(`[ExtensionHostManager] Failed to read package.json for ${extensionName}`, e);
      }
      return;
    }

    const hasCapabilities = capabilities && Object.keys(capabilities).length > 0

    if (hasCapabilities && !this.trustStore.isTrusted(extensionName)) {
      const win = BrowserWindow.getAllWindows()[0]
      if (!win) {
        log.warn(`[ExtensionHostManager] No window available to prompt for extension ${extensionName}`)
        return
      }

      const requestId = randomUUID()

      const approved = await new Promise<boolean>((resolve) => {
        this.pendingApprovals.set(requestId, resolve)
        win.webContents.send('extension:request-approval', {
          id: requestId,
          extensionName,
          displayName,
          capabilities
        })
      })

      if (!approved) {
        log.warn(`[ExtensionHostManager] User denied capabilities for extension ${extensionName}`)
        return
      }

      this.trustStore.approve(extensionName, capabilities)
    }

    if (this.child) {
      this.child.send({
        jsonrpc: '2.0',
        method: 'extension/activate',
        params: { extensionPath, approvedCapabilities: hasCapabilities ? capabilities : undefined }
      })
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

    this.child.on('message', async (msg: any) => {
      if (msg && msg.method === 'api/call') {
        const req = msg as ApiCallRequestMessage
        try {
          const { method, args } = req.params
          let result: any

          if (method === 'registerWorkflowNode') {
            await this.registry.registerWorkflowNode(args[0] as WorkflowNodeDefinition)
          } else if (method === 'registerTile') {
            await this.registry.registerTile(args[0] as TileDefinition)
          } else if (method === 'registerProvider') {
            await this.registry.registerProvider(args[0] as ProviderDefinition)
          } else if (method === 'registerView') {
            await this.registry.registerView(args[0] as ViewDefinition)
          } else if (method === 'fs.readFile') {
            result = await this.registry.fs.readFile(args[0] as string)
          } else if (method === 'fs.writeFile') {
            await this.registry.fs.writeFile(args[0] as string, args[1] as string)
          } else if (method === 'http.get') {
            result = await this.registry.http.get(args[0] as string)
          } else if (method === 'http.post') {
            result = await this.registry.http.post(args[0] as string, args[1] as string)
          } else {
            throw new Error(`Unknown API method: ${method}`)
          }

          const response: ApiCallResultMessage = {
            jsonrpc: '2.0',
            method: 'api/result',
            id: req.id,
            result
          }
          this.child?.send(response)
        } catch (e: any) {
          const response: ApiCallResultMessage = {
            jsonrpc: '2.0',
            method: 'api/result',
            id: req.id,
            error: e.message || String(e)
          }
          this.child?.send(response)
        }
      } else {
        log.info('[ExtensionHostManager] Received message from host:', msg)
      }
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
