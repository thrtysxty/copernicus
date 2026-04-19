import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { CopernicusManifest } from './types'
import log from 'electron-log'

export interface TrustEntry {
  approvedAt: string
  capabilities: CopernicusManifest['capabilities']
}

export class ExtensionTrustStore {
  private trustFilePath: string
  private cache: Record<string, TrustEntry> | null = null

  constructor() {
    this.trustFilePath = path.join(os.homedir(), '.copernicus', 'extension-trust.json')
  }

  private load(): Record<string, TrustEntry> {
    if (this.cache) return this.cache
    if (!fs.existsSync(this.trustFilePath)) {
      this.cache = {}
      return this.cache
    }
    try {
      const content = fs.readFileSync(this.trustFilePath, 'utf-8')
      this.cache = JSON.parse(content)
      return this.cache || {}
    } catch (e) {
      log.error('[ExtensionTrustStore] Error loading trust file:', e)
      return {}
    }
  }

  private save(data: Record<string, TrustEntry>): void {
    this.cache = data
    try {
      const dir = path.dirname(this.trustFilePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(this.trustFilePath, JSON.stringify(data, null, 2), 'utf-8')
    } catch (e) {
      log.error('[ExtensionTrustStore] Error saving trust file:', e)
    }
  }

  isTrusted(extensionName: string): boolean {
    const store = this.load()
    return !!store[extensionName]
  }

  approve(extensionName: string, capabilities: CopernicusManifest['capabilities']): void {
    const store = this.load()
    store[extensionName] = {
      approvedAt: new Date().toISOString(),
      capabilities
    }
    this.save(store)
  }

  revoke(extensionName: string): void {
    const store = this.load()
    if (store[extensionName]) {
      delete store[extensionName]
      this.save(store)
    }
  }
}
