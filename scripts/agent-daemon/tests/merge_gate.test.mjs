import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Daemon does NOT call gh pr merge on CHANGES_REQUESTED', async (t) => {
    const testDir = path.join('/tmp', 'agent-daemon-test-' + Date.now());
    fs.mkdirSync(testDir);

    try {
        // 1. Mock GH binary
        const mockGhPath = path.join(testDir, 'gh');
        const mockGhCode = `#!/bin/bash
if [[ "$*" == *"pr reviews 123"* ]]; then
  echo '[{"state": "CHANGES_REQUESTED"}]'
elif [[ "$*" == *"pr view 123 --json comments"* ]]; then
  echo '{"comments": []}'
elif [[ "$*" == *"pr view 123 --json state"* ]]; then
  echo '{"state": "OPEN"}'
elif [[ "$*" == *"pr merge 123"* ]]; then
  echo "FATAL_MERGE_CALLED" > ${testDir}/merge_called
  # Do not exit inside the bash script because of restrictions, just do nothing
fi
`;
        fs.writeFileSync(mockGhPath, mockGhCode, { mode: 0o755 });

        // 2. Patch github.mjs to use our mock GH
        const realGithubMjsPath = path.resolve(__dirname, '../lib/github.mjs');
        const realGithubCode = fs.readFileSync(realGithubMjsPath, 'utf8');
        const patchedGithubCode = realGithubCode.replace(
            "const GH = '/opt/homebrew/bin/gh';",
            `const GH = '${mockGhPath}';`
        );
        fs.writeFileSync(path.join(testDir, 'github.mjs'), patchedGithubCode);

        // 3. Patch db.mjs and review.mjs with stubs so it runs offline
        const realDbMjsPath = path.resolve(__dirname, '../lib/db.mjs');
        let patchedDbCode = fs.readFileSync(realDbMjsPath, 'utf8')
            .replace(/import Database from 'better-sqlite3';/g, '')
            .replace(/export function getDb\(\) \{[\s\S]*?return db;\n\}/, 'export function getDb() { return {}; }')
            .replace(/export function updateSessionReview\([\s\S]*?\}\n/, 'export function updateSessionReview(db, sessionId, reviewVerdict) { }\n')
            .replace(/export function updateSessionState\([\s\S]*?\}\n/, 'export function updateSessionState(db, sessionId, state, planApproved = null) { }\n');
        // Let's just create a mock db.mjs entirely to be safe
        patchedDbCode = `
export function getDb() { return {}; }
export function getActiveSessions() { return []; }
export function updateSessionState() {}
export function updateSessionPr() {}
export function updateSessionReview() {}
export function updateSessionMerged() {}
export function getStoryPath() { return null; }
export function writeVerificationRecord() {}
export function writeStatus() {}
export function writeEpisode() {}
export function stampStoryId() {}
export function showStatus() {}
export function registerSession() {}
export function logImprovementRun() {}
        `;
        fs.writeFileSync(path.join(testDir, 'db.mjs'), patchedDbCode);

        fs.writeFileSync(path.join(testDir, 'review.mjs'), `export async function reviewPr() { return {verdict: 'APPROVED', summary: ''}; }`);
        fs.writeFileSync(path.join(testDir, 'token.mjs'), `export function isExpired() { return false; }`);
        fs.writeFileSync(path.join(testDir, 'registry.mjs'), `export function getTokenForStory() { return null; } export function logAction() {} export function revoke() {}`);

        // Add stub package.json for jules-sdk resolution
        fs.mkdirSync(path.join(testDir, 'node_modules'));
        fs.mkdirSync(path.join(testDir, 'node_modules', '@google'));
        fs.mkdirSync(path.join(testDir, 'node_modules', '@google', 'jules-sdk'));
        fs.writeFileSync(path.join(testDir, 'node_modules', '@google', 'jules-sdk', 'package.json'), '{"name": "@google/jules-sdk", "main": "index.js", "type": "module"}');
        fs.writeFileSync(path.join(testDir, 'node_modules', '@google', 'jules-sdk', 'index.js'), 'export function connect() { return {}; }');

        // 4. Patch jules.mjs to use local imports
        const realJulesMjsPath = path.resolve(__dirname, '../handlers/jules.mjs');
        const patchedJulesCode = fs.readFileSync(realJulesMjsPath, 'utf8')
            .replace(/\.\.\/lib\//g, './')
            // Add a hook to directly export handleCompletedPr
            + '\nexport { handleCompletedPr };\n';
        fs.writeFileSync(path.join(testDir, 'jules.mjs'), patchedJulesCode);

        // 5. Test runner
        const runnerCode = `
import { handleCompletedPr } from './jules.mjs';

async function run() {
    const mockRow = { session_id: 'test_session', review_state: 'FAILED' };
    const mockDb = {};
    const mockSession = { ask: async () => {} };

    await handleCompletedPr(mockRow, mockDb, 123, 'story1', mockSession);
}
run();
`;
        fs.writeFileSync(path.join(testDir, 'runner.mjs'), runnerCode);

        // Run the runner
        execSync('node runner.mjs', { cwd: testDir });

        // Assert that merge was not called
        assert.ok(!fs.existsSync(path.join(testDir, 'merge_called')), "Merge was called on a blocked PR!");

    } finally {
        fs.rmSync(testDir, { recursive: true, force: true });
    }
});
