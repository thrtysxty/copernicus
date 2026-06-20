import type { Database } from 'libsql';
import type { JulesSession } from '../types';

export function upsertJulesSession(db: Database, s: JulesSession): void {
  db.prepare(`
    INSERT INTO jules_sessions
      (id, story_id, repo, branch, prompt_hash, status, pr_url, pr_number,
       activities_json, last_search_context, started_at, completed_at, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status              = excluded.status,
      pr_url              = excluded.pr_url,
      pr_number           = excluded.pr_number,
      activities_json     = excluded.activities_json,
      last_search_context = excluded.last_search_context,
      completed_at        = excluded.completed_at,
      error_message       = excluded.error_message
  `).run(
    s.id, s.story_id, s.repo, s.branch, s.prompt_hash ?? null, s.status,
    s.pr_url ?? null, s.pr_number ?? null, s.activities_json ?? null,
    s.last_search_context ?? null, s.started_at ?? null, s.completed_at ?? null, s.error_message ?? null
  );
}

export function getJulesSessionsByStory(db: Database, story_id: string): JulesSession[] {
  return db.prepare('SELECT * FROM jules_sessions WHERE story_id = ? ORDER BY started_at DESC').all(story_id) as JulesSession[];
}

export function listJulesSessions(db: Database, status?: string): JulesSession[] {
  if (status) {
    return db.prepare('SELECT * FROM jules_sessions WHERE status = ? ORDER BY started_at DESC LIMIT 50').all(status) as JulesSession[];
  }
  return db.prepare('SELECT * FROM jules_sessions ORDER BY started_at DESC LIMIT 50').all() as JulesSession[];
}
