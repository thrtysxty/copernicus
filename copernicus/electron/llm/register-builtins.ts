// Story 626 — Provider Registry: Built-in Provider Registration
// STUB: Full implementation delivered by Jules

import { providerRegistry } from './provider-registry'
import { authManager } from '../auth-manager'
import { listOpenRouterModels } from './providers/openrouter'

export function registerBuiltinProviders(): void {
  // OpenRouter
  providerRegistry.register({
    id: 'openrouter',
    displayName: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    resolveKey: () => authManager.resolveForProvider('openrouter')?.key || null,
    listModels: async () => {
      const models = await listOpenRouterModels()
      return models.map(m => ({
        id: m.id,
        name: m.name,
        contextLength: m.contextLength,
        supportsToolCalling: true, // Note: varies by model, treating as true for now per instructions
        pricing: {
          promptPer1M: m.pricing.prompt * 1000000,
          completionPer1M: m.pricing.completion * 1000000
        }
      }))
    },
    supportsToolCalling: true,
    oauthChannel: 'oauth:start-openrouter'
  })

  // Ollama
  providerRegistry.register({
    id: 'ollama',
    displayName: 'Ollama',
    baseUrl: 'http://localhost:11434',
    resolveKey: () => authManager.resolveForProvider('ollama')?.key || null,
    listModels: async () => {
      try {
        const res = await fetch('http://localhost:11434/api/tags', {
          signal: AbortSignal.timeout(2000),
        })
        if (!res.ok) return []
        const data = await res.json()
        if (!data.models || !Array.isArray(data.models)) return []
        return data.models.map((m: any) => ({
          id: m.name,
          name: m.name,
          contextLength: 8192, // Default context length assumption
          supportsToolCalling: false // Default to false for basic Ollama
        }))
      } catch (e) {
        return []
      }
    },
    supportsToolCalling: false
  })
}
