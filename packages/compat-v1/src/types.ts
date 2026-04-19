export interface WorkflowNodeDefinition {
  type: string;
  label: string;
  category?: string;
  configSchema: Array<{ key: string; label: string; type: 'text' | 'select' | 'textarea'; options?: string[] }>;
  icon?: string;
}

export interface TileDefinition {
  id: string;
  label: string;
  category: string;
  icon?: string;
  configSchema: Array<{ key: string; label: string; type: 'text' | 'select'; options?: string[] }>;
}

export interface ProviderDefinition {
  id: string;
  label: string;
  baseUrl: string;
  requiresApiKey: boolean;
  models: Array<{ id: string; name: string }>;
}

export interface ViewDefinition {
  id: string;
  label: string;
  icon?: string;
}

export type NodeExecutor = (config: Record<string, string>, context: Record<string, string>) => Promise<string>;
