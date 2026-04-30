import { test, expect } from './fixture'

test.describe('Hub Ledger IPC', () => {
  test('hub:get-events returns ok with events array', async ({ window }) => {
    const result = await window.evaluate(() =>
      (window as any).ipcRenderer.invoke('hub:get-events', { limit: 10, offset: 0 })
    )
    expect(result.ok).toBe(true)
    expect(result.data).toBeDefined()
    expect(Array.isArray(result.data.events)).toBe(true)
  })

  test('hub:get-attribution returns ok', async ({ window }) => {
    const result = await window.evaluate(() =>
      (window as any).ipcRenderer.invoke('hub:get-attribution', { limit: 10 })
    )
    expect(result.ok).toBe(true)
  })

  test('hub:get-cost-summary returns ok', async ({ window }) => {
    const result = await window.evaluate(() =>
      (window as any).ipcRenderer.invoke('hub:get-cost-summary', {})
    )
    expect(result.ok).toBe(true)
  })
})
