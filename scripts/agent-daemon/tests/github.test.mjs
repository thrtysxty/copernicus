import assert from 'assert';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  const testDir = path.join('/tmp', 'github-test-' + Date.now());
  fs.mkdirSync(testDir);

  try {
    const mockGhPath = path.join(testDir, 'gh');
    const mockGhCode = `#!/bin/bash
if [[ "\$*" == *"pr reviews 12345"* ]]; then
  echo '[{"state": "CHANGES_REQUESTED"}]'
elif [[ "\$*" == *"pr reviews 54321"* ]]; then
  echo '[{"state": "APPROVED"}]'
elif [[ "\$*" == *"pr view 54321 --repo JMThiessen/Copernicus --json comments"* ]]; then
  echo '{"comments": [{"body": "Looks good!"}, {"body": "Wait, changes requested here"}]}'
elif [[ "\$*" == *"pr view 99999 --repo JMThiessen/Copernicus --json comments"* ]]; then
  echo '{"comments": []}'
elif [[ "\$*" == *"pr reviews 99999"* ]]; then
  echo '[]'
fi
`;
    fs.writeFileSync(mockGhPath, mockGhCode, { mode: 0o755 });

    const realGithubMjsPath = path.resolve(__dirname, '../lib/github.mjs');
    const realGithubCode = fs.readFileSync(realGithubMjsPath, 'utf8');
    const patchedGithubCode = realGithubCode.replace(
      "const GH = '/opt/homebrew/bin/gh';",
      `const GH = '${mockGhPath}';`
    );
    fs.writeFileSync(path.join(testDir, 'github.mjs'), patchedGithubCode);

    const runnerCode = `
import { hasHumanReworkRequest } from './github.mjs';
import assert from 'assert';

async function run() {
  console.log('Testing hasHumanReworkRequest...');
  assert.strictEqual(await hasHumanReworkRequest(12345), true, "PR 12345 should have a human rework request");
  assert.strictEqual(await hasHumanReworkRequest(54321), true, "PR 54321 should have a human rework request due to comment");
  assert.strictEqual(await hasHumanReworkRequest(99999), false, "PR 99999 should not have a human rework request");
  console.log('All hasHumanReworkRequest tests passed.');
}
run();
`;
    fs.writeFileSync(path.join(testDir, 'runner.mjs'), runnerCode);

    execSync('node runner.mjs', { cwd: testDir, stdio: 'inherit' });
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

runTests();
