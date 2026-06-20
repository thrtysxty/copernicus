import type { Database } from 'libsql';
import type { Intent } from '../types';

export function logIntent(db: Database, content: string, status: string = 'pending', agent_id: string = 'default'): number {
  const stmt = db.prepare('INSERT INTO intents (content, status, agent_id) VALUES (?, ?, ?)');
  const info = stmt.run(content, status, agent_id);
  return info.lastInsertRowid as number;
}

export function getRecentIntents(db: Database, limit: number = 10): Intent[] {
  return db.prepare('SELECT * FROM intents ORDER BY created_at DESC LIMIT ?').all(limit) as Intent[];
}
