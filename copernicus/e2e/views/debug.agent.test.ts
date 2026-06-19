import { test, expect } from '../fixture'
import { AgentTestHelper } from '../agent-test-helper'

test.describe('Debug View — Agent', () => {
  test('agent explores debug tools', async ({ app, window }) => {
    const agent = new AgentTestHelper(window, app)
    const report = await agent.pursueGoal(
      'Explore the Debug view. Verify that the Log Viewer, Test Explorer, and Call Stack panels are all accessible and render their content correctly.'
    )
    expect(report.processErrors).toHaveLength(0)
    expect(report.passed).toBe(true)
  })
})
