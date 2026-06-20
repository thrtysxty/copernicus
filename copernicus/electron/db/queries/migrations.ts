import type { Database } from 'libsql';
import { randomUUID } from 'node:crypto';
import type { MemoryFragment } from '../types';

export function migrateStories(db: Database): void {
  const newCols: string[] = [
    'ALTER TABLE stories ADD COLUMN project_id TEXT NOT NULL DEFAULT \'\'',
    'ALTER TABLE stories ADD COLUMN slug TEXT',
    'ALTER TABLE stories ADD COLUMN assigned_to TEXT',
    'ALTER TABLE stories ADD COLUMN blocked_by TEXT DEFAULT \'[]\'',
    'ALTER TABLE stories ADD COLUMN blocks TEXT DEFAULT \'[]\'',
    'ALTER TABLE stories ADD COLUMN workflow_id TEXT',
    'ALTER TABLE stories ADD COLUMN body_md TEXT NOT NULL DEFAULT \'\'',
    'ALTER TABLE stories ADD COLUMN file_path TEXT NOT NULL DEFAULT \'\'',
    'ALTER TABLE stories ADD COLUMN date TEXT',
    'ALTER TABLE stories ADD COLUMN flagged INTEGER DEFAULT 0',
    'ALTER TABLE stories ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE stories RENAME COLUMN epic_id TO epic',
    'ALTER TABLE stories ADD COLUMN epic TEXT',
  ];
  for (const sql of newCols) {
    try { db.exec(sql); } catch (_err) { /* column already exists — ignore */ }
  }

  // Drop the FK constraint on epic (was epic_id FK to epics table — epic is free-text).
  // SQLite can't DROP CONSTRAINT, so rebuild the table if the FK still exists.
  // PRAGMA must be set outside the transaction (SQLite limitation).
  try {
    const fkList = db.pragma('foreign_key_list(stories)') as unknown[];
    const hasFk = fkList.some((r: any) => r.table === 'epics');
    if (hasFk) {
      db.pragma('foreign_keys = OFF');
      db.transaction(() => {
        db.exec(`
          CREATE TABLE stories_rebuilt (
            id             TEXT PRIMARY KEY,
            slug           TEXT UNIQUE,
            title          TEXT NOT NULL,
            project_id     TEXT NOT NULL DEFAULT '',
            status         TEXT NOT NULL DEFAULT 'DRAFT',
            priority       TEXT,
            type           TEXT,
            epic           TEXT,
            assigned_to    TEXT,
            blocked_by     TEXT DEFAULT '[]',
            blocks         TEXT DEFAULT '[]',
            workflow_id    TEXT,
            body_md        TEXT NOT NULL DEFAULT '',
            file_path      TEXT NOT NULL DEFAULT '',
            date           TEXT,
            flagged        INTEGER DEFAULT 0,
            updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          INSERT INTO stories_rebuilt SELECT
            id, slug, title, project_id, status, priority, type, epic, assigned_to,
            blocked_by, blocks, workflow_id, body_md, file_path, date,
            flagged, updated_at, last_synced_at
          FROM stories;
          DROP TABLE stories;
          ALTER TABLE stories_rebuilt RENAME TO stories;
          CREATE INDEX IF NOT EXISTS idx_stories_status ON stories(status);
          CREATE INDEX IF NOT EXISTS idx_stories_priority ON stories(priority, status);
        `);
      })();
      db.pragma('foreign_keys = ON');
    }
  } catch (_err) { /* table already clean — ignore */ }
}

export function migrateAgentMemory(db: Database): void {
  const hasRows = db.prepare('SELECT COUNT(*) as count FROM agent_memory WHERE bank_id = ? AND event_type = ?').get('chat', 'memory_fact') as { count: number } | undefined;

  if (hasRows && hasRows.count === 0) {
    db.transaction(() => {
      const rows = db.prepare('SELECT * FROM project_memory').all() as MemoryFragment[];
      const insertStmt = db.prepare(`
        INSERT INTO agent_memory (id, project_id, bank_id, event_type, content, importance, ts)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const row of rows) {
        const newId = randomUUID();
        insertStmt.run(
          newId,
          'default', // project_id
          'chat',    // bank_id
          'memory_fact', // event_type
          row.content,
          row.importance,
          Math.floor((row.created_at ?? Date.now()) / 1000) // Convert from ms to seconds
        );
      }
    })();
  }
}

export function initKanbanColumns(db: Database): void {
  const existing = db.prepare('SELECT COUNT(*) as count FROM kanban_columns').get() as { count: number } | undefined;
  if (existing && existing.count === 0) {
    const DEFAULT_COLUMNS = [
      { id: 'planning',        status: 'PLANNING',       color: 'bg-slate-500/10 border-slate-500/30',   accent: 'bg-slate-500' },
      { id: 'storyboarding',   status: 'STORYBOARDING',  color: 'bg-purple-500/10 border-purple-500/30', accent: 'bg-purple-500' },
      { id: 'sprint-planning', status: 'SPRINT_PLANNING', color: 'bg-indigo-500/10 border-indigo-500/30', accent: 'bg-indigo-500' },
      { id: 'development',     status: 'IN_PROGRESS',    color: 'bg-yellow-500/10 border-yellow-500/30', accent: 'bg-yellow-500' },
      { id: 'testing',         status: 'TESTING',        color: 'bg-orange-500/10 border-orange-500/30', accent: 'bg-orange-500' },
      { id: 'qa',              status: 'QA',             color: 'bg-amber-500/10 border-amber-500/30',   accent: 'bg-amber-500' },
      { id: 'documenting',     status: 'DOCUMENTING',    color: 'bg-cyan-500/10 border-cyan-500/30',     accent: 'bg-cyan-500' },
      { id: 'ready-to-build',  status: 'READY',          color: 'bg-teal-500/10 border-teal-500/30',     accent: 'bg-teal-500' },
      { id: 'done',            status: 'COMPLETE',       color: 'bg-green-500/10 border-green-500/30',   accent: 'bg-green-500' },
    ];

    const insert = db.prepare(`
      INSERT INTO kanban_columns (id, status, color, accent, minimized, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      DEFAULT_COLUMNS.forEach((col, index) => {
        insert.run(col.id, col.status, col.color, col.accent, 0, index);
      });
    })();
  }
}
