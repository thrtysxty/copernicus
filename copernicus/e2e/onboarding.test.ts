import { test, expect } from './fixture'
import path from 'path'
import fs from 'fs'

test.use({ skipWizard: false })

test.describe('Onboarding Wizard', () => {
  test('wizard renders and responds to navigation', async ({ window, app, e2eHome }) => {
    // Set up app:critical-error tracking before navigation
    await window.evaluate(() => {
      ;(window as any).ipcRenderer.on('app:critical-error', (_e: unknown, err: { message: string }) => {
        (window as any).__e2eErrors = (window as any).__e2eErrors ?? []
        ;(window as any).__e2eErrors.push(err.message)
      })
    })

    // 1. Wait for Step 1 (auth/intelligence bus) to be visible
    await expect(window.locator('[data-testid="wizard-step-1"]')).toBeVisible({ timeout: 15_000 })

    // 2. Verify Next button is visible and enabled on step 1 (no required fields)
    const nextBtn = window.locator('[data-testid="wizard-next-button"]')
    await expect(nextBtn).toBeVisible()
    await expect(nextBtn).toBeEnabled()

    // 3. Click Next — advances to step 2 (workspace selection)
    await nextBtn.click()
    await expect(window.locator('[data-testid="wizard-step-2"]')).toBeVisible()

    // 4. Step 2 requires a workspace path — mock select-folder and click the picker
    const workspacePath = path.join(e2eHome, 'ws')
    fs.mkdirSync(workspacePath, { recursive: true })
    await app.evaluate(({ ipcMain }, wp) => {
      // @ts-ignore
      ipcMain.removeHandler('select-folder')
      // @ts-ignore
      ipcMain.handle('select-folder', () => ({ ok: true, data: wp }))
    }, workspacePath)
    await window.locator('[data-testid="wizard-select-folder"]').click()

    // Wait for workspacePath to propagate (IPC round-trip + state update)
    await expect(nextBtn).toBeEnabled({ timeout: 5_000 })

    // 5. Click Next — advances to step 3 (project selection)
    await nextBtn.click()
    await expect(window.locator('[data-testid="wizard-step-3"]')).toBeVisible()

    // 6. Verify no app:critical-error events fired
    const e2eErrors = await window.evaluate(() => (window as any).__e2eErrors ?? [])
    expect(e2eErrors).toHaveLength(0)
  })
})
