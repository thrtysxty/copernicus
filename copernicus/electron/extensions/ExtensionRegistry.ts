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

  registerWorkflowNode(def: WorkflowNodeDefinition & { execute?: NodeExecutor }): void {
    this.workflowNodes.set(def.type, def)
    if (def.execute) {
      this.nodeExecutors.set(def.type, def.execute)
    }
  }

  registerTile(def: TileDefinition): void {
    this.tiles.set(def.id, def)
  }

  registerProvider(def: ProviderDefinition): void {
    this.providers.set(def.id, def)
  }

  registerView(def: ViewDefinition): void {
    // TODO: Implement view registration
    console.log(`View ${def.id} registered (not yet implemented)`)
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

  getNodeExecutor(type: string): NodeExecutor | undefined {
    return this.nodeExecutors.get(type)
  }

  clear(): void {
    this.extensions.clear()
    this.workflowNodes.clear()
    this.tiles.clear()
    this.providers.clear()
    this.nodeExecutors.clear()
  }
}
