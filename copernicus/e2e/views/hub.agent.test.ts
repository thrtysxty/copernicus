import { test, expect } from '../fixture'
import { AgentTestHelper } from '../agent-test-helper'

test.describe('Hub View — Agent', () => {
  test('agent explores hub ledger', async ({ app, window }) => {
    const agent = new AgentTestHelper(window, app)
    const report = await agent.pursueGoal(
      'Explore the Hub/Ledger view. Verify that the event ledger is visible, that it lists recent activities, and that the cost/attribution summaries render without errors.'
    )
    expect(report.processErrors).toHaveLength(0)
    expect(report.passed).toBe(true)
  })
})
