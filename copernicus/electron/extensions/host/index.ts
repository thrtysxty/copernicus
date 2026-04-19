import os from 'node:os'
import path from 'node:path'
import { ExtensionHostRuntime } from './ExtensionHostRuntime'

const extensionsDir = path.join(os.homedir(), '.copernicus', 'extensions')

const runtime = new ExtensionHostRuntime(extensionsDir)

process.on('message', async (msg: any) => {
  if (msg && msg.method === 'extension/activate') {
    const { extensionPath } = msg.params
    await runtime.loadOne(extensionPath)
  }
});

async function main() {
  // Extension load is triggered via IPC now
}

main().catch((err) => {
  console.error('Host failed to start', err)
  process.exit(1)
})
