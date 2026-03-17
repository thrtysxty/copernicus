export interface CopernicusManifest {
  displayName: string
  description?: string
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
