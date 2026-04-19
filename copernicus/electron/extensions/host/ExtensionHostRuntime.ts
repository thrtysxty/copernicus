import path from 'node:path'
import fs from 'node:fs'
import { ExtensionActivatedMessage } from '../ExtensionHostProtocol'

export class ExtensionHostRuntime {
  constructor(private extensionDir: string) {}

  async loadAll(): Promise<void> {
    if (!fs.existsSync(this.extensionDir)) {
      return;
    }

    const subdirs = fs.readdirSync(this.extensionDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => path.join(this.extensionDir, dirent.name))

    for (const dir of subdirs) {
      await this.loadOne(dir)
    }
  }

  async loadOne(dir: string): Promise<void> {
    const packagePath = path.join(dir, 'package.json')
    if (!fs.existsSync(packagePath)) {
      return
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))
      const manifest = packageJson.copernicus

      if (!manifest) {
        return
      }

      const msg: ExtensionActivatedMessage = {
        jsonrpc: '2.0',
        method: 'extension/activated',
        params: {
          name: packageJson.name,
          version: packageJson.version || 'unknown'
        }
      }

      if (process.send) {
        process.send(msg)
      }

    } catch (e) {
      // Ignore invalid package.json or other errors
    }
  }
}
