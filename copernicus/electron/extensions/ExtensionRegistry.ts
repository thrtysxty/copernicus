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
  private static instance: ExtensionRegistry
  private extensions: Map<string, LoadedExtension> = new Map()
  private workflowNodes: Map<string, WorkflowNodeDefinition & { execute?: NodeExecutor }> = new Map()
  private tiles: Map<string, TileDefinition> = new Map()
  private providers: Map<string, ProviderDefinition> = new Map()
  private views: Map<string, ViewDefinition> = new Map()
  private nodeExecutors: Map<string, NodeExecutor> = new Map()

  private constructor() {}

  public static getInstance(): ExtensionRegistry {
    if (!ExtensionRegistry.instance) {
      ExtensionRegistry.instance = new ExtensionRegistry()
    }
    return ExtensionRegistry.instance
  }

  registerExtension(extension: LoadedExtension): void {
    this.extensions.set(extension.name, extension)
  }

  async registerWorkflowNode(def: WorkflowNodeDefinition & { execute?: NodeExecutor }): Promise<void> {
    this.workflowNodes.set(def.type, def)
    if (def.execute) {
      this.nodeExecutors.set(def.type, def.execute)
    }
  }

  async registerTile(def: TileDefinition): Promise<void> {
    this.tiles.set(def.id, def)
  }

  async registerProvider(def: ProviderDefinition): Promise<void> {
    this.providers.set(def.id, def)
  }

  async registerView(def: ViewDefinition): Promise<void> {
    this.views.set(def.id, def)
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
  }
}
