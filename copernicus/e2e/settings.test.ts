import { test, expect } from './fixture'

test.describe('Settings Panel', () => {
  test('settings panel opens, shows content, and closes', async ({ window }) => {
    // Open settings via activity bar
    await window.locator('[data-testid="nav-settings"]').click()

    // Verify settings panel renders — "IDE Configuration" is unique to the settings header
    await expect(window.locator('text=IDE Configuration').first()).toBeVisible()

    // Click the close button (X) to close
    await window.locator('[aria-label="Close settings"]').click()

    // Verify settings panel is no longer visible
    await expect(window.locator('text=IDE Configuration').first()).toBeHidden()
  })

  test('settings:load IPC returns a valid object', async ({ window }) => {
    const result = await window.evaluate(async () =>
      await (window as any).ipcRenderer.invoke('settings:load')
    ) as { ok: boolean; data: unknown }

    expect(result.ok).toBe(true)
    expect(result.data).toBeTruthy()
  })
})
