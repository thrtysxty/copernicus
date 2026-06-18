import type { Database } from 'libsql';
import type { StoryRecord } from '../state-ledger';

export function upsertStory(db: Database, story: StoryRecord): void {
  db.prepare(`
    INSERT INTO stories (id, slug, title, project_id, status, priority, type, epic, assigned_to,
                         blocked_by, blocks, workflow_id, body_md, file_path, date, flagged,
                         updated_at, last_synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            datetime('now'), datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      slug = excluded.slug,
      title = excluded.title,
      project_id = excluded.project_id,
      status = excluded.status,
      priority = excluded.priority,
      type = excluded.type,
      epic = excluded.epic,
      assigned_to = excluded.assigned_to,
      blocked_by = excluded.blocked_by,
      blocks = excluded.blocks,
      workflow_id = excluded.workflow_id,
      body_md = excluded.body_md,
      file_path = excluded.file_path,
      date = excluded.date,
      flagged = excluded.flagged,
      updated_at = datetime('now'),
      last_synced_at = datetime('now')
  `).run(
    story.id,
    story.slug,
    story.title,
    story.project_id,
    story.status,
    story.priority ?? null,
    story.type ?? null,
    story.epic ?? null,
    story.assigned_to ?? null,
    JSON.stringify(story.blocked_by ?? []),
    JSON.stringify(story.blocks ?? []),
    story.workflow_id ?? null,
    story.body_md,
    story.file_path,
    story.date ?? null,
    story.flagged ? 1 : 0
  );
}

export function getStoryById(db: Database, id: string): StoryRecord | undefined {
  return db.prepare(`
    SELECT * FROM stories WHERE id = ?
  `).get(id) as StoryRecord | undefined;
}

export function listStoriesFromDb(db: Database, projectId: string): StoryRecord[] {
  return db.prepare(`
    SELECT * FROM stories WHERE project_id = ? ORDER BY
      CASE status
        WHEN 'IN_PROGRESS' THEN 1
        WHEN 'TESTING' THEN 2
        WHEN 'QA' THEN 3
        WHEN 'DOCUMENTING' THEN 4
        WHEN 'READY' THEN 5
        WHEN 'COMPLETE' THEN 6
        ELSE 7
      END,
      date DESC
  `).all(projectId) as StoryRecord[];
}

export function updateStoryFields(db: Database, id: string, updates: Record<string, unknown>): void {
  const allowedFields = ['status', 'body_md', 'title', 'priority', 'type', 'epic', 'assigned_to', 'workflow_id', 'blocked_by', 'blocks', 'flagged', 'date'];
  const sets: string[] = [];
  const vals: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      sets.push(`${key} = ?`);
      if (key === 'blocked_by' || key === 'blocks') {
        vals.push(JSON.stringify(value));
      } else {
        vals.push(value);
      }
    }
  }

  if (sets.length > 0) {
    vals.push(id);
    db.prepare(`UPDATE stories SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...vals);
  }
}

export function deleteStory(db: Database, id: string): void {
  db.prepare('DELETE FROM stories WHERE id = ?').run(id);
}

export function deleteOrphanedStories(db: Database, projectId: string, validFilePaths: string[]): void {
  if (validFilePaths.length === 0) {
    db.prepare('DELETE FROM stories WHERE project_id = ?').run(projectId);
    return;
  }

  const placeholders = validFilePaths.map(() => '?').join(',');
  db.prepare(`DELETE FROM stories WHERE project_id = ? AND file_path NOT IN (${placeholders})`)
    .run(projectId, ...validFilePaths);
}

export function getStoryByFilePath(db: Database, filePath: string): StoryRecord | undefined {
  return db.prepare('SELECT * FROM stories WHERE file_path = ?').get(filePath) as StoryRecord | undefined;
}