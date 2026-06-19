import { test, expect } from '../fixture'
import { AgentTestHelper } from '../agent-test-helper'

test.describe('Intelligence View — Agent', () => {
  test('agent explores intelligence features', async ({ app, window }) => {
    const agent = new AgentTestHelper(window, app)
    const report = await agent.pursueGoal(
      'Explore the Intelligence view. Verify that the knowledge base, suggestion banners, and model insights are rendered correctly and respond to interaction.'
    )
    expect(report.processErrors).toHaveLength(0)
    expect(report.passed).toBe(true)
  })
})
