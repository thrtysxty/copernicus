import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import { getDb } from '../lib/db.mjs';
import { CCRAdapter } from './ccr.mjs';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('CCRAdapter tests', async (t) => {
  const db = getDb();

  // Clean up any existing records
  db.prepare('DELETE FROM ccr_sessions').run();

  const eventBus = new EventEmitter();

  const mockHub = {
    getContractDirective: (role) => 'MOCK_DIRECTIVE'
  };

  const adapter = new CCRAdapter(db, mockHub, eventBus);

  await t.test('checkCcrAvailable returns false when port unreachable', async () => {
    // Port 9669 should be unreachable in test env unless mock server is running
    const available = await adapter._checkCcrAvailable();
    assert.strictEqual(available, false);
  });

  await t.test('name and supportedCapabilities', () => {
    assert.strictEqual(adapter.name(), 'ccr');
    assert.deepStrictEqual(adapter.supportedCapabilities(), ['shell', 'fs_write', 'git:commit', 'git:push:branch']);
  });

  await t.test('sendMessage throws NotSupported', async () => {
    await assert.rejects(
      async () => { await adapter.sendMessage('123', 'hello'); },
      /NotSupported/
    );
  });

  await t.test('dispatch throws if CCR is not available', async () => {
    // Since checkCcrAvailable is cached for 30s, we mock it
    adapter._checkCcrAvailable = async () => false;

    await assert.rejects(
      async () => { await adapter.dispatch({ token_id: '123' }, 'fake_path.md'); },
      /AdapterUnavailable/
    );
  });

  await t.test('dispatch, poll and cancel', async () => {
    // Mock available
    adapter._checkCcrAvailable = async () => true;

    // Create a dummy story file for testing
    const storyPath = 'docs/stories/dummy_story.md';
    fs.mkdirSync(path.join(__dirname, '../../../docs/stories'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, '../../../', storyPath), 'Dummy content');

    // Mock the actual execution to prevent spawning real ccr
    // We override dispatch temporarily, or override spawn
    const originalSpawn = (await import('child_process')).spawn;

    // In node:test, monkeypatching modules is tricky, so we test adapter logic
    // by manually inserting a running session.

    const fakePid = 999999; // Very likely dead PID
    db.prepare(`
      INSERT INTO ccr_sessions (session_id, token_id, pid, worktree, log_path, state, started_at)
      VALUES (?, ?, ?, ?, ?, 'RUNNING', ?)
    `).run('test_session', 'test_token', fakePid, '/tmp/wt', '/tmp/cc_test.log', new Date().toISOString());

    // Create fake log file
    fs.writeFileSync('/tmp/cc_test.log', 'Fake log tail\nSuccess');

    let eventFired = false;
    eventBus.on('ccr:session_done', (data) => {
      eventFired = true;
      assert.strictEqual(data.session_id, 'test_session');
      assert.strictEqual(data.success, true);
    });

    await adapter.poll();

    assert.strictEqual(eventFired, true);
    const updatedSession = db.prepare("SELECT * FROM ccr_sessions WHERE session_id='test_session'").get();
    assert.strictEqual(updatedSession.state, 'DONE');

    // Test cancel
    db.prepare(`
      INSERT INTO ccr_sessions (session_id, token_id, pid, worktree, log_path, state, started_at)
      VALUES (?, ?, ?, ?, ?, 'RUNNING', ?)
    `).run('cancel_session', 'test_token2', fakePid, '/tmp/wt', '/tmp/cc_test2.log', new Date().toISOString());

    await adapter.cancelSession('cancel_session');

    const cancelledSession = db.prepare("SELECT * FROM ccr_sessions WHERE session_id='cancel_session'").get();
    assert.strictEqual(cancelledSession.state, 'CANCELLED');
  });

});
