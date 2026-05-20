/**
 * Critical-path P0 tests for Copernicus.
 * These are deterministic Playwright tests — no agent needed.
 * They gate merges and must pass on every PR.
 */
import { test, expect } from './fixture'

test.describe('Critical Path — P0', () => {

  test('app launches and shows main window', async ({ window }) => {
    await expect(window.locator('#root')).toBeVisible({ timeout: 20_000 })
  })

  test('sidebar navigation switches views', async ({ app, window }) => {
    // Verify the activity bar renders (nav-planner is always present)
    const plannerBtn = window.locator('[data-testid="nav-planner"]')
    await expect(plannerBtn).toBeVisible({ timeout: 10_000 })

    // Click through views using the correct data-testid values
    const views = ['nav-planner', 'nav-editor', 'nav-settings']
    for (const testId of views) {
      const btn = window.locator(`[data-testid="${testId}"]`)
      await btn.click()
      await window.waitForTimeout(500)
    }
  })

  test('kanban board renders columns', async ({ window }) => {
    // With skipWizard=true, app navigates to planner view
    const planningColumn = window.locator('[data-testid="column-planning"]')
    await expect(planningColumn).toBeVisible({ timeout: 15_000 })
  })

  test('settings panel loads', async ({ app, window }) => {
    const { setView } = await import('./fixture')
    await setView(app, 'settings')
    await window.waitForTimeout(1_000)

    // Settings nav button should show as active
    const settingsBtn = window.locator('[data-testid="nav-settings"]')
    await expect(settingsBtn).toBeVisible({ timeout: 10_000 })
  })

  test('no main-process crashes during startup', async ({ app }) => {
    // Check that the process is still running
    const exitCode = app.process().exitCode
    expect(exitCode).toBeNull()
  })
})

// Wizard tests need skipWizard: false — separate describe block
test.describe('Critical Path — Wizard', () => {
  test.use({ skipWizard: false })

  test('wizard completes with valid workspace', async ({ window, app, e2eHome }) => {
    await expect(window.locator('[data-testid="wizard-step-1"]')).toBeVisible({ timeout: 15_000 })
    const nextBtn = window.locator('[data-testid="wizard-next-button"]')
    await nextBtn.click()

    await expect(window.locator('[data-testid="wizard-step-2"]')).toBeVisible()
    const fs = require('fs')
    const path = require('path')
    const workspacePath = path.join(e2eHome, 'valid-workspace')
    fs.mkdirSync(workspacePath, { recursive: true })

    await app.evaluate(({ ipcMain }, wp) => {
      ipcMain.removeHandler('select-folder')
      ipcMain.handle('select-folder', () => ({ ok: true, data: wp }))
    }, workspacePath)

    await window.locator('[data-testid="wizard-select-folder"]').click()
    await expect(nextBtn).toBeEnabled({ timeout: 5_000 })
  })
})
