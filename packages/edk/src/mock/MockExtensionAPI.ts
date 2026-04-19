import type {
  CopernicusExtensionAPI,
  WorkflowNodeDefinition,
  TileDefinition,
  ProviderDefinition,
  ViewDefinition,
  NodeExecutor
} from '../types'

export class CapabilityDeniedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CapabilityDeniedError'
  }
}

export class MockExtensionAPI implements CopernicusExtensionAPI {
  public registeredWorkflowNodes: Array<WorkflowNodeDefinition & { execute?: NodeExecutor }> = []
  public registeredTiles: Array<TileDefinition> = []
  public registeredProviders: Array<ProviderDefinition> = []
  public registeredViews: Array<ViewDefinition> = []

  private capabilities: {
    filesystem?: 'read' | 'read-write'
    network?: boolean
  }

  constructor(capabilities: { filesystem?: 'read' | 'read-write'; network?: boolean } = {}) {
    this.capabilities = capabilities
  }

  async registerWorkflowNode(def: WorkflowNodeDefinition & { execute?: NodeExecutor }): Promise<void> {
    this.registeredWorkflowNodes.push(def)
  }

  async registerTile(def: TileDefinition): Promise<void> {
    this.registeredTiles.push(def)
  }

  async registerProvider(def: ProviderDefinition): Promise<void> {
    this.registeredProviders.push(def)
  }

  async registerView(def: ViewDefinition): Promise<void> {
    this.registeredViews.push(def)
  }

  public fs = {
    readFile: async (path: string): Promise<string> => {
      if (!this.capabilities.filesystem) {
        throw new CapabilityDeniedError('Filesystem access not declared in manifest')
      }
      return `mock content of ${path}`
    },
    writeFile: async (path: string, content: string): Promise<void> => {
      if (this.capabilities.filesystem !== 'read-write') {
        throw new CapabilityDeniedError('Filesystem write access not declared in manifest')
      }
      // Mock write
    }
  }

  public http = {
    get: async (url: string): Promise<string> => {
      if (!this.capabilities.network) {
        throw new CapabilityDeniedError('Network access not declared in manifest')
      }
      return `mock response from ${url}`
    },
    post: async (url: string, body: string): Promise<string> => {
      if (!this.capabilities.network) {
        throw new CapabilityDeniedError('Network access not declared in manifest')
      }
      return `mock response from ${url} with ${body}`
    }
  }
}
