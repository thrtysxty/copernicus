/**
 * Screenshot generation for the User Guide.
 *
 * Output: docs/help/screenshots/*.png
 *
 * Run with:   npm run docs:screenshots
 * Prerequisite: npm run build:app
 *
 * Each test captures one screen state. Tests are tagged @screenshot so they
 * can be run independently of the smoke suite.
 */
import { test, expect, setView, screenshotPath } from './fixture'

// Allow enough settle time after navigation for animations to complete
const SETTLE = 800

// ─── Wizard flow ────────────────────────────────────────────────────────────

test.describe('Wizard', () => {
  // Override fixture: do NOT skip wizard for these tests
  test.use({ skipWizard: false })

  test('wizard-welcome @screenshot', async ({ window }) => {
    // Wizard renders immediately on first run
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('wizard-welcome'), fullPage: false })
  })
})

// ─── Main IDE views ──────────────────────────────────────────────────────────

test.describe('Main IDE', () => {
  // skipWizard: true is the default

  test('main-layout @screenshot', async ({ app, window }) => {
    await setView(app, 'blueprint')
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('main-layout'), fullPage: false })
  })

  test('kanban-board @screenshot', async ({ app, window }) => {
    await setView(app, 'blueprint')
    await window.waitForTimeout(SETTLE)
    // Click the blueprint / kanban nav if needed — it's the default view
    await window.screenshot({ path: screenshotPath('kanban-board'), fullPage: false })
  })

  test('studio-view @screenshot', async ({ app, window }) => {
    await setView(app, 'studio')
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('studio-view'), fullPage: false })
  })

  test('engine-room @screenshot', async ({ app, window }) => {
    await setView(app, 'engine-room')
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('engine-room'), fullPage: false })
  })

  test('workflow-canvas @screenshot', async ({ app, window }) => {
    await setView(app, 'workflow')
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('workflow-canvas'), fullPage: false })
  })

  test('capex-dashboard @screenshot', async ({ app, window }) => {
    await setView(app, 'capex')
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('capex-dashboard'), fullPage: false })
  })
})

// ─── Overlays ────────────────────────────────────────────────────────────────

test.describe('Overlays', () => {
  test('command-palette @screenshot', async ({ app, window }) => {
    await setView(app, 'blueprint')
    await window.waitForTimeout(300)
    // Open command palette via IPC (same as Cmd+K shortcut)
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send('layout:open-palette')
    })
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('command-palette'), fullPage: false })
    // Dismiss
    await window.keyboard.press('Escape')
  })

  test('settings-panel @screenshot', async ({ window }) => {
    // Settings is opened by clicking the gear icon in the status bar or activity bar.
    // Use keyboard shortcut Cmd+, which should trigger settings open.
    // Alternatively click via selector — look for settings gear button.
    const settingsBtn = window.locator('[title*="Settings"], [aria-label*="Settings"]').first()
    if (await settingsBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await settingsBtn.click()
    } else {
      await window.keyboard.press('Meta+,')
    }
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('settings-panel'), fullPage: false })
    await window.keyboard.press('Escape')
  })

  test('spotlight-search @screenshot', async ({ app, window }) => {
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send('layout:toggle-spotlight')
    })
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('spotlight-search'), fullPage: false })
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send('layout:toggle-spotlight')
    })
  })
})

// ─── Status Bar ──────────────────────────────────────────────────────────────

test.describe('Status Bar', () => {
  test('status-bar-detail @screenshot', async ({ app, window }) => {
    await setView(app, 'blueprint')
    await window.waitForTimeout(SETTLE)
    // Crop to bottom strip
    const rootBox = await window.locator('#root').boundingBox()
    if (rootBox) {
      await window.screenshot({
        path: screenshotPath('status-bar'),
        clip: {
          x: rootBox.x,
          y: rootBox.y + rootBox.height - 30,
          width: rootBox.width,
          height: 30,
        },
      })
    }
  })
})
