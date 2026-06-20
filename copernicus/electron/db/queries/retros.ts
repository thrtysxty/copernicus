import type { Database } from 'libsql';

export function listRetroReports(db: Database, projectId: string): any[] {
  return db.prepare(`
    SELECT * FROM retro_reports
    WHERE project_id = ?
    ORDER BY ts_generated DESC
  `).all(projectId);
}

export function getRetroReport(db: Database, id: string): any {
  const report = db.prepare('SELECT * FROM retro_reports WHERE id = ?').get(id);
  if (!report) return null;

  const items = db.prepare('SELECT * FROM retro_items WHERE retro_id = ?').all(id);
  return { ...report, items };
}

export function createRetroReport(db: Database, data: {
  project_id: string
  scope: string
  status: string
  ts_generated: number
  ts_approved?: number
  sessions_range: string
  inflection_ids?: string
  items: {
    item_type: string
    content: string
    target?: string
    importance?: number
    supersedes_memory_id?: string
    status: string
    edited_content?: string
    ts: number
  }[]
}): string {
  const id = `retro_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  db.transaction(() => {
    db.prepare(`
      INSERT INTO retro_reports (
        id, project_id, scope, status, ts_generated, ts_approved, sessions_range, inflection_ids
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.project_id,
      data.scope,
      data.status,
      data.ts_generated,
      data.ts_approved || null,
      data.sessions_range,
      data.inflection_ids || null
    );

    if (data.items && data.items.length > 0) {
      const insertItem = db.prepare(`
        INSERT INTO retro_items (
          id, retro_id, item_type, content, target, importance, supersedes_memory_id, status, edited_content, ts
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const item of data.items) {
        const itemId = `ritem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        insertItem.run(
          itemId,
          id,
          item.item_type,
          item.content,
          item.target || null,
          item.importance || null,
          item.supersedes_memory_id || null,
          item.status,
          item.edited_content || null,
          item.ts
        );
      }
    }
  })();

  return id;
}

export function updateRetroItem(db: Database, id: string, data: { status: string; edited_content?: string }): boolean {
  db.prepare(`
    UPDATE retro_items
    SET status = ?, edited_content = COALESCE(?, edited_content)
    WHERE id = ?
  `).run(data.status, data.edited_content || null, id);
  return true;
}

export function approveRetroReport(db: Database, id: string, originatedStories: string[]): boolean {
  db.prepare(`
    UPDATE retro_reports
    SET status = 'approved', ts_approved = ?, retro_originated_stories = ?
    WHERE id = ?
  `).run(Date.now(), JSON.stringify(originatedStories), id);
  return true;
}

export function pushRetroReady(db: Database, id: string): boolean {
  db.prepare(`
    UPDATE retro_reports
    SET status = 'pending_review'
    WHERE id = ?
  `).run(id);
  return true;
}
