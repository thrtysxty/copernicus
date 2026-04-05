import { getDb } from './db.mjs';
import { generateToken, isExpired } from './token.mjs';

let isInitialized = false;

function initRegistryTable(db) {
  if (isInitialized) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_registry (
      token_id       TEXT PRIMARY KEY,
      agent_name     TEXT NOT NULL,
      story_id       TEXT,
      capabilities   TEXT NOT NULL,
      difficulty_score INTEGER,
      issued_at      TEXT NOT NULL,
      expires_at     TEXT NOT NULL,
      revoked_at     TEXT,
      actions_log    TEXT DEFAULT '[]'
    )
  `);
  isInitialized = true;
}

export function issue({ agent, story_id, capabilities, difficulty_score, ttl_hours }) {
  const db = getDb();
  initRegistryTable(db);

  const token = generateToken(agent, story_id, capabilities, difficulty_score, ttl_hours);

  db.prepare(`
    INSERT INTO agent_registry (
      token_id, agent_name, story_id, capabilities, difficulty_score, issued_at, expires_at, revoked_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    token.token_id,
    token.agent_name,
    token.story_id,
    JSON.stringify(token.capabilities),
    token.difficulty_score,
    token.issued_at,
    token.expires_at,
    token.revoked_at
  );

  return token;
}

export function verify(token_id) {
  const db = getDb();
  initRegistryTable(db);

  const row = db.prepare('SELECT * FROM agent_registry WHERE token_id = ?').get(token_id);
  if (!row) return null;

  const token = {
    ...row,
    capabilities: JSON.parse(row.capabilities),
    actions_log: JSON.parse(row.actions_log || '[]')
  };

  if (isExpired(token)) {
    return null; // or perhaps return it but marked as expired
  }

  return token;
}

export function getTokenForStory(story_id, agent_name = 'jules') {
  const db = getDb();
  initRegistryTable(db);
  const row = db.prepare(`
    SELECT * FROM agent_registry
    WHERE story_id = ? AND agent_name = ? AND revoked_at IS NULL
    ORDER BY issued_at DESC LIMIT 1
  `).get(story_id, agent_name);
  if (!row) return null;

  const token = {
    ...row,
    capabilities: JSON.parse(row.capabilities),
    actions_log: JSON.parse(row.actions_log || '[]')
  };
  return token;
}

export function revoke(token_id) {
  const db = getDb();
  initRegistryTable(db);

  const now = new Date().toISOString();
  db.prepare('UPDATE agent_registry SET revoked_at = ? WHERE token_id = ?').run(now, token_id);
}

export function getActiveTokens(db) {
  initRegistryTable(db);
  const rows = db.prepare('SELECT * FROM agent_registry WHERE revoked_at IS NULL').all();
  return rows.map(r => ({
    ...r,
    capabilities: JSON.parse(r.capabilities),
    actions_log: JSON.parse(r.actions_log || '[]')
  })).filter(t => !isExpired(t));
}

export function logAction(token_id, action, allowed, nearCeiling = false) {
  const db = getDb();
  initRegistryTable(db);
  const row = db.prepare('SELECT actions_log FROM agent_registry WHERE token_id = ?').get(token_id);
  if (!row) return;
  const actions = JSON.parse(row.actions_log || '[]');
  actions.push({ ts: new Date().toISOString(), action, allowed, nearCeiling });
  db.prepare('UPDATE agent_registry SET actions_log = ? WHERE token_id = ?').run(JSON.stringify(actions), token_id);
}
