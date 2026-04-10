import { test, describe, before, after, mock } from 'node:test';
import assert from 'node:assert';
import { getDb } from './db.mjs';
import { mint, check, revoke } from './hub.mjs';

describe('Hub Token Module', () => {
  let db;

  before(() => {
    db = getDb();
    // Clean up any existing test data to ensure isolation
    db.prepare('DELETE FROM hub_events').run();
    db.prepare('DELETE FROM hub_tokens').run();
  });

  after(() => {
    db.prepare('DELETE FROM hub_events').run();
    db.prepare('DELETE FROM hub_tokens').run();
  });

  test('mint returns valid token and writes to DB', () => {
    const roleConfig = {
      role: { name: 'test_role', class: 'operational', authority_level: 2 },
      capabilities: ['shell', 'fs_write'],
      scope: { folder: ['/test/*'], commands: ['npm run build'] }
    };

    const token = mint(roleConfig, '123', '/tmp/worktree');
    assert.ok(token.token_id);
    assert.strictEqual(token.role.name, 'test_role');
    assert.strictEqual(token.scope.worktree, '/tmp/worktree');
    assert.strictEqual(token.capabilities.length, 2);

    const dbToken = db.prepare('SELECT * FROM hub_tokens WHERE token_id = ?').get(token.token_id);
    assert.ok(dbToken);
    assert.strictEqual(dbToken.state, 'ACTIVE');
    assert.strictEqual(dbToken.story_id, '123');
  });

  test('check allows valid action', () => {
    const roleConfig = {
      role: { name: 'test_role' },
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
      role: { name: 'expired_role' },
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
      role: { name: 'scope_role' },
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
      role: { name: 'cmd_role' },
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
      role: { name: 'revoke_role' },
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
