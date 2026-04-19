import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import log from 'electron-log'
import { ExtensionTrustStore } from './ExtensionTrustStore'

const execAsync = promisify(exec)

export class ExtensionInstaller {
  private extensionDir: string
  private trustStore: ExtensionTrustStore

  constructor() {
    this.extensionDir = path.join(os.homedir(), '.copernicus', 'extensions')
    this.trustStore = new ExtensionTrustStore()

    if (!fs.existsSync(this.extensionDir)) {
      fs.mkdirSync(this.extensionDir, { recursive: true })
    }
  }

  async search(query: string): Promise<any[]> {
    try {
      const response = await fetch(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}+keywords:copernicus-extension&size=20`)
      if (!response.ok) {
        throw new Error(`npm search failed with status ${response.status}`)
      }
      const data = await response.json()
      return data.objects.map((obj: any) => obj.package)
    } catch (e) {
      log.error('[ExtensionInstaller] Search failed', e)
      throw e
    }
  }

  async install(packageName: string): Promise<{ path: string, manifest: any }> {
    try {
      log.info(`[ExtensionInstaller] Installing ${packageName}...`)
      // Ensure we have a package.json in the extensions dir to prevent npm from installing higher up
      const pkgPath = path.join(this.extensionDir, 'package.json')
      if (!fs.existsSync(pkgPath)) {
        fs.writeFileSync(pkgPath, JSON.stringify({ name: 'copernicus-extensions', version: '1.0.0' }, null, 2))
      }

      await execAsync(`npm install ${packageName} --no-save`, { cwd: this.extensionDir })

      const extPath = path.join(this.extensionDir, 'node_modules', packageName)
      const manifestPath = path.join(extPath, 'package.json')

      if (!fs.existsSync(manifestPath)) {
        throw new Error(`Installation failed: ${manifestPath} not found`)
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
      return { path: extPath, manifest }
    } catch (e) {
      log.error(`[ExtensionInstaller] Install of ${packageName} failed`, e)
      throw e
    }
  }

  async uninstall(packageName: string): Promise<void> {
    try {
      log.info(`[ExtensionInstaller] Uninstalling ${packageName}...`)
      await execAsync(`npm uninstall ${packageName} --no-save`, { cwd: this.extensionDir })
      this.trustStore.revoke(packageName)
    } catch (e) {
      log.error(`[ExtensionInstaller] Uninstall of ${packageName} failed`, e)
      throw e
    }
  }
}
