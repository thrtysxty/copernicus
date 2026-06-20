import type { Database } from 'libsql';
import type { ProjectRecord } from '../types';

export function upsertProject(db: Database, p: ProjectRecord): void {
  db.prepare(`
    INSERT INTO projects (id, path, billing_mode, billing_details, target_device, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(path) DO UPDATE SET
      id = excluded.id,
      billing_mode = excluded.billing_mode,
      billing_details = excluded.billing_details,
      target_device = excluded.target_device,
      updated_at = CURRENT_TIMESTAMP
  `).run(p.id, p.path, p.billing_mode, p.billing_details ?? null, p.target_device ?? 'AGNOSTIC');
}

export function updateProjectTargetDevice(db: Database, path: string, targetDevice: string): void {
  db.prepare(`
    UPDATE projects
    SET target_device = ?, updated_at = CURRENT_TIMESTAMP
    WHERE path = ?
  `).run(targetDevice, path);
}

export function getProjectByPath(db: Database, path: string): ProjectRecord | null {
  const row = db.prepare('SELECT * FROM projects WHERE path = ?').get(path) as ProjectRecord | undefined;
  return row ?? null;
}

export function getProjectById(db: Database, id: string): ProjectRecord | null {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRecord | undefined;
  return row ?? null;
}
