import { test, expect } from './fixture'
import path from 'path'
import fs from 'fs'

test.use({ skipWizard: false })

test.describe('Onboarding Wizard', () => {
  test('wizard renders and responds to navigation', async ({ window, app, e2eHome }) => {
    await window.evaluate(() => {
      ;(window as any).ipcRenderer.on('app:critical-error', (_e: unknown, err: { message: string }) => {
        (window as any).__e2eErrors = (window as any).__e2eErrors ?? []
        ;(window as any).__e2eErrors.push(err.message)
      })
    })

    await expect(window.locator('[data-testid="wizard-step-1"]')).toBeVisible({ timeout: 15_000 })

    const nextBtn = window.locator('[data-testid="wizard-next-button"]')
    await expect(nextBtn).toBeVisible()
    await expect(nextBtn).toBeEnabled()

    await nextBtn.click()
    await expect(window.locator('[data-testid="wizard-step-2"]')).toBeVisible()

    const workspacePath = path.join(e2eHome, 'ws')
    fs.mkdirSync(workspacePath, { recursive: true })
    await app.evaluate(({ ipcMain }, wp) => {
      ipcMain.removeHandler('select-folder')
      ipcMain.handle('select-folder', () => ({ ok: true, data: wp }))
    }, workspacePath)
    await window.locator('[data-testid="wizard-select-folder"]').click()

    await expect(nextBtn).toBeEnabled({ timeout: 5_000 })

    await nextBtn.click()
    await expect(window.locator('[data-testid="wizard-step-3"]')).toBeVisible()

    const e2eErrors = await window.evaluate(() => (window as any).__e2eErrors ?? [])
    expect(e2eErrors).toHaveLength(0)
  })

  test('user can select a directory containing .git as workspace', async ({ window, app, e2eHome }) => {
    // Navigate to step 2
    await expect(window.locator('[data-testid="wizard-step-1"]')).toBeVisible({ timeout: 15_000 })
    const nextBtn = window.locator('[data-testid="wizard-next-button"]')
    await nextBtn.click()
    await expect(window.locator('[data-testid="wizard-step-2"]')).toBeVisible()

    // Create a workspace directory WITH a .git folder (like a Projects dir would have)
    const gitWorkspace = path.join(e2eHome, 'projects')
    fs.mkdirSync(gitWorkspace, { recursive: true })
    fs.mkdirSync(path.join(gitWorkspace, '.git'), { recursive: true })
    // Write a minimal HEAD file so .git is recognized
    fs.writeFileSync(path.join(gitWorkspace, '.git', 'HEAD'), 'ref: refs/heads/main\n')

    // Mock select-folder to return the git directory
    await app.evaluate(({ ipcMain }, wp) => {
      ipcMain.removeHandler('select-folder')
      ipcMain.handle('select-folder', () => ({ ok: true, data: wp }))
    }, gitWorkspace)

    // Mock fs:path-has-git to return true
    await app.evaluate(({ ipcMain }, wp) => {
      ipcMain.removeHandler('fs:path-has-git')
      ipcMain.handle('fs:path-has-git', () => ({ ok: true, data: true }))
    }, gitWorkspace)

    // Click the select folder button
    await window.locator('[data-testid="wizard-select-folder"]').click()

    // The workspace path should still be set (not cleared)
    // and a warning should be visible instead of a blocking error
    const input = window.locator('input[readonly]')
    await expect(input).toHaveValue(gitWorkspace, { timeout: 5_000 })

    // The git warning should be visible (amber/yellow, not red error)
    const warning = window.locator('text=Git Repository Detected')
    await expect(warning).toBeVisible({ timeout: 5_000 })

    // The next button should still be enabled (not blocked)
    await expect(nextBtn).toBeEnabled()

    // Should be able to proceed to step 3
    await nextBtn.click()
    await expect(window.locator('[data-testid="wizard-step-3"]')).toBeVisible({ timeout: 5_000 })
  })
})
