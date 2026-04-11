import { test, describe, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert';
import { getDb } from './db.mjs';
import { mint, check, revoke, updateHealth, declareWait, assessHealth, runHealthSweep, renewToken } from './hub.mjs';

describe('Hub Token Module', () => {
  let db;

  beforeEach(() => {
    db = getDb();
    db.exec('DROP TRIGGER IF EXISTS hub_events_no_delete');
    db.exec('DROP TRIGGER IF EXISTS hub_tokens_no_delete');
    db.prepare('DELETE FROM hub_events').run();
    db.prepare('DELETE FROM hub_tokens').run();
    db.prepare('DELETE FROM hub_queue').run();
    db.prepare('DELETE FROM hub_story_state').run();
  });

  before(() => {
    db = getDb();
    // Clean up any existing test data to ensure isolation
    db.exec('DROP TRIGGER IF EXISTS hub_events_no_update');
    db.exec('DROP TRIGGER IF EXISTS hub_events_no_delete');
    db.exec('DROP TRIGGER IF EXISTS hub_tokens_no_delete');
    db.prepare('DELETE FROM hub_events').run();
    db.prepare('DELETE FROM hub_tokens').run();
    db.prepare('DELETE FROM hub_queue').run();
    db.prepare('DELETE FROM hub_story_state').run();
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS hub_events_no_update BEFORE UPDATE ON hub_events
      BEGIN SELECT RAISE(ABORT, 'hub_events is append-only'); END;
    `);
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS hub_events_no_delete BEFORE DELETE ON hub_events
      BEGIN SELECT RAISE(ABORT, 'hub_events is append-only'); END;
    `);
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS hub_tokens_no_delete BEFORE DELETE ON hub_tokens
      BEGIN SELECT RAISE(ABORT, 'hub_tokens records are immutable'); END;
    `);
  });


  test('updateHealth increments retry_count', () => {
    const roleConfig = { role: { name: 'coder' }, capabilities: [], scope: { commands: [] } };
    const token = mint(roleConfig, 'story-642-a', null);

    updateHealth(token.token_id, { retry_count: 2 });
    updateHealth(token.token_id, { retry_count: 1, agent_state: 'WORKING' });

    const updatedToken = db.prepare('SELECT health FROM hub_tokens WHERE token_id = ?').get(token.token_id);
    const health = JSON.parse(updatedToken.health);
    assert.strictEqual(health.retry_count, 3);

    const event = db.prepare('SELECT * FROM hub_events WHERE token_id = ? AND event_type = ?').get(token.token_id, 'token:health_updated');
    assert.ok(event);
  });

  test('declareWait sets WAITING state and records timeout', () => {
    const roleConfig = { role: { name: 'coder' }, capabilities: [], scope: { commands: [] } };
    const token = mint(roleConfig, 'story-642-b', null);

    db.prepare('INSERT INTO hub_queue (queue_id, story_id, phase, role_required, enqueued_at, claimed_at, claimed_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('q-1', 'story-642-b', 'TESTING', 'tester', new Date().toISOString(), new Date().toISOString(), token.token_id);

    db.prepare('INSERT OR IGNORE INTO hub_story_state (story_id, entered_phase) VALUES (?, ?)').run('story-642-b', new Date().toISOString());

    declareWait(token.token_id, 'plan_approval', 30);

    const state = db.prepare('SELECT agent_state, waiting_reason FROM hub_story_state WHERE story_id = ?').get('story-642-b');
    assert.strictEqual(state.agent_state, 'WAITING');
    assert.strictEqual(state.waiting_reason, 'plan_approval');
  });

  test('assessHealth returns STALLED when last_progress_at is stale', () => {
    const roleConfig = { role: { name: 'coder' }, capabilities: [], scope: { commands: [] } };
    const token = mint(roleConfig, 'story-642-c', null);

    db.prepare('INSERT INTO hub_queue (queue_id, story_id, phase, role_required, enqueued_at, claimed_at, claimed_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('q-2', 'story-642-c', 'TESTING', 'tester', new Date().toISOString(), new Date().toISOString(), token.token_id);

    db.prepare('INSERT OR IGNORE INTO hub_story_state (story_id, entered_phase) VALUES (?, ?)').run('story-642-c', new Date().toISOString());

    const past = new Date(Date.now() - 20 * 60000).toISOString();
    db.prepare('UPDATE hub_tokens SET health = ? WHERE token_id = ?').run(JSON.stringify({ last_progress_at: past }), token.token_id);

    const report = assessHealth(token.token_id);
    assert.strictEqual(report.condition, 'STALLED');
  });

  test('tester-role stall detection uses test log activity', () => {
    const roleConfig = { role: { name: 'tester' }, capabilities: [], scope: { commands: [] } };
    const token = mint(roleConfig, 'story-642-tester', null);

    db.prepare('INSERT INTO hub_queue (queue_id, story_id, phase, role_required, enqueued_at, claimed_at, claimed_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('q-tester', 'story-642-tester', 'TESTING', 'tester', new Date().toISOString(), new Date().toISOString(), token.token_id);

    db.prepare('INSERT OR IGNORE INTO hub_story_state (story_id, entered_phase) VALUES (?, ?)').run('story-642-tester', new Date().toISOString());

    // With no log, should be stalled
    const report = assessHealth(token.token_id);
    assert.strictEqual(report.condition, 'STALLED');
  });

  test('runHealthSweep fires loop_suspected when retry_count >= max_retries', () => {
    const roleConfig = { role: { name: 'coder' }, capabilities: [], scope: { commands: [] } };
    const token = mint(roleConfig, 'story-642-d', null);

    db.prepare('INSERT INTO hub_queue (queue_id, story_id, phase, role_required, enqueued_at, claimed_at, claimed_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('q-3', 'story-642-d', 'TESTING', 'tester', new Date().toISOString(), new Date().toISOString(), token.token_id);

    db.prepare('INSERT OR IGNORE INTO hub_story_state (story_id, entered_phase) VALUES (?, ?)').run('story-642-d', new Date().toISOString());

    const past = new Date(Date.now() - 20 * 60000).toISOString();
    db.prepare('UPDATE hub_tokens SET health = ? WHERE token_id = ?').run(JSON.stringify({ last_progress_at: past, retry_count: 4, max_retries: 3 }), token.token_id);

    runHealthSweep();

    const event = db.prepare('SELECT * FROM hub_events WHERE token_id = ? AND event_type = ?').get(token.token_id, 'token:loop_suspected');
    assert.ok(event);
  });

  test('renewToken respects health gate', () => {
    const roleConfig = { role: { name: 'coder' }, capabilities: [], scope: { commands: [] } };
    const token = mint(roleConfig, 'story-642-e', null);

    db.prepare('INSERT INTO hub_queue (queue_id, story_id, phase, role_required, enqueued_at, claimed_at, claimed_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('q-4', 'story-642-e', 'TESTING', 'tester', new Date().toISOString(), new Date().toISOString(), token.token_id);
    db.prepare('INSERT OR IGNORE INTO hub_story_state (story_id, entered_phase) VALUES (?, ?)').run('story-642-e', new Date().toISOString());

    const past = new Date(Date.now() - 20 * 60000).toISOString();
    db.prepare('UPDATE hub_tokens SET health = ? WHERE token_id = ?').run(JSON.stringify({ last_progress_at: past }), token.token_id); // stalled

    const result = renewToken(token.token_id, 'user123');
    assert.strictEqual(result.renewed, false);

    const event = db.prepare('SELECT * FROM hub_events WHERE token_id = ? AND event_type = ?').get(token.token_id, 'token:renewal_denied');
    assert.ok(event);
  });


  after(() => {
    // Cannot delete from tables because of append-only triggers,
    // so we can drop triggers, delete, and recreate triggers to clean up,
    // or just leave the data since it's a test db.
    db.exec('DROP TRIGGER IF EXISTS hub_events_no_update');
    db.exec('DROP TRIGGER IF EXISTS hub_events_no_delete');
    db.exec('DROP TRIGGER IF EXISTS hub_tokens_no_delete');
    db.prepare('DELETE FROM hub_events').run();
    db.prepare('DELETE FROM hub_tokens').run();
  });

  test('mint returns valid token and writes to DB', () => {
    const roleConfig = {
      role: { name: 'coder', class: 'operational', authority_level: 2 },
      capabilities: ['shell', 'fs_write'],
      scope: { folder: ['/test/*'], commands: ['npm run build'] }
    };

    const token = mint(roleConfig, '123', '/tmp/worktree');
    assert.ok(token.token_id);
    assert.strictEqual(token.role.name, 'coder');
    assert.strictEqual(token.scope.worktree, '/tmp/worktree');
    assert.strictEqual(token.capabilities.length, 2);

    const dbToken = db.prepare('SELECT * FROM hub_tokens WHERE token_id = ?').get(token.token_id);
    assert.ok(dbToken);
    assert.strictEqual(dbToken.state, 'ACTIVE');
    assert.strictEqual(dbToken.story_id, '123');
  });

  test('check allows valid action', () => {
    const roleConfig = {
      role: { name: 'coder' },
      capabilities: ['fs_write'],
      scope: { folder: ['/var/www/*'] }
    };

    const token = mint(roleConfig, '124', null);

    const action = { type: 'fs_write', path: '/var/www/index.html' };
    const result = check(token.token_id, action);

    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.reason, 'ok');

    // Check that event was logged
    const event = db.prepare('SELECT * FROM hub_events WHERE token_id = ? ORDER BY timestamp DESC LIMIT 1').get(token.token_id);
    assert.ok(event);
    assert.strictEqual(event.event_type, 'token:checked');
    assert.strictEqual(event.result, 'allowed|ok');
  });

  test('check denies expired token', () => {
    const roleConfig = {
      role: { name: 'coder' },
      capabilities: ['shell'],
      duration: { ttl: -1000 } // Expiry in the past
    };

    const token = mint(roleConfig, '125', null);
    const action = { type: 'shell', command: 'ls' };

    const result = check(token.token_id, action);

    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason, 'expired');

    const event = db.prepare('SELECT * FROM hub_events WHERE token_id = ? AND event_type = ? ORDER BY timestamp DESC LIMIT 1').get(token.token_id, 'token:expired');
    assert.ok(event);
    assert.strictEqual(event.event_type, 'token:expired');
    assert.strictEqual(event.result, 'denied|expired');
  });

  test('check denies out-of-scope path', () => {
    const roleConfig = {
      role: { name: 'coder' },
      capabilities: ['fs_write'],
      scope: { folder: ['/var/www/html/*'] }
    };

    const token = mint(roleConfig, '126', null);
    const action = { type: 'fs_write', path: '/etc/passwd' };

    const result = check(token.token_id, action);

    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason, 'Path out of scope');
  });

  test('check denies unlisted command', () => {
    const roleConfig = {
      role: { name: 'coder' },
      capabilities: ['shell'],
      scope: { commands: ['git log', 'git status'] }
    };

    const token = mint(roleConfig, '127', null);
    const action = { type: 'shell', command: 'rm -rf /' };

    const result = check(token.token_id, action);

    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason, 'Command out of scope');
  });

  test('revoke blocks subsequent checks', () => {
    const roleConfig = {
      role: { name: 'coder' },
      capabilities: ['shell'],
      scope: { commands: ['echo'] }
    };

    const token = mint(roleConfig, '128', null);
    revoke(token.token_id, 'testing revoke');

    const action = { type: 'shell', command: 'echo hello' };
    const result = check(token.token_id, action);

    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason, 'Token is REVOKED');

    const event = db.prepare('SELECT * FROM hub_events WHERE token_id = ? AND event_type = ?').get(token.token_id, 'token:revoked');
    assert.ok(event);
    assert.strictEqual(event.result, 'denied|testing revoke');
  });
});
