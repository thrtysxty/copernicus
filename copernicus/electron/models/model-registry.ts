export interface ModelConfig {
  id: string; // e.g. 'gpt-4', 'claude-3-opus'
  name: string;
  provider: string; // 'openai', 'anthropic', 'openrouter', 'deepinfra'
  contextWindow: number;
}

export class ModelRegistry {
  private models: Map<string, ModelConfig> = new Map();
  private activeModelId: string = 'gpt-3.5-turbo'; // Default fallback

  constructor() {
    // Register default models
    this.registerModel({ id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', contextWindow: 16385 });
    this.registerModel({ id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', contextWindow: 128000 });
    this.registerModel({ id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic', contextWindow: 200000 });
    this.registerModel({ id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', provider: 'anthropic', contextWindow: 200000 });
    
    // OpenRouter examples
    this.registerModel({ id: 'openrouter/google/gemini-pro', name: 'Gemini Pro (OpenRouter)', provider: 'openrouter', contextWindow: 32000 });
    this.registerModel({ id: 'openrouter/mistralai/mistral-7b-instruct', name: 'Mistral 7B (OpenRouter)', provider: 'openrouter', contextWindow: 32000 });
    
    // DeepInfra examples
    this.registerModel({ id: 'deepinfra/meta-llama/Llama-2-70b-chat-hf', name: 'Llama 2 70b (DeepInfra)', provider: 'deepinfra', contextWindow: 4096 });
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

  setActiveModel(id: string): boolean {
    if (this.models.has(id)) {
      this.activeModelId = id;
      return true;
    }
    return false;
  }
}
