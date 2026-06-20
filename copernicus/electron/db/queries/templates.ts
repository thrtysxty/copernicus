import type { Database } from 'libsql';

interface TemplateOverrideRow {
  template_id: string;
  content: string;
  updated_at: string;
}

export function getTemplateOverride(db: Database, id: string): { content: string } | null {
  const row = db.prepare('SELECT content FROM template_overrides WHERE template_id = ?').get(id) as TemplateOverrideRow | undefined;
  return row ? { content: row.content } : null;
}

export function saveTemplateOverride(db: Database, id: string, content: string): void {
  db.prepare(`
    INSERT INTO template_overrides (template_id, content, updated_at)
    VALUES (?, ?, (datetime('now')))
    ON CONFLICT(template_id) DO UPDATE SET
      content = excluded.content,
      updated_at = excluded.updated_at
  `).run(id, content);
}

export function deleteTemplateOverride(db: Database, id: string): void {
  db.prepare('DELETE FROM template_overrides WHERE template_id = ?').run(id);
}
