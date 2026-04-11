import { describe, test, before } from 'node:test';
import assert from 'node:assert';
import { getDb } from './lib/db.mjs';

test('db connection', () => {
  const db = getDb();
  assert.ok(db);
});
