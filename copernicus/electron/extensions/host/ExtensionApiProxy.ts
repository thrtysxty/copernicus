import log from '../../utils/logger'
import { CopernicusExtensionAPI, NodeExecutor } from '../api'
import { CopernicusManifest, WorkflowNodeDefinition, TileDefinition, ProviderDefinition, ViewDefinition } from '../types'
import { ApiCallRequestMessage } from '../ExtensionHostProtocol'

export class CapabilityDeniedError extends Error {
  constructor(capability: string) {
    super(`Extension requires capability '${capability}' — not declared in manifest`)
    this.name = 'CapabilityDeniedError'
  }
}

export class ExtensionApiProxy implements CopernicusExtensionAPI {
  private messageIdCounter = 0
  private pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>()

  constructor(
    private capabilities: NonNullable<CopernicusManifest['capabilities']> = {},
    private approvedCapabilities?: NonNullable<CopernicusManifest['capabilities']>
  ) {
    process.on('message', (msg: any) => {
      if (msg && msg.method === 'api/result' && msg.id) {
        const req = this.pendingRequests.get(msg.id)
        if (req) {
          if (msg.error) {
            req.reject(new Error(msg.error))
          } else {
            req.resolve(msg.result)
          }
          this.pendingRequests.delete(msg.id)
        }
      }
    })
  }

  private async rpcCall(method: string, ...args: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = String(++this.messageIdCounter)

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`RPC call to '${method}' timed out after 30000ms`))
      }, 30000)

      this.pendingRequests.set(id, {
          resolve: (val) => { clearTimeout(timeout); resolve(val) },
          reject: (err) => { clearTimeout(timeout); reject(err) }
      })

      const msg: ApiCallRequestMessage = {
        jsonrpc: '2.0',
        method: 'api/call',
        id,
        params: { method, args }
      }

      if (process.send) {
        process.send(msg)
      } else {
        clearTimeout(timeout)
        this.pendingRequests.delete(id)
        reject(new Error('process.send is undefined — not running as a child process'))
      }
    })
  }

  async registerWorkflowNode(def: WorkflowNodeDefinition & { execute?: NodeExecutor }): Promise<void> {
    // Note: NodeExecutor functions can't be easily sent over JSON-RPC, we'd need a callback mechanism or proxy.
    // For now, we strip it out and warn if present, or we could handle it via a reverse RPC call later.
    const { execute, ...serializableDef } = def
    if (execute) {
      log.warn('NodeExecutor is not yet supported in extension host proxy')
    }
    await this.rpcCall('registerWorkflowNode', serializableDef)
  }

  async registerTile(def: TileDefinition): Promise<void> {
    await this.rpcCall('registerTile', def)
  }

  async registerProvider(def: ProviderDefinition): Promise<void> {
    await this.rpcCall('registerProvider', def)
  }

  async registerView(def: ViewDefinition): Promise<void> {
    await this.rpcCall('registerView', def)
  }

  private checkCapability(cap: keyof NonNullable<CopernicusManifest['capabilities']>, level?: string) {
      if (!this.capabilities?.[cap]) {
          throw new CapabilityDeniedError(cap)
      }

      // If approved capabilities were passed, we must verify they are within the approved set
      if (this.approvedCapabilities && !this.approvedCapabilities[cap]) {
          throw new CapabilityDeniedError(cap)
      }

      // If a specific level is required (e.g. read-write), verify that the provided level meets it.
      // E.g., if filesystem capability is just `true` or `'read'`, it shouldn't satisfy `'read-write'`.
      if (level) {
          const capValue = this.capabilities[cap]
          if (capValue !== level) {
              throw new CapabilityDeniedError(cap) // Does not meet level requirement
          }

          if (this.approvedCapabilities) {
              const approvedValue = this.approvedCapabilities[cap]
              if (approvedValue !== level) {
                  throw new CapabilityDeniedError(cap)
              }
          }
      }
  }

  fs = {
    readFile: async (path: string): Promise<string> => {
      this.checkCapability('filesystem')
      return this.rpcCall('fs.readFile', path)
    },
    writeFile: async (path: string, content: string): Promise<void> => {
      this.checkCapability('filesystem', 'read-write')
      return this.rpcCall('fs.writeFile', path, content)
    }
  }

  http = {
    get: async (url: string): Promise<string> => {
      this.checkCapability('network')
      return this.rpcCall('http.get', url)
    },
    post: async (url: string, body: string): Promise<string> => {
      this.checkCapability('network')
      return this.rpcCall('http.post', url, body)
    }
  }
}
