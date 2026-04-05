import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import log from 'electron-log'

const CACHE_FILE_PATH = path.join(os.homedir(), '.copernicus', 'models-cache.json')
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

interface CacheData {
  timestamp: number
  models: Record<string, string[]>
}

let memoryCache: Record<string, string[]> | null = null

export async function initModelsCache(): Promise<void> {
  const dir = path.dirname(CACHE_FILE_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  let shouldFetch = true
  if (fs.existsSync(CACHE_FILE_PATH)) {
    try {
      const data: CacheData = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf-8'))
      if (Date.now() - data.timestamp < CACHE_TTL_MS) {
        shouldFetch = false
        memoryCache = data.models
      }
    } catch (e) {
      log.warn('Failed to parse models cache, will refetch', e)
    }
  }

  if (shouldFetch) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models')
      if (res.ok) {
        const json = await res.json()
        const models: Record<string, string[]> = {}
        for (const m of json.data || []) {
          // Store supported parameters for each model
          // Determine capabilities based on typical fields if supported_parameters is absent
          models[m.id] = (m.architecture?.supported_parameters || []).concat(
             m.architecture?.tools === true ? ['tools'] : [],
             m.architecture?.reasoning ? ['reasoning'] : [],
             m.architecture?.structured_outputs ? ['structured_outputs'] : []
          )
        }
        memoryCache = models
        fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify({ timestamp: Date.now(), models }, null, 2))
      } else {
        log.warn(`Failed to fetch models from OpenRouter: ${res.status}`)
      }
    } catch (e) {
      log.error('Error fetching models from OpenRouter:', e)
    }
  }
}

export function getModelCapabilities(modelId: string): string[] {
  if (!memoryCache) return []
  return memoryCache[modelId] || []
}
