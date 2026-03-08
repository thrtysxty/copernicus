import { test, expect } from './fixture'

test.use({ skipWizard: false })

test.describe('Onboarding Wizard', () => {
  test('can complete the onboarding flow', async ({ app, window, e2eHome }) => {
    // 1. Verify Step 1 (Auth) renders
    await expect(window.locator('[data-testid="wizard-step-1"]')).toBeVisible()
    
    // 2. Click Advance to reach Step 2
    await window.locator('[data-testid="wizard-next-button"]').click()
    
    // 3. Verify Step 2 (File System)
    await expect(window.locator('[data-testid="wizard-step-2"]')).toBeVisible()
    
    // 4. Mock the folder selection in the main process to auto-advance
    await app.evaluate(({ ipcMain }, home) => {
      // @ts-ignore
      ipcMain.removeHandler('select-folder')
      // @ts-ignore
      ipcMain.handle('select-folder', () => ({ ok: true, data: home }))
    }, e2eHome)

    // 5. Click "Select Store" which should now auto-advance to Step 3
    await window.locator('[data-testid="wizard-select-folder"]').click()
    
    // 6. Verify Step 3 (Economics)
    await expect(window.locator('[data-testid="wizard-step-3"]')).toBeVisible()
    
    // 7. Click Initialize Core
    await window.locator('[data-testid="wizard-next-button"]').click()
    
    // 8. Verify Wizard closes and main IDE appears
    // We expect the Kanban board columns to appear eventually
    await expect(window.locator('[data-testid="column-planning"]')).toBeVisible({ timeout: 15000 })
  })
})
