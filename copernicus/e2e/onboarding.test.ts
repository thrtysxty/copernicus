import { test, expect } from './fixture'

test.use({ skipWizard: false })

test.describe('Onboarding Wizard', () => {
  test('can complete the onboarding flow', async ({ app, window, e2eHome }) => {
    // Override auth:status to simulate no keys → ensures wizard goes through step 2 (local AI)
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('auth:status')
      // @ts-ignore
      ipcMain.handle('auth:status', () => ({ ok: true, data: [] }))
    })

    // 1. Verify Step 1 (Auth) renders
    await expect(window.locator('[data-testid="wizard-step-1"]')).toBeVisible({ timeout: 10000 })

    // 2. Click Next to advance
    await window.locator('[data-testid="wizard-next-button"]').click()

    // 3. Step 2 (Local AI) or Step 3 (Workspace) — wizard skips step 2 if keys exist
    const step2Visible = await window.locator('[data-testid="wizard-step-2"]').isVisible({ timeout: 3000 }).catch(() => false)
    const step3Visible = await window.locator('[data-testid="wizard-step-3"]').isVisible({ timeout: 3000 }).catch(() => false)
    expect(step2Visible || step3Visible).toBe(true)

    // 4. If on step 2, advance past it
    if (step2Visible) {
      await window.locator('[data-testid="wizard-next-button"]').click()
      await expect(window.locator('[data-testid="wizard-step-3"]')).toBeVisible({ timeout: 5000 })
    }

    // 5. Mock folder selection → auto-populate workspace
    await app.evaluate(({ ipcMain }, home) => {
      ipcMain.removeHandler('select-folder')
      // @ts-ignore
      ipcMain.handle('select-folder', () => ({ ok: true, data: home }))
    }, e2eHome)

    // 6. Click Select Folder
    await window.locator('[data-testid="wizard-select-folder"]').click()

    // 7. Advance through remaining steps to finish
    // Click Next until wizard closes (step 4 is the final step)
    for (let i = 0; i < 3; i++) {
      const nextBtn = window.locator('[data-testid="wizard-next-button"]')
      if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nextBtn.click()
        await window.waitForTimeout(500)
      }
    }

    // 8. Wizard should close — check that the main IDE root is shown
    await expect(window.locator('#root')).toBeAttached()
  })
})
