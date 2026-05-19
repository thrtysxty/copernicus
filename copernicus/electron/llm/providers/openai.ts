import OpenAI from 'openai'
import { authManager } from '../../auth-manager'

export interface OpenAIModel {
  id: string
  name: string
  contextLength: number
}

function getClient(): OpenAI {
  const authInfo = authManager.resolveForProvider('openai')
  if (!authInfo || !authInfo.key) throw new Error('OpenAI API key not configured')
  return new OpenAI({ apiKey: authInfo.key })
}

export async function listOpenAIModels(): Promise<OpenAIModel[]> {
  const client = getClient()
  const response = await client.models.list()

  const models: OpenAIModel[] = []
  for await (const model of response) {
    // Skip embedding, TTS, Whisper, DALL-E, and fine-tune models
    const id = model.id
    if (id.startsWith('text-embedding') || id.startsWith('dall-e') || id.startsWith('whisper') || id.startsWith('tts') || id.includes('ft:')) continue
    models.push({
      id,
      name: id,
      contextLength: 128000 // Default; OpenAI doesn't return context length in list
    })
  }
  return models
}
