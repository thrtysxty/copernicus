import { test, expect, setView } from './fixture'

test.describe('Workflow: Story Lifecycle', () => {
  test('can create and transition a story', async ({ app, window }) => {
    // 1. setView blueprint and wait for kanban hydration
    await setView(app, 'blueprint')
    await window.waitForSelector('[data-testid="column-planning"]', { state: 'visible', timeout: 15_000 })

    // 2. Click add-story-button
    await window.locator('[data-testid="add-story-button"]').click()

    // 3. Wait for template-story to be visible, then click it
    const templateStory = window.locator('[data-testid="template-story"]')
    await expect(templateStory).toBeVisible()
    await templateStory.click()

    // 4. Fill with unique title
    const uniqueTitle = `E2E-${Date.now()}`
    await window.locator('[data-testid="new-story-title"]').fill(uniqueTitle)

    // 5. Confirm creation
    await window.locator('[data-testid="create-story-confirm"]').click()

    // 6. Verify card appears in column-planning
    const planningColumn = window.locator('[data-testid="column-planning"]')
    await expect(planningColumn.locator(`text=${uniqueTitle}`)).toBeVisible()

    // 7. Drag to column-ready-to-build
    // story creation sets spotlightLane='planning', collapsing other columns.
    // Click a collapsed column to un-collapse (setSpotlightLane(null)), then dispatch drag events.
    const targetColumn = window.locator('[data-testid="column-ready-to-build"]')
    await targetColumn.click({ force: true })
    await window.waitForTimeout(400)

    const cardElement = window.locator('[data-testid^="story-card-"]').filter({ hasText: uniqueTitle }).first()
    const storyId = await cardElement.getAttribute('data-story-id') ?? ''

    // Dispatch HTML5 drag events directly — more reliable than Playwright dragTo in Electron
    await window.evaluate((id) => {
      const card = document.querySelector(`[data-story-id="${id}"]`)
      const target = document.querySelector('[data-testid="column-ready-to-build"]')
      if (!card || !target) throw new Error(`drag elements not found for id=${id}`)
      const dt = new DataTransfer()
      dt.setData('text/plain', id)
      card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
      target.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }))
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
      card.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
    }, storyId)
    await window.waitForTimeout(500)

    // 8. Verify card is in target column
    await expect(targetColumn.locator(`text=${uniqueTitle}`)).toBeVisible()
  })

  test('chat input is present and accepts text', async ({ app, window }) => {
    // Switch to studio view which renders the chat panel
    await setView(app, 'studio')
    await window.waitForTimeout(800)

    // Verify chat input is visible and interactive
    const chatInput = window.locator('[data-testid="chat-input"]')
    await expect(chatInput).toBeVisible({ timeout: 10_000 })
    await chatInput.fill('Hello Copernicus')
    await expect(chatInput).toHaveValue('Hello Copernicus')
  })
})
