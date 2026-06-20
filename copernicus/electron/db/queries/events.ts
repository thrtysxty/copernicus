import type { Database } from 'libsql';
import type { EventLog } from '../types';

export function logEvent(db: Database, type: string, content: string, metadata: any = {}, agent_id: string = 'default'): number {
  const stmt = db.prepare('INSERT INTO events (type, content, metadata, agent_id) VALUES (?, ?, ?, ?)');
  const info = stmt.run(type, content, JSON.stringify(metadata), agent_id);
  return info.lastInsertRowid as number;
}

export function getRecentEvents(db: Database, limit: number = 50): EventLog[] {
  const rows = db.prepare(`
    SELECT e.*, m.prompt_id, m.commit_sha
    FROM events e
    LEFT JOIN model_calls m ON CASE WHEN json_valid(e.content) THEN json_extract(e.content, '$.session_id') ELSE NULL END = m.session_id
    ORDER BY e.created_at DESC LIMIT ?
  `).all(limit) as (EventLog & { prompt_id?: string; commit_sha?: string })[];
  return rows.map(row => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : {},
    promptId: row.prompt_id || null,
    commitSha: row.commit_sha || null
  }));
}
