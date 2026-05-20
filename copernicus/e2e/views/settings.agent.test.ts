import { test, expect } from '../fixture'
import { AgentTestHelper } from '../agent-test-helper'

test.describe('Settings View — Agent', () => {
  test('agent explores settings panel', async ({ app, window }) => {
    const agent = new AgentTestHelper(window, app)
    const report = await agent.pursueGoal(
      'Navigate to the settings view. Verify settings categories are visible, API key configuration exists, and sections can be navigated without errors.'
    )
    expect(report.processErrors).toHaveLength(0)
    expect(report.passed).toBe(true)
  })
})
