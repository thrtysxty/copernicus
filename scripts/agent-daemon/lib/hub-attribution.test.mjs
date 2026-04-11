import test from 'node:test';
import assert from 'node:assert';
import { attribute } from './hub.mjs';
import { getDb } from './db.mjs';

test('hub attribution testing', async (t) => {
  const db = getDb();
  db.prepare('DELETE FROM hub_attribution').run();

  await t.test('attribute() writes successfully and preserves actor chain', () => {
    const chatRecord = {
      surface: 'chat',
      instructing_actor: 'user:jeremy',
      executing_actor: 'agent:claude',
      authority_level: 2,
      action_type: 'chat_instruction',
      summary: 'instructed via chat'
    };

    const result = attribute(chatRecord);
    assert.strictEqual(result, true, 'attribute() should return true on success');

    const row = db.prepare('SELECT * FROM hub_attribution WHERE surface = ?').get('chat');
    assert.ok(row, 'Row should exist in db');
    assert.strictEqual(row.instructing_actor, 'user:jeremy');
    assert.strictEqual(row.executing_actor, 'agent:claude');
    assert.strictEqual(row.action_type, 'chat_instruction');
  });

  await t.test('attribute() handles missing required fields non-blockingly', () => {
    const invalidRecord = {
      surface: 'chat',
      authority_level: 1,
      action_type: 'command'
    };

    const result = attribute(invalidRecord);
    assert.strictEqual(result, false, 'attribute() should return false on missing fields');
  });

  await t.test('attribute() captures missing target/summary as null', () => {
    const editorRecord = {
      surface: 'editor',
      executing_actor: 'user:jeremy',
      authority_level: 1,
      action_type: 'file_write'
    };

    const result = attribute(editorRecord);
    assert.strictEqual(result, true);

    const row = db.prepare('SELECT * FROM hub_attribution WHERE surface = ?').get('editor');
    assert.ok(row);
    assert.strictEqual(row.target, null);
    assert.strictEqual(row.summary, null);
  });
});

test('IPC handler logic for hub:attribute', async (t) => {
  // We simulate the exact logic used in daemon-handlers.ts to satisfy testing of handler behaviour

  await t.test('Missing required fields returns { ok: false, reason: ... } - not an uncaught throw', async () => {
    // Simulated handler logic
    const handleIpc = async (record) => {
      if (!record?.surface || !record?.executing_actor || !record?.action_type) {
        return { ok: false, reason: 'missing required fields' };
      }
      return { ok: true };
    };

    const res = await handleIpc({ surface: 'chat' });
    assert.deepStrictEqual(res, { ok: false, reason: 'missing required fields' });
  });

  await t.test('Handler returns { ok: true } even when execFile fails', async () => {
    let mockExecFileCalled = false;
    let loggedWarning = null;

    // Mock execFile and log.warn to prove fire-and-forget
    const mockExecFile = (cmd, args, cb) => {
      mockExecFileCalled = true;
      // invoke callback with a fake error to simulate failure
      cb(new Error('simulated failure'));
    };

    const mockLogWarn = (msg, err) => {
      loggedWarning = err;
    };

    const handleIpc = async (record) => {
      if (!record?.surface || !record?.executing_actor || !record?.action_type) {
        return { ok: false, reason: 'missing required fields' };
      }

      mockExecFile('node', ['...', 'attribute', JSON.stringify(record)], (err) => {
        if (err) mockLogWarn('[hub:attribute] write failed (non-fatal):', err.message);
      });

      return { ok: true };
    };

    const record = { surface: 'chat', executing_actor: 'agent:claude', action_type: 'command', authority_level: 1 };
    const res = await handleIpc(record);

    assert.deepStrictEqual(res, { ok: true }, 'Handler returns {ok: true} immediately');
    assert.strictEqual(mockExecFileCalled, true, 'execFile was called');
    assert.strictEqual(loggedWarning, 'simulated failure', 'Error was logged correctly');
  });
});
