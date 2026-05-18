import log from '../../utils/logger'
import path from 'node:path'
import fs from 'node:fs'
import { ExtensionActivatedMessage } from '../ExtensionHostProtocol'
import { ExtensionApiProxy } from './ExtensionApiProxy'
import { wrapV2Api } from '@copernicus/compat-v1'

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

  async loadOne(dir: string, approvedCapabilities?: any): Promise<void> {
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

      const entryPoint = packageJson.main ? path.join(dir, packageJson.main) : undefined
      if (!entryPoint || !fs.existsSync(entryPoint)) {
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const extensionModule = require(entryPoint)

      if (typeof extensionModule.activate !== 'function') {
        return
      }

      const isV1 = !manifest.activationEvents && !manifest.capabilities

      const effectiveCapabilities = isV1
        ? { filesystem: 'read-write', network: true, subprocess: true }
        : manifest.capabilities

      const effectiveApproved = isV1
        ? { filesystem: 'read-write', network: true, subprocess: true }
        : approvedCapabilities

      const proxy = new ExtensionApiProxy(effectiveCapabilities, effectiveApproved)

      const apiToPass = isV1 ? wrapV2Api(proxy) : proxy

      if (isV1) {
        log.info(`[compat-v1] ${packageJson.name} loaded with v1 shim`)
      }

      await extensionModule.activate(apiToPass)

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
