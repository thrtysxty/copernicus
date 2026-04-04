import { OpenRouter } from '@openrouter/sdk'
import { authManager } from '../../auth-manager'

export interface OpenRouterModel {
  id: string
  name: string
  contextLength: number
  pricing: { prompt: number; completion: number }
}

export interface CallOpenRouterOpts {
  model: string
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  maxTokens?: number
  temperature?: number
}

function getClient(): OpenRouter {
  const authInfo = authManager.resolveForProvider('openrouter')
  if (!authInfo || !authInfo.key) throw new Error('OpenRouter API key not configured')
  return new OpenRouter({
    apiKey: authInfo.key,
    httpReferer: 'https://copernicus.app',
    appTitle: 'COPERNICUS IDE',
  })
}

export async function listOpenRouterModels(): Promise<OpenRouterModel[]> {
  const client = getClient()
  const response = await client.models.list()

  if (!response.data || !Array.isArray(response.data)) {
    throw new Error('Failed to fetch OpenRouter models')
  }

  return response.data.map(model => ({
    id: model.id,
    name: model.name || model.id,
    contextLength: model.contextLength || 0,
    pricing: {
      prompt: parseFloat(model.pricing.prompt) || 0,
      completion: parseFloat(model.pricing.completion) || 0
    }
  }))
}

export async function getOpenRouterCredits(): Promise<number> {
  const client = getClient()
  const response = await client.credits.getCredits()

  if (!response.data) {
    throw new Error('Failed to fetch OpenRouter credits')
  }

  return response.data.totalCredits - response.data.totalUsage
}

export async function callOpenRouter(opts: CallOpenRouterOpts): Promise<string> {
  const client = getClient()

  // Create an explicit input object to bypass the deep type checking limitations,
  // matching the general shape of OpenRouter's CallModelInput structure.
  const inputPayload = {
    model: opts.model,
    input: opts.messages,
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
  } as unknown as Parameters<typeof client.callModel>[0];

  const response = client.callModel(inputPayload)
  return response.getText()
}

export async function* streamOpenRouter(opts: CallOpenRouterOpts): AsyncGenerator<string> {
  const client = getClient()

  const inputPayload = {
    model: opts.model,
    input: opts.messages,
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
  } as unknown as Parameters<typeof client.callModel>[0];

  const response = client.callModel(inputPayload)
  for await (const chunk of response.getTextStream()) {
    yield chunk
  }
}
