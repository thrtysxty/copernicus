// Define minimal types needed for the shim to avoid depending on the main app's internal paths

export type NodeExecutor = (config: Record<string, string>, context: Record<string, string>) => Promise<string>

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

export interface CopernicusExtensionAPI_v2 {
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

export interface V1CompatAPI {
  registerWorkflowNode(def: WorkflowNodeDefinition & { execute?: NodeExecutor }): void;
  registerTile(def: TileDefinition): void;
  registerProvider(def: ProviderDefinition): void;
  registerView(def: ViewDefinition): void;

  fs: {
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
  };
  http: {
    get(url: string): Promise<string>;
    post(url: string, body: string): Promise<string>;
  };
}

export function wrapV2Api(api: CopernicusExtensionAPI_v2): V1CompatAPI {
  return {
    registerWorkflowNode: (def) => {
      api.registerWorkflowNode(def).catch(() => {});
    },
    registerTile: (def) => {
      api.registerTile(def).catch(() => {});
    },
    registerProvider: (def) => {
      api.registerProvider(def).catch(() => {});
    },
    registerView: (def) => {
      api.registerView(def).catch(() => {});
    },
    fs: api.fs,
    http: api.http
  };
}
