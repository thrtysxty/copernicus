import path from 'path'
import fs from 'fs'
import { ExtensionRegistry } from './ExtensionRegistry'
import { CopernicusExtensionAPI } from './api'
import { CopernicusManifest, LoadedExtension } from './types'

export class ExtensionLoader {
  constructor(private extensionDir: string, private registry: ExtensionRegistry) {}

  async loadAll(): Promise<LoadedExtension[]> {
    if (!fs.existsSync(this.extensionDir)) {
      fs.mkdirSync(this.extensionDir, { recursive: true })
    }

    const subdirs = fs.readdirSync(this.extensionDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => path.join(this.extensionDir, dirent.name))

    const loadedExtensions: LoadedExtension[] = []
    for (const dir of subdirs) {
      const extension = await this.loadOne(dir)
      if (extension) {
        loadedExtensions.push(extension)
        this.registry.registerExtension(extension)
      }
    }
    return loadedExtensions
  }

  private async loadOne(dir: string): Promise<LoadedExtension | null> {
    const packagePath = path.join(dir, 'package.json')
    if (!fs.existsSync(packagePath)) {
      console.warn(`Extension directory ${dir} is missing package.json`)
      return null
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))
      const manifest: CopernicusManifest = packageJson.copernicus

      if (!manifest) {
        console.warn(`Extension ${packageJson.name} is missing 'copernicus' key in package.json`)
        return null
      }

      if (!packageJson.main) {
        console.warn(`Extension ${packageJson.name} is missing 'main' entry in package.json`)
        return null
      }

      const entryPoint = path.join(dir, packageJson.main)
      if (!fs.existsSync(entryPoint)) {
        console.warn(`Extension ${packageJson.name} entry point ${entryPoint} not found`)
        return null
      }

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const extensionModule = require(entryPoint)

      if (typeof extensionModule.activate !== 'function') {
        console.warn(`Extension ${packageJson.name} is missing 'activate' function`)
        return null
      }

      const api: CopernicusExtensionAPI = {
        registerWorkflowNode: this.registry.registerWorkflowNode.bind(this.registry),
        registerTile: this.registry.registerTile.bind(this.registry),
        registerProvider: this.registry.registerProvider.bind(this.registry),
        registerView: this.registry.registerView.bind(this.registry),
      }

      try {
        await extensionModule.activate(api)
        return {
          name: packageJson.name,
          displayName: manifest.displayName || packageJson.name,
          version: packageJson.version,
          path: dir,
          manifest,
          active: true,
        }
      } catch (e: any) {
        console.error(`Error activating extension ${packageJson.name}:`, e)
        return {
          name: packageJson.name,
          displayName: manifest.displayName || packageJson.name,
          version: packageJson.version,
          path: dir,
          manifest,
          active: false,
          error: e.message,
        }
      }
    } catch (e: any) {
      console.error(`Error loading extension from ${dir}:`, e)
      const packageName = path.basename(dir);
      return {
        name: packageName,
        displayName: packageName,
        version: 'unknown',
        path: dir,
        manifest: { displayName: packageName },
        active: false,
        error: e.message,
      }
    }
  }
}
