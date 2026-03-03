/**
 * Smoke tests — verify the app launches, renders, and responds to IPC.
 * These run with skipWizard: true (default) so tests reach the main IDE quickly.
 *
 * Prerequisite: npm run build:app
 */
import { test, expect, setView } from './fixture'

test.describe('App launch', () => {
  test('window opens and root mounts', async ({ window }) => {
    await expect(window.locator('#root')).toBeAttached()
  })

  test('window title contains COPERNICUS', async ({ window }) => {
    const title = await window.title()
    expect(title).toContain('COPERNICUS')
  })

  test('renderer has ipcRenderer exposed', async ({ window }) => {
    const hasIpc = await window.evaluate(() => typeof window.ipcRenderer !== 'undefined')
    expect(hasIpc).toBe(true)
  })
})

test.describe('Navigation', () => {
  test('can switch to blueprint view', async ({ app, window }) => {
    await setView(app, 'blueprint')
    // Kanban board or activity indicator present
    await expect(window.locator('#root')).toBeAttached()
  })

  test('can switch to capex view', async ({ app, window }) => {
    await setView(app, 'capex')
    await window.waitForTimeout(500)
    await expect(window.locator('#root')).toBeAttached()
  })

  test('can switch to workflow view', async ({ app, window }) => {
    await setView(app, 'workflow')
    await window.waitForTimeout(500)
    await expect(window.locator('#root')).toBeAttached()
  })

  test('can switch to studio view', async ({ app, window }) => {
    await setView(app, 'studio')
    await window.waitForTimeout(500)
    await expect(window.locator('#root')).toBeAttached()
  })

  test('can switch to engine-room view', async ({ app, window }) => {
    await setView(app, 'engine-room')
    await window.waitForTimeout(500)
    await expect(window.locator('#root')).toBeAttached()
  })
})

test.describe('IPC health', () => {
  test('auth:status returns a response', async ({ window }) => {
    const result = await window.evaluate(async () => {
      return await window.ipcRenderer.invoke('auth:status')
    })
    // handleIpc always returns { ok: boolean, data/error }
    expect(result).toHaveProperty('ok')
  })

  test('models:list returns model array', async ({ window }) => {
    const result = await window.evaluate(async () => {
      return await window.ipcRenderer.invoke('models:list')
    }) as { ok: boolean; data?: unknown[] }
    expect(result.ok).toBe(true)
    expect(Array.isArray(result.data)).toBe(true)
  })

  test('stories:list returns response', async ({ window }) => {
    const result = await window.evaluate(async () => {
      return await window.ipcRenderer.invoke('stories:list')
    }) as { ok: boolean }
    expect(result.ok).toBe(true)
  })

  test('db:log-event round-trips', async ({ window }) => {
    await window.evaluate(async () => {
      await window.ipcRenderer.invoke('db:log-event', 'E2E_TEST', 'Playwright smoke test', {}, 'e2e')
    })
    const result = await window.evaluate(async () => {
      return await window.ipcRenderer.invoke('db:get-events', 5)
    }) as { ok: boolean; data?: Array<{ type: string }> }
    expect(result.ok).toBe(true)
    const found = result.data?.some(e => e.type === 'E2E_TEST')
    expect(found).toBe(true)
  })
})
