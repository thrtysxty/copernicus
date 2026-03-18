import { test, expect } from './fixture'

test.use({ skipWizard: false })

test.describe('Onboarding Wizard', () => {
  test('wizard renders and responds to navigation', async ({ window }) => {
    // Set up app:critical-error tracking before navigation
    await window.evaluate(() => {
      ;(window as any).ipcRenderer.on('app:critical-error', (_e: unknown, err: { message: string }) => {
        (window as any).__e2eErrors = (window as any).__e2eErrors ?? []
        ;(window as any).__e2eErrors.push(err.message)
      })
    })

    // 1. Wait for Step 1 to be visible
    await expect(window.locator('[data-testid="wizard-step-1"]')).toBeVisible({ timeout: 15_000 })

    // 2. Verify Next button is visible
    const nextBtn = window.locator('[data-testid="wizard-next-button"]')
    await expect(nextBtn).toBeVisible()

    // 3. Click Next — step 2 (local AI) because auth mock returns no keys
    await nextBtn.click()
    await expect(window.locator('[data-testid="wizard-step-2"]')).toBeVisible()

    // 4. Click Next — step 3 (workspace)
    await nextBtn.click()
    await expect(window.locator('[data-testid="wizard-step-3"]')).toBeVisible()

    // 5. Verify no app:critical-error events fired
    const e2eErrors = await window.evaluate(() => (window as any).__e2eErrors ?? [])
    expect(e2eErrors).toHaveLength(0)
  })
})
