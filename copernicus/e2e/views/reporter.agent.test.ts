import { test, expect } from '../fixture'
import { AgentTestHelper } from '../agent-test-helper'

test.describe('Reporter View — Agent', () => {
  test('agent explores reporter dashboards', async ({ app, window }) => {
    const agent = new AgentTestHelper(window, app)
    const report = await agent.pursueGoal(
      'Explore the Reporter view. Verify that the burn-down charts, sprint progress, and story metrics are visible and render without errors.'
    )
    expect(report.processErrors).toHaveLength(0)
    expect(report.passed).toBe(true)
  })
})
