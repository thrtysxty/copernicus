export interface CopernicusManifest {
  displayName: string
  description?: string
  capabilities?: {
    filesystem?: 'read' | 'read-write'
    network?: boolean
    subprocess?: boolean
  }
  activationEvents?: string[]
  contributes?: {
    workflowNodes?: WorkflowNodeDefinition[]
    tiles?: TileDefinition[]
    providers?: ProviderDefinition[]
    views?: ViewDefinition[]
  }
}

export interface WorkflowNodeDefinition {
  type: string
  label: string
  category?: string
  configSchema: Array<{ key: string; label: string; type: 'text' | 'select' | 'textarea'; options?: string[] }>
  icon?: string
}

export interface TileDefinition {
  id: string
  label: string
  category: string
  icon?: string
  configSchema: Array<{ key: string; label: string; type: 'text' | 'select'; options?: string[] }>
}

export interface ProviderDefinition {
  id: string
  label: string
  baseUrl: string
  requiresApiKey: boolean
  models: Array<{ id: string; name: string }>
}

export interface ViewDefinition {
  id: string
  label: string
  icon?: string
}

export interface LoadedExtension {
  name: string
  displayName: string
  version: string
  path: string
  manifest: CopernicusManifest
  active: boolean
  error?: string
}

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
