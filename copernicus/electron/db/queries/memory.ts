import type { Database } from 'libsql';
import type { MemoryFragment } from '../types';

export function addAgentMemory(db: Database, params: { id: string, projectId: string, bankId: string, eventType: string, content: string, importance: number, tags: string | null, entities: string | null, meta: string | null, ts: number }): void {
  db.prepare(`
    INSERT INTO agent_memory (id, project_id, bank_id, event_type, content, importance, tags, entities, meta, ts)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.id, params.projectId, params.bankId, params.eventType, params.content, params.importance,
    params.tags, params.entities, params.meta, params.ts
  );
}

export function getAllAgentMemoryForProject(db: Database, projectId: string): MemoryFragment[] {
  return db.prepare('SELECT * FROM agent_memory WHERE project_id = ?').all(projectId) as MemoryFragment[];
}

export function getMemoryWorkingSet(db: Database, projectId: string, bankId: string, limit: number): any[] {
  return db.prepare(`
    SELECT * FROM memory_working_set
    WHERE project_id = ? AND bank_id = ?
    ORDER BY score DESC
    LIMIT ?
  `).all(projectId, bankId, limit);
}

export function getMemoryWorkingSetForProject(db: Database, projectId: string, limit: number, bankId?: string): any[] {
  if (bankId) {
    return db.prepare(`
      SELECT * FROM memory_working_set
      WHERE project_id = ? AND bank_id = ?
      ORDER BY score DESC
      LIMIT ?
    `).all(projectId, bankId, limit);
  } else {
    return db.prepare(`
      SELECT * FROM memory_working_set
      WHERE project_id = ?
      ORDER BY score DESC
      LIMIT ?
    `).all(projectId, limit);
  }
}

export function getAgentMemoryTimeRange(db: Database, projectId: string, fromTs: number, toTs: number, limit: number): MemoryFragment[] {
  return db.prepare(`
    SELECT * FROM agent_memory
    WHERE project_id = ? AND ts BETWEEN ? AND ?
    ORDER BY ts ASC LIMIT ?
  `).all(projectId, fromTs, toTs, limit) as MemoryFragment[];
}

export function recallAgentMemory(db: Database, projectId: string, bankId: string, query: string, limit: number): MemoryFragment[] {
  return db.prepare(`
    SELECT * FROM memory_working_set
    WHERE project_id = ? AND bank_id = ? AND content LIKE ?
    ORDER BY score DESC
    LIMIT ?
  `).all(projectId, bankId, `%${query}%`, limit) as MemoryFragment[];
}

export function supersedeMemory(db: Database, oldId: string, newId: string): void {
  db.transaction(() => {
    db.prepare(`
      UPDATE agent_memory SET importance = 1 WHERE id = ?
    `).run(oldId);

    db.prepare(`
      UPDATE agent_memory SET supersedes_id = ? WHERE id = ?
    `).run(newId, oldId);
  })();
}

export function demoteMemoryImportance(db: Database, id: string): void {
  db.prepare(`
    UPDATE agent_memory SET importance = 1 WHERE id = ?
  `).run(id);
}

export function logAgentWork(db: Database, params: { id: string, projectId: string, bankId: string, eventType: string, meta: string, ts: number }): void {
  db.prepare(`
    INSERT INTO agent_work_log (id, project_id, bank_id, event_type, meta, ts)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(params.id, params.projectId, params.bankId, params.eventType, params.meta, params.ts);
}

export function getAgentWorkLog(db: Database, projectId: string, bankId: string, limit: number): any[] {
  return db.prepare(`
    SELECT * FROM agent_work_log
    WHERE project_id = ? AND bank_id = ?
    ORDER BY ts DESC
    LIMIT ?
  `).all(projectId, bankId, limit);
}

export function getAgentWorkLogTimeRange(db: Database, projectId: string, fromTs: number, toTs: number, limit: number): any[] {
  return db.prepare(`
    SELECT * FROM agent_work_log
    WHERE project_id = ? AND ts BETWEEN ? AND ?
    ORDER BY ts DESC
    LIMIT ?
  `).all(projectId, fromTs, toTs, limit);
}
