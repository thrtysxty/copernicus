export const SCHEMA = {
  stories: `
    CREATE TABLE IF NOT EXISTS stories (
      id            TEXT PRIMARY KEY,       -- 'story_159'
      slug          TEXT UNIQUE,            -- 'story_159_settings_panel_rebuild'
      title         TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'DRAFT',
      priority      TEXT,
      type          TEXT,
      epic_id       TEXT,                   -- reference to epics table
      assigned_to   TEXT,                   -- model/agent
      blocked_by    TEXT DEFAULT '[]',      -- JSON array e.g. '["story_157"]'
      blocks        TEXT DEFAULT '[]',      -- JSON array e.g. '["story_160"]'
      workflow_id   TEXT,                   -- workflow template id e.g. 'jules-pr-manager'
      body_md       TEXT NOT NULL DEFAULT '',
      file_path     TEXT NOT NULL DEFAULT '',
      date          TEXT,
      updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(epic_id) REFERENCES epics(id)
    );
    CREATE INDEX IF NOT EXISTS idx_stories_status
      ON stories(status);
    CREATE INDEX IF NOT EXISTS idx_stories_priority
      ON stories(priority, status);
  `,
  projects: `
    CREATE TABLE IF NOT EXISTS projects (
      id            TEXT PRIMARY KEY,       -- repo full name e.g. 'owner/repo'
      path          TEXT UNIQUE NOT NULL,    -- local filesystem path
      billing_mode  TEXT DEFAULT 'NONE',    -- 'CAPEX', 'OPEX', 'NONE'
      billing_details TEXT,                 -- JSON string for specific billing info
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `,
  epics: `
    CREATE TABLE IF NOT EXISTS epics (
      id            TEXT PRIMARY KEY,       -- e.g. 'epic_001'
      project_id    TEXT NOT NULL,          -- reference to projects(id)
      title         TEXT NOT NULL,
      description   TEXT,
      status        TEXT DEFAULT 'OPEN',
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );
  `,
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
  context_snapshots: `
    CREATE TABLE IF NOT EXISTS context_snapshots (
      id TEXT PRIMARY KEY,
      panel_id TEXT NOT NULL,      -- 'chat' | 'workflow:node:<id>' | 'agent:<name>'
      model_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      messages TEXT NOT NULL,      -- JSON serialised message array
      created_at INTEGER NOT NULL
    );
  `,
  project_memory: `
    CREATE TABLE IF NOT EXISTS project_memory (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      importance INTEGER NOT NULL DEFAULT 3,    -- 1–10
      source TEXT NOT NULL,                     -- 'manual' | 'auto'
      created_at INTEGER NOT NULL,
      last_accessed INTEGER
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
  `,
  test_runs: `
    CREATE TABLE IF NOT EXISTS test_runs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      run_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_tests   INTEGER NOT NULL DEFAULT 0,
      passed        INTEGER NOT NULL DEFAULT 0,
      failed        INTEGER NOT NULL DEFAULT 0,
      skipped       INTEGER NOT NULL DEFAULT 0,
      coverage_pct  REAL,
      duration_ms   INTEGER
    );
  `,
  model_calls: `
    CREATE TABLE IF NOT EXISTS model_calls (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id      TEXT NOT NULL,
      panel_id        TEXT NOT NULL DEFAULT 'chat',
      model_id        TEXT NOT NULL,
      provider        TEXT NOT NULL,
      tokens_in       INTEGER NOT NULL DEFAULT 0,
      tokens_out      INTEGER NOT NULL DEFAULT 0,
      cost_usd        REAL NOT NULL DEFAULT 0,
      latency_ms      INTEGER,
      workflow_run_id TEXT,
      parent_call_id  INTEGER REFERENCES model_calls(id),
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_model_calls_session
      ON model_calls(session_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_model_calls_model
      ON model_calls(model_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_model_calls_panel
      ON model_calls(panel_id, created_at DESC);
  `,
  jules_sessions: `
    CREATE TABLE IF NOT EXISTS jules_sessions (
      id              TEXT PRIMARY KEY,      -- Jules session UUID
      story_id        TEXT NOT NULL,         -- e.g. 'story_159'
      repo            TEXT NOT NULL,         -- GitHub repo full name: 'owner/repo'
      branch          TEXT NOT NULL,         -- target branch sent to Jules
      prompt_hash     TEXT,                  -- SHA-1 of prompt (dedup / audit)
      status          TEXT NOT NULL DEFAULT 'pending',
      pr_url          TEXT,
      pr_number       INTEGER,
      activities_json TEXT,                  -- latest raw activity payload
      started_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at    DATETIME,
      error_message   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_jules_sessions_story
      ON jules_sessions(story_id, started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_jules_sessions_status
      ON jules_sessions(status);
  `,
  dev_sessions: `
    CREATE TABLE IF NOT EXISTS dev_sessions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      date        TEXT    NOT NULL,
      start_time  TEXT,
      duration_hours REAL NOT NULL CHECK (duration_hours >= 0.25),
      phase       TEXT    NOT NULL CHECK (phase IN (
                      'PLANNING', 'DEVELOPMENT', 'BUG_FIXING', 'MAINTENANCE')),
      financial_category TEXT NOT NULL CHECK (financial_category IN ('CAPEX', 'OPEX', 'NONE')),
      component   TEXT    NOT NULL,
      description TEXT    NOT NULL,
      commits     TEXT,
      story_id    TEXT,
      capitalizable INTEGER GENERATED ALWAYS AS (
          CASE WHEN financial_category = 'CAPEX' AND phase = 'DEVELOPMENT'
               THEN 1 ELSE 0 END
      ) STORED,
      created_at  TEXT DEFAULT (datetime('now')),
      value       REAL
    );
    CREATE INDEX IF NOT EXISTS idx_dev_sessions_story
      ON dev_sessions(story_id, date);
    CREATE INDEX IF NOT EXISTS idx_dev_sessions_date
      ON dev_sessions(date);
  `,
};
