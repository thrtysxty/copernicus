import type { Database } from 'libsql';
import type { KanbanColumnRecord } from '../state-ledger';

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

export function getKanbanColumns(db: Database): KanbanColumnRecord[] {
  return db.prepare('SELECT * FROM kanban_columns ORDER BY sort_order ASC').all() as KanbanColumnRecord[];
}

export function setKanbanColumn(db: Database, id: string, updates: Partial<KanbanColumnRecord>): void {
  const existing = db.prepare('SELECT * FROM kanban_columns WHERE id = ?').get(id);
  if (!existing) {
    throw new Error('column not found');
  }

  const sets: string[] = [];
  const vals: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (['status', 'color', 'accent', 'minimized', 'sort_order'].includes(key)) {
      sets.push(`${key} = ?`);
      vals.push(value);
    }
  }

  if (sets.length > 0) {
    vals.push(id);
    db.prepare(`UPDATE kanban_columns SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }
}
