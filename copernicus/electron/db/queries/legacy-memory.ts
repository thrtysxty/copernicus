import type { Database } from 'libsql';
import type { MemoryFragment } from '../types';

export function addMemory(db: Database, content: string, tags: string[] = [], agent_id: string = 'default'): number {
  const stmt = db.prepare('INSERT INTO memory (content, tags, agent_id) VALUES (?, ?, ?)');
  const info = stmt.run(content, JSON.stringify(tags), agent_id);
  return info.lastInsertRowid as number;
}

export function searchMemory(db: Database, query: string): MemoryFragment[] {
  type DbRow = Omit<MemoryFragment, 'tags'> & { tags?: string };
  const rows = db.prepare('SELECT * FROM memory WHERE content LIKE ? ORDER BY created_at DESC LIMIT 10').all(`%${query}%`) as DbRow[];
  return rows.map(row => ({
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : []
  }));
}
