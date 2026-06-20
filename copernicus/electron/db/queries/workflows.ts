import type { Database } from 'libsql';
import type { WorkflowWave } from '../types';

interface WorkflowWaveRow {
  id: string;
  workflowId: string;
  waveIndex: number;
  storyIds: string;
  status: string;
  startedAt: number;
  completedAt: number | null;
}

export function insertWorkflowWave(db: Database, id: string, workflowId: string, waveIndex: number, storyIds: string[], startedAt: number): void {
  db.prepare(`
    INSERT INTO workflow_waves (id, workflow_id, wave_index, story_ids, status, started_at)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `).run(id, workflowId, waveIndex, JSON.stringify(storyIds), startedAt);
}

export function updateWorkflowWaveStatus(db: Database, id: string, status: string, completedAt?: number): void {
  if (completedAt) {
    db.prepare(`
      UPDATE workflow_waves SET status = ?, completed_at = ? WHERE id = ?
    `).run(status, completedAt, id);
  } else {
    db.prepare(`
      UPDATE workflow_waves SET status = ? WHERE id = ?
    `).run(status, id);
  }
}

export function getWorkflowWaves(db: Database, workflowId: string): WorkflowWave[] {
  const rows = db.prepare(`
    SELECT id, workflow_id as workflowId, wave_index as waveIndex, story_ids as storyIds, status, started_at as startedAt, completed_at as completedAt
    FROM workflow_waves
    WHERE workflow_id = ?
    ORDER BY wave_index ASC
  `).all(workflowId) as WorkflowWaveRow[];

  return rows.map(r => ({
    id: r.id,
    workflowId: r.workflowId,
    waveIndex: r.waveIndex,
    storyIds: JSON.parse(r.storyIds || '[]'),
    status: r.status,
    startedAt: r.startedAt,
    completedAt: r.completedAt ?? null
  }));
}
