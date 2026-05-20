import { test, expect } from '../fixture'
import { AgentTestHelper } from '../agent-test-helper'

test.describe('Git View — Agent', () => {
  test('agent explores source control panel', async ({ app, window }) => {
    const agent = new AgentTestHelper(window, app)
    const report = await agent.pursueGoal(
      'Navigate to the source control/git view. Verify the branch selector is visible, changed files are listed, and commit UI exists.'
    )
    expect(report.processErrors).toHaveLength(0)
    expect(report.passed).toBe(true)
  })
})
