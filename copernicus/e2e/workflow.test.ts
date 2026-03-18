import { test, expect, setView } from './fixture'

test.describe('Workflow: Story Lifecycle', () => {
  test('can create and transition a story', async ({ app, window }) => {
    // Ensure we are in blueprint (kanban) view
    await setView(app, 'blueprint')
    await window.waitForTimeout(500)

    // 1. Click +New in the Kanban board (opens template dropdown)
    await window.locator('[data-testid="add-story-button"]').click()

    // 2. Select "Story" template from dropdown
    await window.locator('[data-testid="template-story"]').click()

    // 3. Fill in the title
    await window.locator('[data-testid="new-story-title"]').fill('E2E Test Story')

    // 4. Save the story
    await window.locator('[data-testid="create-story-confirm"]').click()

    // 5. Verify a card with this title exists (use first() in case multiple exist)
    const card = window.locator('[data-testid^="story-card-"]').filter({ hasText: 'E2E Test Story' }).first()
    await expect(card).toBeVisible()

    // 6. Drag the card to the ready-to-build column
    const targetColumn = window.locator('[data-testid="column-ready-to-build"]')
    await card.dragTo(targetColumn)
    await window.waitForTimeout(500)

    // 7. Verify the card is now in the target column
    await expect(targetColumn.locator('[data-testid^="story-card-"]').filter({ hasText: 'E2E Test Story' }).first()).toBeVisible()
  })

  test('chat input is present and accepts text', async ({ app, window }) => {
    // Switch to studio view which shows the chat panel
    await setView(app, 'studio')
    await window.waitForTimeout(800)

    // Verify the chat input field is present and interactive
    const chatInput = window.locator('[data-testid="chat-input"]')
    await expect(chatInput).toBeVisible({ timeout: 10000 })
    await chatInput.fill('Hello Copernicus')
    await expect(chatInput).toHaveValue('Hello Copernicus')
  })
})
