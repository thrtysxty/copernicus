import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { getDb } from './db.mjs';
import { mint, check, revoke } from './hub.mjs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const INTEGRITY_FILE = join(homedir(), '.copernicus', 'hub-integrity.json');

describe('Hub Constitutional Layer', () => {
  let db;

  before(() => {
    db = getDb();
    db.exec('DROP TRIGGER IF EXISTS hub_events_no_update');
    db.exec('DROP TRIGGER IF EXISTS hub_events_no_delete');
    db.exec('DROP TRIGGER IF EXISTS hub_tokens_no_delete');
    db.prepare('DELETE FROM hub_events').run();
    db.prepare('DELETE FROM hub_tokens').run();
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

  after(() => {
    db.exec('DROP TRIGGER IF EXISTS hub_events_no_update');
    db.exec('DROP TRIGGER IF EXISTS hub_events_no_delete');
    db.exec('DROP TRIGGER IF EXISTS hub_tokens_no_delete');
    db.prepare('DELETE FROM hub_events').run();
    db.prepare('DELETE FROM hub_tokens').run();
  });

  test('mint throws ConstitutionalViolation for protected paths in scope', () => {
    const roleConfig = {
      role: { name: 'rogue_role', class: 'operational', authority_level: 1 },
      capabilities: ['fs_write'],
      scope: { folder: ['scripts/agent-daemon/lib/hub.mjs'] }
    };

    assert.throws(() => mint(roleConfig, '123', null), { name: 'ConstitutionalViolation' });

    const roleConfigCopernicus = {
      role: { name: 'rogue_role2' },
      scope: { folder: ['~/.copernicus/*'] }
    };

    assert.throws(() => mint(roleConfigCopernicus, '124', null), { name: 'ConstitutionalViolation' });
  });

  test('SQLite trigger prevents DELETE on hub_events', () => {
    const roleConfig = {
      role: { name: 'safe_role', class: 'operational', authority_level: 1 },
      capabilities: ['shell'],
      scope: { folder: ['src/*'] }
    };
    const token = mint(roleConfig, '125', null);

    // Attempting to delete from hub_events
    assert.throws(() => {
      db.prepare('DELETE FROM hub_events').run();
    }, /hub_events is append-only/);
  });

  test('SQLite trigger prevents UPDATE on hub_events non-state columns', () => {
    // Note: since our trigger prevents ALL updates on hub_events, any update will throw.
    assert.throws(() => {
      db.prepare("UPDATE hub_events SET event_type = 'hack'").run();
    }, /hub_events is append-only/);
  });

  test('integrity mismatch exits with code 2', async () => {
    // Using execSync to spawn a child process to check exit code
    if (existsSync(INTEGRITY_FILE)) {
        // Temporarily corrupt it
        const original = readFileSync(INTEGRITY_FILE, 'utf8');
        const corrupt = JSON.parse(original);
        corrupt['hub.mjs'] = 'badhash';
        writeFileSync(INTEGRITY_FILE, JSON.stringify(corrupt));
        try {
            execSync('node ' + join(__dirname, 'hub.mjs'), { stdio: 'ignore' });
            assert.fail('Should have exited with non-zero code');
        } catch (e) {
            assert.strictEqual(e.status, 2);
        } finally {
            // Restore
            writeFileSync(INTEGRITY_FILE, original);
        }
    }
  });

});
