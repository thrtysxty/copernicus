import { authManager } from '../../auth-manager'

export interface GoogleModel {
  id: string
  name: string
  contextLength: number
  supportsToolCalling: boolean
}

export async function listGoogleModels(): Promise<GoogleModel[]> {
  const authInfo = authManager.resolveForProvider('google')
  if (!authInfo || !authInfo.key) throw new Error('Google API key not configured')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${authInfo.key}`,
    { signal: AbortSignal.timeout(10000) }
  )
  if (!res.ok) throw new Error(`Google models API failed: ${res.status} ${res.statusText}`)

  const data = await res.json()
  if (!data.models || !Array.isArray(data.models)) return []

  return data.models
    .filter((m: any) => {
      const id = m.name?.replace('models/', '') || ''
      // Skip embedding, image, and TTS models
      return !id.startsWith('text-embedding') &&
             !id.startsWith('imagen') &&
             id !== 'gemini-ultra'
    })
    .map((m: any) => {
      const id = m.name.replace('models/', '')
      return {
        id,
        name: m.displayName || id,
        contextLength: m.inputTokenLimit || 32768,
        supportsToolCalling: id.includes('flash') || id.includes('pro') || id.startsWith('gemini-2')
      }
    })
}
