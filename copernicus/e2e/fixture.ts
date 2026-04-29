import { test as base, _electron as electron, ElectronApplication, Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { execSync } from 'child_process'

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
  const workspacePath = path.join(e2eHome, 'workspace')
  fs.mkdirSync(workspacePath, { recursive: true })

  // Initialize git repo and docs/stories so isRepoTargeted returns true
  execSync('git init', { cwd: workspacePath })
  execSync('git config user.email "test@e2e.local"', { cwd: workspacePath })
  execSync('git config user.name "E2E"', { cwd: workspacePath })
  execSync('git commit --allow-empty -m "init"', { cwd: workspacePath })
  fs.mkdirSync(path.join(workspacePath, 'docs', 'stories'), { recursive: true })

  const settingsPath = path.join(e2eHome, 'copernicus-settings.json')
  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify({
      workspace: workspacePath,
      workingDir: workspacePath,
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
      args: [APP_MAIN, `--user-data-dir=${e2eHome}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        COPERNICUS_E2E_HOME: e2eHome,
        // Suppress update checks
        ELECTRON_NO_UPDATER: '1',
      },
    })

    if (!skipWizard) {
      await app.evaluate(({ ipcMain }) => {
        // @ts-ignore
        ipcMain.removeHandler('auth:status')
        // @ts-ignore
        ipcMain.handle('auth:status', () => ({ ok: true, data: [] }))
      })
    }

    await use(app)
    // SIGKILL bypasses macOS keep-alive and the async before-quit handler
    app.process().kill('SIGKILL')
    await app.close().catch(() => {})
  },

  window: async ({ app, skipWizard }, use) => {
    const win = await app.firstWindow()
    await win.waitForSelector('#root', { timeout: 15_000 })
    if (skipWizard) {
      // Navigate to planner view so kanban hydrates (default view is 'editor')
      await app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.webContents.send('layout:set-view', 'planner')
      })
      await win.waitForSelector('[data-testid="column-planning"]', { timeout: 15_000 })
    }
    await use(win)
  },
})

export { expect } from '@playwright/test'

// Map legacy test view names to actual StoryboardView values in the layout store
const VIEW_MAP: Record<string, string> = {
  blueprint: 'planner',
  studio: 'editor',
  'engine-room': 'command-center',
  capex: 'reporter',
  workflow: 'orchestrator',
}

// Helper: push a layout:set-view IPC from main process → renderer
export async function setView(
  app: ElectronApplication,
  view: string
) {
  const mapped = VIEW_MAP[view] ?? view
  await app.evaluate(({ BrowserWindow }, v) => {
    BrowserWindow.getAllWindows()[0]?.webContents.send('layout:set-view', v)
  }, mapped)
}

// Helper: save screenshot to docs/help/screenshots/ for user guide use
export function screenshotPath(name: string): string {
  const dir = path.join(__dirname, '../../docs/help/screenshots')
  fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, `${name}.png`)
}
