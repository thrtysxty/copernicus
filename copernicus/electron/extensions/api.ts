import type { WorkflowNodeDefinition, TileDefinition, ProviderDefinition, ViewDefinition } from './types'

export type NodeExecutor = (config: Record<string, string>, context: Record<string, string>) => Promise<string>

export interface CopernicusExtensionAPI {
  registerWorkflowNode(def: WorkflowNodeDefinition & { execute?: NodeExecutor }): Promise<void>
  registerTile(def: TileDefinition): Promise<void>
  registerProvider(def: ProviderDefinition): Promise<void>
  registerView(def: ViewDefinition): Promise<void>

  fs: {
    readFile(path: string): Promise<string>
    writeFile(path: string, content: string): Promise<void>
  }
  http: {
    get(url: string): Promise<string>
    post(url: string, body: string): Promise<string>
  }
}
