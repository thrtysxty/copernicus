import { test, expect } from './fixture'

test.describe('Navigation', () => {
  test('all 5 main views render non-blank content', async ({ window }) => {
    // planner (KanbanBoard) — already active from fixture
    await expect(window.locator('[data-testid="column-planning"]')).toBeVisible({ timeout: 15_000 })
    await expect(window.locator('[data-testid="nav-planner"][aria-current="page"]')).toBeVisible()

    // editor — FileTree sidebar shows "Explorer" header
    await window.locator('[data-testid="nav-editor"]').click()
    await expect(window.locator('[data-testid="nav-editor"][aria-current="page"]')).toBeVisible({ timeout: 10_000 })
    await expect(window.locator('text=Explorer').first()).toBeVisible()

    // command-center (Telemetry) — h2 inside main content
    await window.locator('[data-testid="nav-telemetry"]').click()
    await expect(window.locator('[data-testid="nav-telemetry"][aria-current="page"]')).toBeVisible({ timeout: 10_000 })
    await expect(window.locator('#main-content h2').filter({ hasText: 'Telemetry' })).toBeVisible()

    // reporter (CapexDashboard) — CAPEX Hours summary card
    await window.locator('[data-testid="nav-reporter"]').click()
    await expect(window.locator('[data-testid="nav-reporter"][aria-current="page"]')).toBeVisible({ timeout: 10_000 })
    await expect(window.locator('text=CAPEX Hours').first()).toBeVisible()

    // orchestrator (WorkflowCanvas) — SVG canvas
    await window.locator('[data-testid="nav-orchestrator"]').click()
    await expect(window.locator('[data-testid="nav-orchestrator"][aria-current="page"]')).toBeVisible({ timeout: 10_000 })
    await expect(window.locator('svg').first()).toBeVisible()
  })

  test('activity bar navigation items are all clickable', async ({ window }) => {
    // Click nav items that navigate to views (skip items that open modals)
    const viewNavItems = window.locator('[data-testid^="nav-"]:not([data-testid="nav-settings"]):not([data-testid="nav-genesis"])')
    const count = await viewNavItems.count()

    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      await viewNavItems.nth(i).click()
      await window.waitForTimeout(200)
      await expect(window.locator('#root')).toBeAttached()
    }
  })
})
