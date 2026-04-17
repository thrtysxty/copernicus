import os from 'node:os'
import path from 'node:path'
import { ExtensionHostRuntime } from './ExtensionHostRuntime'

const extensionsDir = path.join(os.homedir(), '.copernicus', 'extensions')

const runtime = new ExtensionHostRuntime(extensionsDir)

process.on('message', (_msg) => {
  // Currently unused, handle incoming messages here later
});

async function main() {
  await runtime.loadAll()
}

main().catch((err) => {
  console.error('Host failed to start', err)
  process.exit(1)
})
