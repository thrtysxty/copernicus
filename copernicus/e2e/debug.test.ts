import { test, expect } from './fixture'
import path from 'path'

test('Debug panel appears', async ({ app, window }) => {
  // Click Debug icon
  await window.click('[data-testid="nav-debug"]')

  // Wait for Debug panel to appear
  const debugTitle = window.locator('text=Debug').first()
  await expect(debugTitle).toBeVisible()

  const launchNode = window.locator('text=Launch Node').first()
  await expect(launchNode).toBeVisible()

  // Take a screenshot
  await window.screenshot({ path: '/home/jules/verification/debug_panel.png' })
})