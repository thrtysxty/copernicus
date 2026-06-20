import type { Database } from 'libsql';
import * as crypto from 'crypto';
import type { MemoryFragment } from '../types';

export function insertAgentWorkLog(
  db: Database,
  params: { id: string, projectId: string, bankId: string, eventType: string, meta: string, ts: number }
): void {
  db.prepare(`
    INSERT INTO agent_work_log (id, project_id, bank_id, event_type, meta, ts)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(params.id, params.projectId, params.bankId, params.eventType, params.meta, params.ts);
}

export function addProjectMemory(
  db: Database,
  payload: { content: string, importance?: number, source: string }
): void {
  const fingerprint = payload.content.trim().slice(0, 120);
  const existing = db.prepare('SELECT id FROM project_memory WHERE substr(content, 1, 120) = ?').get(fingerprint);
  if (existing) return;
  db.prepare(`
    INSERT INTO project_memory (id, content, importance, source, created_at, last_accessed)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), payload.content, payload.importance ?? 3, payload.source, Date.now(), Date.now());
}

export function searchProjectMemory(db: Database, limit: number = 5): MemoryFragment[] {
  return db.prepare(`
    SELECT * FROM project_memory ORDER BY (importance * 1.0 / (1.0 + (strftime('%s', 'now') * 1000 - created_at) / 86400000.0)) DESC LIMIT ?
  `).all(limit) as MemoryFragment[];
}

export function getFailedAgentWorkLog(db: Database, projectId: string, storyId: string, failedAgentId: string): any[] {
  return db.prepare(`
    SELECT * FROM agent_work_log
    WHERE project_id = ?
      AND (
        json_extract(meta, '$.sessionId') = ?
        OR json_extract(meta, '$.nodeId') = ?
        OR (bank_id = ? AND event_type IN ('tool_call', 'file_edit', 'git_commit', 'error'))
      )
    ORDER BY ts ASC
  `).all(projectId, failedAgentId, failedAgentId, storyId);
}
