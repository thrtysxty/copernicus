CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL,
  component TEXT NOT NULL,
  phase TEXT NOT NULL,
  story TEXT,
  start_time DATETIME NOT NULL,
  end_time DATETIME,
  duration_seconds INTEGER,
  description TEXT,
  commits TEXT,
  capitalizable BOOLEAN DEFAULT 0,
  value REAL,
  rate REAL DEFAULT 65.0
);
