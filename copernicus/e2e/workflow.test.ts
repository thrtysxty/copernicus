import { test, expect } from './fixture'

test.describe('Workflow: Story Lifecycle', () => {
  test('can create and transition a story', async ({ window }) => {
    // 1. Click +New Story in the Kanban board
    await window.locator('[data-testid="add-story-button"]').click()

    // 2. Types "E2E Test Story" into the title input
    await window.locator('[data-testid="new-story-title"]').fill('E2E Test Story')

    // 3. Saves the story
    await window.locator('[data-testid="create-story-confirm"]').click()

    // 4. Verifies the card exists in the planning column
    const card = window.locator('[data-testid^="story-card-"]').filter({ hasText: 'E2E Test Story' })
    await expect(card).toBeVisible()

    // 5. Drags the card to development
    // Playwright dragTo helper
    const targetColumn = window.locator('[data-testid="column-ready-to-build"]')
    await card.dragTo(targetColumn)

    // 6. Verifies that the card is now in the target column
    await expect(targetColumn.locator('[data-testid^="story-card-"]').filter({ hasText: 'E2E Test Story' })).toBeVisible()
    
    // 7. Click the card to open detail
    await card.click()
    
    // 8. Verify detail is open
    await expect(window.locator('[data-testid="story-detail-title"]')).toHaveText('E2E Test Story')
  })

  test('chat panel responds with mock', async ({ window }) => {
    // 1. Type into chat
    await window.locator('[data-testid="chat-input"]').fill('Hello Copernicus')
    
    // 2. Send
    await window.locator('[data-testid="chat-send-button"]').click()
    
    // 3. Verify mock response
    // Mock response starts with "Mock Response:"
    const response = window.locator('div:has-text("Mock Response:")').last()
    await expect(response).toBeVisible({ timeout: 10000 })
  })
})
