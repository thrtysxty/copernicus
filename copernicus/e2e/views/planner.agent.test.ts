import { test, expect } from '../fixture'
import { AgentTestHelper } from '../agent-test-helper'

test.describe('Planner View — Agent', () => {
  test('agent explores kanban board', async ({ app, window }) => {
    const agent = new AgentTestHelper(window, app)
    const report = await agent.pursueGoal(
      'Explore the planner/kanban view. Verify that columns (planning, in-progress, review, done) are visible, cards exist in columns, and the board renders without errors.'
    )
    expect(report.processErrors).toHaveLength(0)
    expect(report.passed).toBe(true)
  })
})
