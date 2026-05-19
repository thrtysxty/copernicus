import { config } from '../config'
import { providerRegistry } from './provider-registry'
import { authManager } from '../auth-manager'
import { listOpenRouterModels } from './providers/openrouter'
import { listOpenAIModels } from './providers/openai'
import { listGoogleModels } from './providers/google'

export function registerBuiltinProviders(): void {
  // OpenAI
  providerRegistry.register({
    id: 'openai',
    displayName: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    resolveKey: () => authManager.resolveForProvider('openai')?.key || null,
    listModels: async () => {
      const models = await listOpenAIModels()
      return models.map(m => ({
        id: m.id,
        name: m.name,
        contextLength: m.contextLength,
        supportsToolCalling: true
      }))
    },
    supportsToolCalling: true
  })

  // Google
  providerRegistry.register({
    id: 'google',
    displayName: 'Google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    resolveKey: () => authManager.resolveForProvider('google')?.key || null,
    listModels: async () => {
      const models = await listGoogleModels()
      return models.map(m => ({
        id: m.id,
        name: m.name,
        contextLength: m.contextLength,
        supportsToolCalling: m.supportsToolCalling
      }))
    },
    supportsToolCalling: true
  })

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
        supportsToolCalling: true,
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
    baseUrl: config.ollama.url,
    resolveKey: () => authManager.resolveForProvider('ollama')?.key || null,
    listModels: async () => {
      try {
        const res = await fetch(`${config.ollama.url}/api/tags`, {
          signal: AbortSignal.timeout(2000),
        })
        if (!res.ok) return []
        const data = await res.json()
        if (!data.models || !Array.isArray(data.models)) return []
        return data.models.map((m: any) => ({
          id: m.name,
          name: m.name,
          contextLength: 8192,
          supportsToolCalling: false
        }))
      } catch (e) {
        return []
      }
    },
    supportsToolCalling: false
  })
}
