import { test, expect } from '../fixture'
import { AgentTestHelper } from '../agent-test-helper'

test.describe('Workflow View — Agent', () => {
  test('agent explores workflow canvas', async ({ app, window }) => {
    const agent = new AgentTestHelper(window, app)
    const report = await agent.pursueGoal(
      'Navigate to the orchestrator/workflow view. Verify the workflow canvas renders, node palette or add-node controls exist, and the canvas is interactive.'
    )
    expect(report.processErrors).toHaveLength(0)
    expect(report.passed).toBe(true)
  })
})
