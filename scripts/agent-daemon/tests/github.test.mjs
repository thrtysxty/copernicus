import { hasHumanReworkRequest } from '../lib/github.mjs';
import * as child_process from 'child_process';
import assert from 'assert';

// Mock execSync to simulate GitHub responses
const originalExecSync = child_process.execSync;

child_process.execSync = function(cmd, options) {
  if (cmd.includes('pr reviews 12345')) {
    return JSON.stringify([{ state: 'CHANGES_REQUESTED' }]);
  }
  if (cmd.includes('pr reviews 54321')) {
    return JSON.stringify([{ state: 'APPROVED' }]);
  }
  if (cmd.includes('pr view 54321 --json comments')) {
    return JSON.stringify({ comments: [{ body: 'Looks good!' }, { body: 'Wait, changes requested here' }] });
  }
  if (cmd.includes('pr view 99999 --json comments')) {
    return JSON.stringify({ comments: [] });
  }
  if (cmd.includes('pr reviews 99999')) {
    return JSON.stringify([]);
  }

  return originalExecSync.call(this, cmd, options);
};

try {
  console.log('Testing hasHumanReworkRequest...');

  // Test 1: PR with CHANGES_REQUESTED review state
  assert.strictEqual(hasHumanReworkRequest(12345), true, "PR 12345 should have a human rework request");

  // Test 2: PR with 'changes requested' in comment
  assert.strictEqual(hasHumanReworkRequest(54321), true, "PR 54321 should have a human rework request due to comment");

  // Test 3: Clean PR
  assert.strictEqual(hasHumanReworkRequest(99999), false, "PR 99999 should not have a human rework request");

  console.log('All hasHumanReworkRequest tests passed.');
} finally {
  // Restore mock
  child_process.execSync = originalExecSync;
}
