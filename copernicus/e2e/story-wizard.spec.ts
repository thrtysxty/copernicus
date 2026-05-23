/*
 * Story 713: Story Wizard E2E Tests
 *
 * Selectors (verified from KanbanBoard.tsx):
 * - Add story button:    data-testid="add-story-button"     (line 587)
 * - Feature template:   data-testid="template-feature"     (line 598)
 * - Title input:        data-testid="new-story-title"      (line 645)
 * - Confirm button:     data-testid="create-story-confirm" (line 656)
 * - Story card:         data-testid="story-card-{id}"      (line 91)
 *
 * Note: StoriesManager writes to the targeted project repo (os.homedir() based),
 * not to e2eHome. File assertions are skipped — card appearance is the E2E-testable
 * outcome. Unit tests in story-handlers.test.ts cover file creation.
 *
 * Empty title: handleCreate() returns early (no error UI, form stays open).
 */

import { test, expect } from './fixture'

const STORY_TITLE = 'E2E Wizard Test Story'

test.describe('Story Wizard', () => {
  test('@smoke happy path creates story in kanban', async ({ window }) => {
    // Kanban is already visible — window fixture navigates to planner view
    await window.waitForSelector('[data-testid="add-story-button"]', { timeout: 10_000 })

    // Open template dropdown
    await window.click('[data-testid="add-story-button"]')
    await window.waitForSelector('[data-testid="template-feature"]')

    // Select Feature template — inline creation form appears
    await window.click('[data-testid="template-feature"]')
    await window.waitForSelector('[data-testid="new-story-title"]')

    // Fill title and confirm
    await window.fill('[data-testid="new-story-title"]', STORY_TITLE)
    await window.click('[data-testid="create-story-confirm"]')

    // Assert: story card visible in kanban within 3s
    const card = window.locator('[data-testid^="story-card-"]').filter({ hasText: STORY_TITLE })
    await expect(card).toBeVisible({ timeout: 3_000 })
  })

  test('empty title — form stays open, no story created', async ({ window }) => {
    await window.waitForSelector('[data-testid="add-story-button"]', { timeout: 10_000 })

    // Open dropdown and select Feature
    await window.click('[data-testid="add-story-button"]')
    await window.waitForSelector('[data-testid="template-feature"]')
    await window.click('[data-testid="template-feature"]')
    await window.waitForSelector('[data-testid="new-story-title"]')

    // Submit with empty title
    await window.click('[data-testid="create-story-confirm"]')
    await window.waitForTimeout(300)

    // Form must still be visible — handleCreate returns early on empty title
    await expect(window.locator('[data-testid="new-story-title"]')).toBeVisible()

    // No story card with any text should have appeared (column is otherwise empty in test)
    const newCards = window.locator('[data-testid^="story-card-"]')
    await expect(newCards).toHaveCount(0)
  })
})
