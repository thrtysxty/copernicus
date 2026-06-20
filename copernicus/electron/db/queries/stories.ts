import type { Database } from 'libsql';
import type { StoryRecord } from '../types';

export function upsertStory(db: Database, story: StoryRecord): void {
  db.prepare(`
    INSERT INTO stories
      (id, slug, title, project_id, status, priority, type, epic, assigned_to,
       blocked_by, blocks, workflow_id, body_md, file_path, date, flagged,
       updated_at, last_synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      slug           = excluded.slug,
      title          = excluded.title,
      project_id     = excluded.project_id,
      status         = excluded.status,
      priority       = excluded.priority,
      type           = excluded.type,
      epic           = excluded.epic,
      assigned_to    = excluded.assigned_to,
      blocked_by     = excluded.blocked_by,
      blocks         = excluded.blocks,
      workflow_id    = excluded.workflow_id,
      body_md        = excluded.body_md,
      file_path      = excluded.file_path,
      date           = excluded.date,
      flagged        = excluded.flagged,
      updated_at     = CURRENT_TIMESTAMP,
      last_synced_at = CURRENT_TIMESTAMP
  `).run(
    story.id, story.slug ?? null, story.title, story.project_id, story.status,
    story.priority ?? null, story.type ?? null, story.epic ?? null, story.assigned_to ?? null,
    JSON.stringify(story.blocked_by ?? []), JSON.stringify(story.blocks ?? []),
    story.workflow_id ?? null,
    story.body_md, story.file_path, story.date ?? null,
    story.flagged ? 1 : 0
  )
}

export function getStoryById(db: Database, id: string): StoryRecord | null {
  const row = db.prepare('SELECT * FROM stories WHERE id = ?').get(id) as StoryRecord | undefined;
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    project_id: row.project_id,
    status: row.status,
    priority: row.priority,
    type: row.type,
    epic: row.epic,
    assigned_to: row.assigned_to,
    blocked_by: row.blocked_by ? JSON.parse(row.blocked_by as unknown as string) : [],
    blocks: row.blocks ? JSON.parse(row.blocks as unknown as string) : [],
    workflow_id: row.workflow_id,
    body_md: row.body_md,
    file_path: row.file_path,
    date: row.date,
    flagged: row.flagged ? true : false,
    updated_at: row.updated_at,
    last_synced_at: row.last_synced_at
  };
}

export function listStoriesFromDb(db: Database, projectId?: string): StoryRecord[] {
  let rows: any[];
  if (projectId !== undefined) {
    rows = db.prepare('SELECT * FROM stories WHERE project_id = ? ORDER BY id DESC').all(projectId) as StoryRecord[];
  } else {
    rows = db.prepare('SELECT * FROM stories ORDER BY id DESC').all() as StoryRecord[];
  }
  return rows.map(r => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    project_id: r.project_id,
    status: r.status,
    priority: r.priority,
    type: r.type,
    epic: r.epic,
    assigned_to: r.assigned_to,
    blocked_by: r.blocked_by ? JSON.parse(r.blocked_by) : [],
    blocks: r.blocks ? JSON.parse(r.blocks) : [],
    workflow_id: r.workflow_id,
    body_md: r.body_md,
    file_path: r.file_path,
    date: r.date,
    flagged: r.flagged === 1,
    updated_at: r.updated_at,
    last_synced_at: r.last_synced_at
  }));
}

export function updateStoryFields(db: Database, id: string, fields: Partial<Pick<StoryRecord,
  'status' | 'priority' | 'type' | 'epic' | 'assigned_to' | 'workflow_id' | 'body_md' | 'file_path' | 'flagged'
>>): void {
  const allowed = ['status','priority','type','epic','assigned_to','workflow_id','body_md','file_path','flagged']
  const sets: string[] = []
  const vals: any[] = []
  for (const [k, v] of Object.entries(fields)) {
    if (allowed.includes(k)) {
      sets.push(`${k} = ?`);
      vals.push(k === 'flagged' ? (v ? 1 : 0) : v)
    }
  }
  if (!sets.length) return
  sets.push('updated_at = CURRENT_TIMESTAMP')
  vals.push(id)
  db.prepare(`UPDATE stories SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
}

export function deleteStory(db: Database, id: string): void {
  db.prepare('DELETE FROM stories WHERE id = ?').run(id)
}

export function deleteOrphanedStories(db: Database, projectId: string, validFilePaths: string[]): void {
  if (validFilePaths.length === 0) {
    db.prepare('DELETE FROM stories WHERE project_id = ?').run(projectId)
    return
  }
  const placeholders = validFilePaths.map(() => '?').join(',')
  const sql = `DELETE FROM stories WHERE project_id = ? AND file_path NOT IN (${placeholders})`
  db.prepare(sql).run(projectId, ...validFilePaths)
}

export function getStoryByFilePath(db: Database, filePath: string): StoryRecord | null {
  const row = db.prepare('SELECT * FROM stories WHERE file_path = ?').get(filePath) as any;
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    project_id: row.project_id,
    status: row.status,
    priority: row.priority,
    type: row.type,
    epic: row.epic,
    assigned_to: row.assigned_to,
    blocked_by: row.blocked_by ? JSON.parse(row.blocked_by as unknown as string) : [],
    blocks: row.blocks ? JSON.parse(row.blocks as unknown as string) : [],
    workflow_id: row.workflow_id,
    body_md: row.body_md,
    file_path: row.file_path,
    date: row.date,
    flagged: row.flagged ? true : false,
    updated_at: row.updated_at,
    last_synced_at: row.last_synced_at
  };
}

export function getStoriesThroughput(db: Database): any[] {
  return db.prepare(`
    SELECT strftime('%Y-W%W', updated_at) as week, COUNT(*) as completed
    FROM stories WHERE status = 'COMPLETE' AND updated_at >= date('now', '-84 days')
    GROUP BY week ORDER BY week ASC
  `).all();
}

export function getStoriesStatusDistribution(db: Database): any[] {
  return db.prepare(`
    SELECT status, COUNT(*) as count FROM stories GROUP BY status ORDER BY count DESC
  `).all();
}

export function getStoriesBugsByAssignee(db: Database): any[] {
  return db.prepare(`
    SELECT COALESCE(assigned_to, 'unassigned') as assignee, COUNT(*) as bug_count
    FROM stories WHERE type = 'bug' GROUP BY assigned_to ORDER BY bug_count DESC
  `).all();
}
