export const SCHEMA = {
  intents: `
    CREATE TABLE IF NOT EXISTS intents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      agent_id TEXT DEFAULT 'default'
    );
  `,
  events: `
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT, -- JSON string
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      agent_id TEXT DEFAULT 'default'
    );
  `,
  memory: `
    CREATE TABLE IF NOT EXISTS memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      tags TEXT, -- Comma-separated or JSON
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      agent_id TEXT DEFAULT 'default'
    );
  `,
  shared_assets: `
    CREATE TABLE IF NOT EXISTS shared_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      content_hash TEXT,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `
};
