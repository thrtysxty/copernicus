import { test, expect } from '../fixture'
import { AgentTestHelper } from '../agent-test-helper'

test.describe('Editor View — Agent', () => {
  test('agent explores code editor', async ({ app, window }) => {
    const agent = new AgentTestHelper(window, app)
    const report = await agent.pursueGoal(
      'Navigate to the editor view. Verify the Monaco editor renders, the file tree is visible on the left, and the editor area shows content or a welcome state.'
    )
    expect(report.processErrors).toHaveLength(0)
    expect(report.passed).toBe(true)
  })
})
