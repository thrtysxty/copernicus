-- COPERNICUS DevTime Session Schema
-- Canonical definition. Matches electron/devtime-manager.ts CREATE TABLE exactly.

CREATE TABLE IF NOT EXISTS dev_sessions (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  date               TEXT    NOT NULL,
  start_time         TEXT,
  duration           REAL    NOT NULL CHECK (duration >= 0.25),
  phase              TEXT    NOT NULL CHECK (phase IN (
                         'PRELIMINARY', 'DEVELOPMENT', 'POST_IMPLEMENTATION')),
  financial_category TEXT    NOT NULL CHECK (financial_category IN ('CAPEX', 'OPEX', 'NONE')),
  component          TEXT    NOT NULL,
  description        TEXT    NOT NULL,
  commits            TEXT,
  story_id           TEXT,
  capitalizable      INTEGER GENERATED ALWAYS AS (
                         CASE WHEN financial_category = 'CAPEX' AND phase = 'DEVELOPMENT'
                              THEN 1 ELSE 0 END
                     ) STORED,
  created_at         TEXT    DEFAULT (datetime('now')),
  value              REAL
);

CREATE INDEX IF NOT EXISTS idx_dev_sessions_date  ON dev_sessions(date);
CREATE INDEX IF NOT EXISTS idx_dev_sessions_story ON dev_sessions(story_id);
