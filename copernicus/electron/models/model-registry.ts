export interface ModelConfig {
  id: string; // e.g. 'gpt-4', 'claude-3-opus'
  name: string;
  provider: string; // 'openai', 'anthropic', 'openrouter', 'deepinfra', 'google', 'ollama'
  contextWindow: number;
  costPer1kIn?: number;  // USD per 1k input tokens
  costPer1kOut?: number; // USD per 1k output tokens
}

export class ModelRegistry {
  private models: Map<string, ModelConfig> = new Map();
  private activeModelId: string = 'claude-3-5-sonnet-20240620'; // Default fallback

  constructor() {
    // Start async fetch from registry, while keeping defaults as synchronous fallback
    this.fetchRegistry().catch(() => {});

    // Register default models with pricing (USD per 1k tokens)
    this.registerModel({ id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', contextWindow: 16385, costPer1kIn: 0.0005, costPer1kOut: 0.0015 });
    this.registerModel({ id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', contextWindow: 128000, costPer1kIn: 0.010, costPer1kOut: 0.030 });
    this.registerModel({ id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet', provider: 'anthropic', contextWindow: 200000, costPer1kIn: 0.003, costPer1kOut: 0.015 });
    this.registerModel({ id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic', contextWindow: 200000, costPer1kIn: 0.015, costPer1kOut: 0.075 });
    this.registerModel({ id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', provider: 'anthropic', contextWindow: 200000, costPer1kIn: 0.003, costPer1kOut: 0.015 });

    // Google / Gemini
    this.registerModel({ id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google', contextWindow: 1000000, costPer1kIn: 0.0035, costPer1kOut: 0.0105 });
    this.registerModel({ id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'google', contextWindow: 1000000, costPer1kIn: 0.000075, costPer1kOut: 0.0003 });

    // OpenRouter examples (free tier pricing; actual cost varies by underlying model)
    this.registerModel({ id: 'openrouter/google/gemini-pro', name: 'Gemini Pro (OpenRouter)', provider: 'openrouter', contextWindow: 32000 });
    this.registerModel({ id: 'openrouter/mistralai/mistral-7b-instruct', name: 'Mistral 7B (OpenRouter)', provider: 'openrouter', contextWindow: 32000 });

    // Ollama Cloud
    this.registerModel({ id: 'deepseek-v3.2:cloud', name: 'DeepSeek V3.2 (Cloud)', provider: 'ollama', contextWindow: 128000, costPer1kIn: 0.00014, costPer1kOut: 0.00028 });
    this.registerModel({ id: 'devstral-2:cloud', name: 'Devstral 2 (Cloud)', provider: 'ollama', contextWindow: 128000, costPer1kIn: 0.00012, costPer1kOut: 0.00024 });
    this.registerModel({ id: 'glm-5:744b-cloud', name: 'GLM-5 (Cloud)', provider: 'ollama', contextWindow: 128000, costPer1kIn: 0.003, costPer1kOut: 0.009 });
    this.registerModel({ id: 'minimax-m2.5:cloud', name: 'MiniMax M2.5 (Cloud)', provider: 'ollama', contextWindow: 128000, costPer1kIn: 0.002, costPer1kOut: 0.006 });
    this.registerModel({ id: 'gpt-oss:20b-cloud', name: 'GPT-OSS 20B (Cloud)', provider: 'ollama', contextWindow: 32000, costPer1kIn: 0.0002, costPer1kOut: 0.0006 });

    // DeepInfra examples
    this.registerModel({ id: 'deepinfra/meta-llama/Llama-2-70b-chat-hf', name: 'Llama 2 70b (DeepInfra)', provider: 'deepinfra', contextWindow: 4096 });
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
