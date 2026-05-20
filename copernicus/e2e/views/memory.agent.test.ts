import { test, expect } from '../fixture'
import { AgentTestHelper } from '../agent-test-helper'

test.describe('Memory View — Agent', () => {
  test('agent explores memory browser', async ({ app, window }) => {
    const agent = new AgentTestHelper(window, app)
    const report = await agent.pursueGoal(
      'Navigate to the memory view (brain icon). Verify the memory browser renders, search functionality exists, and memories can be listed.'
    )
    expect(report.processErrors).toHaveLength(0)
    expect(report.passed).toBe(true)
  })
})
