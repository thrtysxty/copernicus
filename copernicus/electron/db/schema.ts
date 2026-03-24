export const SCHEMA = {

  kanban_columns: `
    CREATE TABLE IF NOT EXISTS kanban_columns (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      color TEXT NOT NULL,
      accent TEXT NOT NULL,
      minimized INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `,

  stories: `
    CREATE TABLE IF NOT EXISTS stories (
      id            TEXT PRIMARY KEY,       -- 'story_159'
      slug          TEXT UNIQUE,            -- 'story_159_settings_panel_rebuild'
      title         TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'DRAFT',
      priority      TEXT,
      type          TEXT,
      epic          TEXT,                   -- free-text epic label
      assigned_to   TEXT,                   -- model/agent
      blocked_by    TEXT DEFAULT '[]',      -- JSON array e.g. '["story_157"]'
      blocks        TEXT DEFAULT '[]',      -- JSON array e.g. '["story_160"]'
      workflow_id   TEXT,                   -- workflow template id e.g. 'jules-pr-manager'
      body_md       TEXT NOT NULL DEFAULT '',
      file_path     TEXT NOT NULL DEFAULT '',
      date          TEXT,
      updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
    CREATE INDEX IF NOT EXISTS idx_events_agent ON events(agent_id);
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
      reasoning       TEXT,
      workflow_run_id TEXT,
      parent_call_id  INTEGER REFERENCES model_calls(id),
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      prompt_text     TEXT,
      response_text   TEXT,
      context_json    TEXT,
      prompt_id       TEXT,
      commit_sha      TEXT
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
      last_search_context TEXT,             -- Top 5 RAG chunks from last search
      started_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at    DATETIME,
      error_message   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_jules_sessions_story
      ON jules_sessions(story_id, started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_jules_sessions_status
      ON jules_sessions(status);
  `,
  review_sessions: `CREATE TABLE IF NOT EXISTS review_sessions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    stories TEXT, -- JSON array
    changed_files TEXT, -- JSON array
    exit_code INTEGER,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  // Note: actual table creation is deferred to CodebaseIndexer after the
  // sqlite-vec extension is loaded. This entry documents the schema only.
  codebase_vec: `
    CREATE VIRTUAL TABLE IF NOT EXISTS codebase_vec USING vec0(
      chunk_id TEXT PRIMARY KEY,
      file_path TEXT,
      line_start INTEGER,
      line_end INTEGER,
      symbols TEXT,
      symbol_uid TEXT,
      lsp_metadata TEXT,
      chunk_index INTEGER,
      content TEXT,
      embedding FLOAT[768]
    );
  `,
  model_performance: `
    CREATE TABLE IF NOT EXISTS model_performance (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id            TEXT NOT NULL,
      provider            TEXT NOT NULL,
      task_type           TEXT NOT NULL,
      timestamp           DATETIME DEFAULT CURRENT_TIMESTAMP,
      duration_ms         INTEGER NOT NULL,
      tokens_used         INTEGER NOT NULL,
      tokens_per_sec      REAL NOT NULL,
      cost_usd            REAL NOT NULL,
      speed_score         REAL NOT NULL,
      cost_score          REAL NOT NULL,
      accuracy_score      REAL NOT NULL,
      adherence_score     REAL NOT NULL,
      composite_qs        REAL NOT NULL,
      verification_passed INTEGER NOT NULL DEFAULT 1,
      worktree_branch     TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_model_performance_model
      ON model_performance(model_id, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_model_performance_task
      ON model_performance(task_type, timestamp DESC);
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
  file_transactions: `
    CREATE TABLE IF NOT EXISTS file_transactions (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL, -- 'COMMITTED' | 'ROLLED_BACK'
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `,
  file_transaction_entries: `
    CREATE TABLE IF NOT EXISTS file_transaction_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      before_hash TEXT,
      after_hash TEXT,
      original_data_path TEXT,
      FOREIGN KEY(transaction_id) REFERENCES file_transactions(id)
    );
    CREATE INDEX IF NOT EXISTS idx_file_tx_entries_tx ON file_transaction_entries(transaction_id);
  `,
  dispatch_queue: `CREATE TABLE IF NOT EXISTS dispatch_queue (
    story_number INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    blocked_by TEXT DEFAULT '[]',
    status TEXT DEFAULT 'waiting',
    added_at TEXT DEFAULT (datetime('now'))
  )`,
  template_overrides: `CREATE TABLE IF NOT EXISTS template_overrides (
    template_id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  workflow_snapshots: `CREATE TABLE IF NOT EXISTS workflow_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, workflow_id TEXT NOT NULL, node_id TEXT NOT NULL, git_sha TEXT NOT NULL, workflow_state TEXT NOT NULL DEFAULT '{}', captured_at TEXT DEFAULT (datetime('now')))`,
  workflow_snapshots_idx: `CREATE INDEX IF NOT EXISTS idx_ws_workflow_id ON workflow_snapshots(workflow_id)`,
  agent_worktrees: `CREATE TABLE IF NOT EXISTS agent_worktrees (
    id           TEXT PRIMARY KEY,
    branch       TEXT NOT NULL UNIQUE,
    story_id     TEXT,
    node_id      TEXT,
    worktree_path TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'active',
    merge_mode   TEXT NOT NULL DEFAULT 'gated',
    commit_sha   TEXT,
    commit_count INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL,
    completed_at TEXT
  )`,
  agent_memory: `
    CREATE TABLE IF NOT EXISTS agent_memory (
      id            TEXT    PRIMARY KEY,
      project_id    TEXT    NOT NULL,
      bank_id       TEXT    NOT NULL,
      event_type    TEXT    NOT NULL,
      content       TEXT    NOT NULL,
      importance    INTEGER NOT NULL DEFAULT 5,
      tags          TEXT,
      entities      TEXT,
      meta          TEXT,
      supersedes_id TEXT    REFERENCES agent_memory(id),
      ts            INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_agent_memory_proj_bank ON agent_memory(project_id, bank_id);
    CREATE INDEX IF NOT EXISTS idx_agent_memory_ts ON agent_memory(ts DESC);
  `,
  agent_work_log: `
    CREATE TABLE IF NOT EXISTS agent_work_log (
      id          TEXT    PRIMARY KEY,
      project_id  TEXT    NOT NULL,
      bank_id     TEXT    NOT NULL,
      event_type  TEXT    NOT NULL,
      meta        TEXT    NOT NULL,
      ts          INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_agent_work_log_proj_bank ON agent_work_log(project_id, bank_id);
    CREATE INDEX IF NOT EXISTS idx_agent_work_log_ts ON agent_work_log(ts DESC);
  `,
  memory_working_set: `
    CREATE VIEW IF NOT EXISTS memory_working_set AS
    SELECT *,
      importance * (1.0 / (1.0 + (unixepoch('now') - ts) / 3600.0 * 0.1)) AS score
    FROM agent_memory
    ORDER BY score DESC;
  `,
  retro_reports: `
    CREATE TABLE IF NOT EXISTS retro_reports (
      id               TEXT PRIMARY KEY,   -- retro_<ulid>
      project_id       TEXT NOT NULL,
      scope            TEXT NOT NULL,      -- 'project' | bank_id
      status           TEXT NOT NULL,      -- 'draft' | 'pending_review' | 'approved' | 'archived'
      ts_generated     INTEGER NOT NULL,
      ts_approved      INTEGER,
      sessions_range   TEXT NOT NULL,      -- JSON: { from_ts, to_ts, session_count }
      inflection_ids   TEXT               -- JSON array of prior retro_report IDs
    );
    CREATE INDEX IF NOT EXISTS idx_retro_reports_project ON retro_reports(project_id, ts_generated DESC);
  `,
  retro_items: `
    CREATE TABLE IF NOT EXISTS retro_items (
      id                    TEXT PRIMARY KEY,  -- ritem_<ulid>
      retro_id              TEXT NOT NULL REFERENCES retro_reports(id),
      item_type             TEXT NOT NULL,     -- 'memory_fact' | 'file_patch' | 'story_queue' | 'convention'
      content               TEXT NOT NULL,
      target                TEXT,
      importance            INTEGER,
      supersedes_memory_id  TEXT,
      status                TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected' | 'edited'
      edited_content        TEXT,
      ts                    INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_retro_items_retro ON retro_items(retro_id);
  `,
  intelligence_documents: `
    CREATE TABLE IF NOT EXISTS intelligence_documents (
      id          TEXT PRIMARY KEY,           -- doc_<ulid>
      project_id  TEXT NOT NULL,
      type        TEXT NOT NULL,              -- 'instruction'|'rule'|'agent'|'skill'|'command'
      title       TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      content     TEXT NOT NULL DEFAULT '',
      path_scope  TEXT,                       -- JSON array of glob strings, nullable
      tool_restrictions TEXT,                 -- JSON array, nullable
      preferred_model TEXT,
      providers   TEXT NOT NULL DEFAULT '[]', -- JSON array of ProviderTarget
      sync_status TEXT NOT NULL DEFAULT '{}', -- JSON Record<ProviderKey, SyncStatusValue>
      ts          INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_intel_docs_project ON intelligence_documents(project_id);
    CREATE INDEX IF NOT EXISTS idx_intel_docs_type    ON intelligence_documents(project_id, type);
  `,
  workflow_waves: `
    CREATE TABLE IF NOT EXISTS workflow_waves (
      id           TEXT PRIMARY KEY,
      workflow_id  TEXT NOT NULL,
      wave_index   INTEGER NOT NULL,
      story_ids    TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'pending',
      started_at   INTEGER,
      completed_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_waves_workflow ON workflow_waves(workflow_id, wave_index);
  `,
  edit_decisions: `
    CREATE TABLE IF NOT EXISTS edit_decisions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      prompt_id   TEXT,
      decision    TEXT,
      file_path   TEXT,
      timestamp   TEXT
    );
  `,
  nlm_notebooks: `
    CREATE TABLE IF NOT EXISTS nlm_notebooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      domain TEXT NOT NULL,
      description TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    );
  `
};
