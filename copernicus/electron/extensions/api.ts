import type { WorkflowNodeDefinition, TileDefinition, ProviderDefinition, ViewDefinition } from './types'

export type NodeExecutor = (config: Record<string, string>, context: Record<string, string>) => Promise<string>

export interface CopernicusExtensionAPI {
  registerWorkflowNode(def: WorkflowNodeDefinition & { execute?: NodeExecutor }): void
  registerTile(def: TileDefinition): void
  registerProvider(def: ProviderDefinition): void
  registerView(def: ViewDefinition): void
}
