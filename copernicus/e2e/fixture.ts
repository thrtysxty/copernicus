import { test as base, _electron as electron, ElectronApplication, Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import os from 'os'

export type E2EOptions = {
  /** When true, pre-seeds preferences so wizard is skipped. Default: true. */
  skipWizard: boolean
}

type ElectronFixtures = {
  app: ElectronApplication
  window: Page
  e2eHome: string
}

const APP_MAIN = path.join(__dirname, '../dist-electron/main.js')

function seedPreferences(e2eHome: string) {
  const prefsPath = path.join(e2eHome, 'preferences.json')
  if (!fs.existsSync(prefsPath)) {
    fs.writeFileSync(prefsPath, JSON.stringify({
      workspace: path.join(os.homedir(), 'Projects'),
      completedAt: new Date().toISOString(),
      theme: 'phosphor',
    }, null, 2))
  }
}

export const test = base.extend<E2EOptions & ElectronFixtures>({
  // Fixture option with default
  skipWizard: [true, { option: true }],

  // Isolated home dir per test worker
  e2eHome: async ({}, use, workerInfo) => {
    const dir = path.join(os.tmpdir(), `copernicus-e2e-${workerInfo.workerIndex}`)
    fs.mkdirSync(dir, { recursive: true })
    await use(dir)
    // Cleanup after test (comment out to inspect state)
    fs.rmSync(dir, { recursive: true, force: true })
  },

  app: async ({ skipWizard, e2eHome }, use) => {
    if (!fs.existsSync(APP_MAIN)) {
      throw new Error(
        `Built app not found at:\n  ${APP_MAIN}\n\nRun "npm run build:app" first.`
      )
    }

    if (skipWizard) {
      seedPreferences(e2eHome)
    }

    const app = await electron.launch({
      args: [APP_MAIN],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        COPERNICUS_E2E_HOME: e2eHome,
        // Suppress update checks
        ELECTRON_NO_UPDATER: '1',
      },
    })

    await use(app)
    await app.close()
  },

  window: async ({ app }, use) => {
    const win = await app.firstWindow()
    // Wait for React to mount — look for a root element
    await win.waitForSelector('#root', { timeout: 15_000 })
    await use(win)
  },
})

export { expect } from '@playwright/test'

// Helper: push a layout:set-view IPC from main process → renderer
export async function setView(
  app: ElectronApplication,
  view: 'blueprint' | 'studio' | 'engine-room' | 'capex' | 'workflow'
) {
  await app.evaluate(({ BrowserWindow }, v) => {
    BrowserWindow.getAllWindows()[0]?.webContents.send('layout:set-view', v)
  }, view)
}

// Helper: save screenshot to docs/help/screenshots/ for user guide use
export function screenshotPath(name: string): string {
  const dir = path.join(__dirname, '../../docs/help/screenshots')
  fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, `${name}.png`)
}
