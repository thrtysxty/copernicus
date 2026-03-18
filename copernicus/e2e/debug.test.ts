import { test, expect, screenshotPath } from './fixture'

test('Debug panel appears', async ({ window }) => {
  // Click Debug icon in activity bar
  await window.click('[data-testid="nav-debug"]')

  // Wait for Debug panel to appear
  const debugTitle = window.locator('text=Debug').first()
  await expect(debugTitle).toBeVisible()

  const launchNode = window.locator('text=Launch Node').first()
  await expect(launchNode).toBeVisible()

  // Screenshot to docs
  await window.screenshot({ path: screenshotPath('debug-panel') })
})
