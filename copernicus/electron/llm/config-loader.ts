import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execSync } from 'node:child_process'
import log from 'electron-log'
import { providerRegistry, ProviderModel } from './provider-registry'

const CONFIG_PATH = path.join(os.homedir(), '.copernicus', 'providers.json')

export interface ConfigReloadResult {
  ok: boolean
  count?: number
  error?: string
}

function resolveValue(val: string | undefined): string | undefined {
  if (!val) return val
  if (val.startsWith('!')) {
    try {
      return execSync(val.slice(1)).toString().trim()
    } catch (e) {
      log.warn(`Failed to execute shell command for config value: ${val}`, e)
      return undefined
    }
  }
  if (/^[A-Z0-9_]+$/.test(val)) {
    return process.env[val]
  }
  return val
}

export function loadProvidersConfig(): ConfigReloadResult {
  if (!fs.existsSync(CONFIG_PATH)) {
    return { ok: true, count: 0 }
  }

  let data: any
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
    data = JSON.parse(raw)
  } catch (e: any) {
    log.error(`Failed to parse providers.json: ${e.message}`)
    return { ok: false, error: e.message }
  }

  if (!data.providers || typeof data.providers !== 'object') {
    return { ok: true, count: 0 }
  }

  let count = 0

  for (const [providerId, config] of Object.entries(data.providers)) {
    const pConfig = config as any
    const existing = providerRegistry.get(providerId)

    const resolvedApiKey = resolveValue(pConfig.apiKey)

    let resolvedHeaders: Record<string, string> | undefined = undefined
    if (pConfig.headers) {
      resolvedHeaders = {}
      for (const [k, v] of Object.entries(pConfig.headers)) {
        const resolved = resolveValue(v as string)
        if (resolved) {
          resolvedHeaders[k] = resolved
        }
      }
    }

    if (existing) {
      // Merge into built-in
      const originalResolveKey = existing.resolveKey.bind(existing)

      existing.resolveKey = () => resolvedApiKey || originalResolveKey()
      if (pConfig.baseUrl) {
        existing.baseUrl = pConfig.baseUrl
      }

      // Store config to use dynamically
      ;(existing as any)._configOverrides = {
        headers: resolvedHeaders,
        compat: pConfig.compat,
        cacheControl: pConfig.cacheControl,
        modelOverrides: pConfig.modelOverrides
      }

      if (pConfig.models && Array.isArray(pConfig.models)) {
        const customModels = pConfig.models.map((m: any) => ({
          id: m.id,
          name: m.name || m.id,
          contextLength: m.contextWindow || 8192,
          supportsToolCalling: existing.supportsToolCalling,
          _customConfig: {
             temperature: m.temperature,
             top_p: m.top_p,
             compat: m.compat
          }
        }))

        const originalListModels = existing.listModels?.bind(existing)
        existing.listModels = async () => {
           const models = originalListModels ? await originalListModels() : []
           const modelMap = new Map<string, ProviderModel>()
           for (const m of models) {
             const override = pConfig.modelOverrides?.[m.id]
             if (override) {
                 m.name = override.name || m.name
                 m.contextLength = override.contextWindow || m.contextLength
                 // apply pricing?
             }
             modelMap.set(m.id, m)
           }
           for (const cm of customModels) {
              modelMap.set(cm.id, cm)
           }
           return Array.from(modelMap.values())
        }
      } else {
        const originalListModels = existing.listModels?.bind(existing)
        if (originalListModels) {
           existing.listModels = async () => {
              const models = await originalListModels()
              for (const m of models) {
                 const override = pConfig.modelOverrides?.[m.id]
                 if (override) {
                     m.name = override.name || m.name
                     m.contextLength = override.contextWindow || m.contextLength
                 }
              }
              return models
           }
        }
      }

    } else {
      // Register new provider
      providerRegistry.register({
        id: providerId,
        displayName: providerId,
        baseUrl: pConfig.baseUrl || '',
        resolveKey: () => resolvedApiKey || null,
        supportsToolCalling: pConfig.compat?.supportsToolCalling ?? false,
        listModels: async () => {
          if (!pConfig.models || !Array.isArray(pConfig.models)) return []
          return pConfig.models.map((m: any) => ({
            id: m.id,
            name: m.name || m.id,
            contextLength: m.contextWindow || 8192,
            supportsToolCalling: pConfig.compat?.supportsToolCalling ?? false,
            _customConfig: {
               temperature: m.temperature,
               top_p: m.top_p,
               compat: m.compat
            }
          }))
        }
      })
      // Attach the _configOverrides to new provider as well so dispatcher can read them
      const newProv = providerRegistry.get(providerId);
      if(newProv) {
        (newProv as any)._configOverrides = {
          api: pConfig.api,
          headers: resolvedHeaders,
          compat: pConfig.compat,
          cacheControl: pConfig.cacheControl,
          modelOverrides: pConfig.modelOverrides
        }
      }
    }
    count++
  }

  return { ok: true, count }
}
