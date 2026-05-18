import log from '../utils/logger'
import {
  LoadedExtension,
  WorkflowNodeDefinition,
  TileDefinition,
  ProviderDefinition,
  ViewDefinition,
} from './types'
import { NodeExecutor, CopernicusExtensionAPI } from './api'

export class ExtensionRegistry implements CopernicusExtensionAPI {
  private static readonly MAX_EXTENSIONS = 100
  private static instance: ExtensionRegistry
  private extensions: Map<string, LoadedExtension> = new Map()
  private workflowNodes: Map<string, WorkflowNodeDefinition & { execute?: NodeExecutor }> = new Map()
  private tiles: Map<string, TileDefinition> = new Map()
  private providers: Map<string, ProviderDefinition> = new Map()
  private views: Map<string, ViewDefinition> = new Map()
  private nodeExecutors: Map<string, NodeExecutor> = new Map()
  private registeredBy: Map<string, string> = new Map()

  private constructor() {}

  public static getInstance(): ExtensionRegistry {
    if (!ExtensionRegistry.instance) {
      ExtensionRegistry.instance = new ExtensionRegistry()
    }
    return ExtensionRegistry.instance
  }

  registerExtension(extension: LoadedExtension): void {
    if (this.extensions.size >= ExtensionRegistry.MAX_EXTENSIONS) {
      const firstKey = this.extensions.keys().next().value
      if (firstKey !== undefined) this.remove(firstKey)
    }
    this.extensions.set(extension.name, extension)
  }

  remove(name: string): void {
    const ext = this.extensions.get(name)
    if (!ext) return
    this.extensions.delete(name)
    // Clean up all registrations tied to this extension
    for (const [key, owner] of this.registeredBy.entries()) {
      if (owner === name) {
        this.workflowNodes.delete(key)
        this.tiles.delete(key)
        this.providers.delete(key)
        this.views.delete(key)
        this.nodeExecutors.delete(key)
        this.registeredBy.delete(key)
      }
    }
    log.info(`Extension "${name}" removed from registry`)
  }

  async registerWorkflowNode(def: WorkflowNodeDefinition & { execute?: NodeExecutor }, extensionName?: string): Promise<void> {
    this.workflowNodes.set(def.type, def)
    if (def.execute) {
      this.nodeExecutors.set(def.type, def.execute)
    }
    if (extensionName) this.registeredBy.set(def.type, extensionName)
  }

  async registerTile(def: TileDefinition, extensionName?: string): Promise<void> {
    this.tiles.set(def.id, def)
    if (extensionName) this.registeredBy.set(def.id, extensionName)
  }

  async registerProvider(def: ProviderDefinition, extensionName?: string): Promise<void> {
    this.providers.set(def.id, def)
    if (extensionName) this.registeredBy.set(def.id, extensionName)
  }

  async registerView(def: ViewDefinition, extensionName?: string): Promise<void> {
    this.views.set(def.id, def)
    if (extensionName) this.registeredBy.set(def.id, extensionName)
    log.info(`View ${def.id} registered`)
  }

  // FS mock to satisfy the API
  fs = {
    readFile: async (_path: string): Promise<string> => {
      throw new Error('Not implemented on main process directly yet')
    },
    writeFile: async (_path: string, _content: string): Promise<void> => {
      throw new Error('Not implemented on main process directly yet')
    }
  }

  // HTTP mock to satisfy the API
  http = {
    get: async (_url: string): Promise<string> => {
      throw new Error('Not implemented on main process directly yet')
    },
    post: async (_url: string, _body: string): Promise<string> => {
      throw new Error('Not implemented on main process directly yet')
    }
  }

  getExtensions(): LoadedExtension[] {
    return Array.from(this.extensions.values())
  }

  getWorkflowNodes(): (WorkflowNodeDefinition & { execute?: NodeExecutor })[] {
    return Array.from(this.workflowNodes.values())
  }

  getTiles(): TileDefinition[] {
    return Array.from(this.tiles.values())
  }

  getProviders(): ProviderDefinition[] {
    return Array.from(this.providers.values())
  }

  getViews(): ViewDefinition[] {
    return Array.from(this.views.values())
  }

  getNodeExecutor(type: string): NodeExecutor | undefined {
    return this.nodeExecutors.get(type)
  }

  clear(): void {
    this.extensions.clear()
    this.workflowNodes.clear()
    this.tiles.clear()
    this.providers.clear()
    this.views.clear()
    this.nodeExecutors.clear()
    this.registeredBy.clear()
  }
}
