import log from 'electron-log'
export interface ModelConfig {
  id: string; // e.g. 'gpt-4', 'claude-3-opus'
  name: string;
  provider: string; // 'openai', 'anthropic', 'openrouter', 'deepinfra', 'google', 'ollama'
  contextWindow: number;
  costPer1kIn?: number;  // USD per 1k input tokens
  costPer1kOut?: number; // USD per 1k output tokens
  supportsVision?: boolean;
}

export class ModelRegistry {
  private models: Map<string, ModelConfig> = new Map();
  private activeModelId: string = 'claude-3-5-sonnet-20240620'; // Default fallback

  constructor() {
    this.fetchRegistry()
      .then(() => this.fetchNotebookLMModels())
      .catch(err => log.error(err));
  }

  public async fetchNotebookLMModels() {
    try {
      const response = await fetch('http://localhost:5001/api/notebooklm/notebooks');
      if (!response.ok) return;
      const data = await response.json() as any[];
      if (Array.isArray(data)) {
        data.forEach(notebook => {
          this.registerModel({
            id: `notebooklm:${notebook.id}`,
            name: `NbLM — ${notebook.title}`,
            provider: 'google',
            contextWindow: 0,
            supportsVision: false
          });
        });
      }
    } catch (e) {
      // Backend unreachable or credentials not configured, ignore silently
    }
  }

  private async fetchRegistry() {
    try {
      const response = await fetch('http://localhost:5001/api/registry/models');
      if (!response.ok) return;
      const data = await response.json() as any[];
      if (Array.isArray(data)) {
        data.forEach(m => {
          this.registerModel({
            id: m.id,
            name: m.displayName || m.name,
            provider: m.provider,
            contextWindow: m.contextWindow,
            costPer1kIn: m.costPer1kTokens || 0,
            costPer1kOut: m.costPer1kTokens || 0
          });
        });
      }
    } catch (e) {
      // Backend unreachable, fallback already initialized
    }
  }

  registerModel(config: ModelConfig) {
    this.models.set(config.id, config);
  }

  getModels(): ModelConfig[] {
    return Array.from(this.models.values());
  }

  getActiveModel(): ModelConfig | undefined {
    return this.models.get(this.activeModelId);
  }

  getFastModel(): ModelConfig {
    // Prefer Claude 3.5 Haiku, fallback to Claude 3 Haiku or any other small model
    const m = this.models.get('claude-3-5-haiku-20241022') ||
              this.models.get('claude-3-haiku-20240307') ||
              this.models.get('gpt-4o-mini');
    if (m) return m;
    
    // If not found, return whatever is first or default
    return Array.from(this.models.values())[0] || {
      id: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku',
      provider: 'anthropic',
      contextWindow: 200000
    };
  }

  setActiveModel(id: string): boolean {
    if (this.models.has(id)) {
      this.activeModelId = id;
      return true;
    }
    return false;
  }

  calculateCost(modelId: string, tokensIn: number, tokensOut: number): number {
    const model = this.models.get(modelId)
    if (!model) return 0
    const costIn  = ((model.costPer1kIn  ?? 0) / 1000) * tokensIn
    const costOut = ((model.costPer1kOut ?? 0) / 1000) * tokensOut
    return Math.round((costIn + costOut) * 1_000_000) / 1_000_000
  }
}

export const modelRegistry = new ModelRegistry();
