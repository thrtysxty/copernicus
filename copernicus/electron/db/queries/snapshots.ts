import type { Database } from 'libsql';
import { randomUUID } from 'node:crypto';

interface SnapshotRow {
  id: string;
  panel_id: string;
  model_id: string;
  provider: string;
  messages: string;
  created_at: number;
}

export function saveSnapshot(db: Database, payload: any): void {
  db.prepare(`
    INSERT OR REPLACE INTO context_snapshots (id, panel_id, model_id, provider, messages, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    payload.id || randomUUID(),
    payload.panel_id,
    payload.model_id,
    payload.provider,
    typeof payload.messages === 'string' ? payload.messages : JSON.stringify(payload.messages),
    Date.now()
  );
}

export function getLatestSnapshot(db: Database, panelId: string): any | null {
  const row = db.prepare('SELECT * FROM context_snapshots WHERE panel_id = ? ORDER BY created_at DESC LIMIT 1').get(panelId) as SnapshotRow | undefined;
  if (!row) return null;
  try {
    return { ...row, messages: JSON.parse(row.messages) };
  } catch (_err) {
    return row;
  }
}
