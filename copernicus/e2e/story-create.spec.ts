/**
 * Story 734: E2E Story Creation + Delete
 *
 * Verifies the full story lifecycle: create → disk write → kanban card → delete → cleanup.
 */
import { test, expect, screenshotPath } from './fixture'
import fs from 'fs'
import path from 'path'

test.describe('E2E Story Creation', () => {
  test('@smoke creates a story, shows kanban card, then deletes it', async ({ window, e2eHome }) => {
    // 1. Create via IPC
    const createResult = await window.evaluate(async () => {
      return await (window as any).ipcRenderer.invoke('stories:create', {
        title: 'RC Test Story',
        type: 'Feature',
      })
    })

    expect(createResult).toMatchObject({ ok: true })
    const storyId: string = (createResult as any).data
    expect(storyId).toMatch(/^story_\d+$/)

    // 2. File should exist in e2eHome workspace
    const storyFile = path.join(e2eHome, 'workspace', 'docs', 'stories', `${storyId}.md`)
    expect(fs.existsSync(storyFile)).toBe(true)
    const content = fs.readFileSync(storyFile, 'utf8')
    expect(content).toContain('**Status:** PLANNING')

    // 3. Sync and check kanban card
    await window.evaluate(async () => {
      return await (window as any).ipcRenderer.invoke('stories:sync')
    })

    const card = window.getByTestId(`story-card-${storyId}`)
    await expect(card).toBeVisible({ timeout: 5_000 })

    // 4. Screenshot after creation
    await window.screenshot({ path: screenshotPath('story-create-e2e'), fullPage: true })

    // 5. Delete via IPC
    const deleteResult = await window.evaluate(async (id: string) => {
      return await (window as any).ipcRenderer.invoke('stories:delete', id)
    }, storyId)

    expect(deleteResult).toMatchObject({ ok: true })

    // 6. File should be gone
    expect(fs.existsSync(storyFile)).toBe(false)

    // 7. Sync and card should disappear
    await window.evaluate(async () => {
      return await (window as any).ipcRenderer.invoke('stories:sync')
    })

    await expect(card).not.toBeVisible({ timeout: 5_000 })
  })
})
