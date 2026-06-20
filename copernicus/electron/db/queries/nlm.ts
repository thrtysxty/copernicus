import type { Database } from 'libsql';

export function getNlmNotebooks(db: Database) {
  return db.prepare('SELECT * FROM nlm_notebooks ORDER BY created_at DESC').all();
}

export function registerNlmNotebook(db: Database, notebook: { id: string; name: string; domain: string; description: string }) {
  db.prepare(`
    INSERT INTO nlm_notebooks (id, name, domain, description)
    VALUES (@id, @name, @domain, @description)
    ON CONFLICT(id) DO UPDATE SET
      name = @name,
      domain = @domain,
      description = @description
  `).run(notebook);
  return getNlmNotebooks(db);
}

export function removeNlmNotebook(db: Database, id: string) {
  db.prepare('DELETE FROM nlm_notebooks WHERE id = ?').run(id);
  return getNlmNotebooks(db);
}
