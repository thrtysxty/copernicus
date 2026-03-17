import os from 'node:os'
import path from 'node:path'

// Minimal Electron mock for vitest (jsdom environment).
// Covers the subset of Electron APIs used by main-process modules under test.

export const app = {
  getPath: (name: string) => path.join(os.tmpdir(), 'copernicus-test', name),
  isReady: () => true,
  on: () => {},
  whenReady: () => Promise.resolve(),
}

export const ipcMain = {
  handle: () => {},
  removeHandler: () => {},
  on: () => {},
  off: () => {},
}

export const BrowserWindow = {
  getAllWindows: () => [],
}

export const safeStorage = {
  isEncryptionAvailable: () => false,
  encryptString: (s: string) => Buffer.from(s),
  decryptString: (b: Buffer) => b.toString(),
}

export const shell = { openExternal: () => {} }
export const dialog = { showOpenDialog: () => Promise.resolve({ canceled: true, filePaths: [] }) }
export const nativeImage = { createFromPath: () => ({}) }
