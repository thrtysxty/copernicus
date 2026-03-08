import * as crypto from 'crypto';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { SCHEMA } from './schema';

export interface Intent {
  id?: number;
  content: string;
  status: string;
  agent_id?: string;
  created_at?: string;
}

export interface EventLog {
  id?: number;
  type: string;
  content: string;
  metadata?: any;
  agent_id?: string;
  created_at?: string;
}

export interface MemoryFragment {
  id?: number;
  content: string;
  tags?: string[];
  agent_id?: string;
  created_at?: string;
}

export interface SharedAsset {
  id?: number;
  path: string;
  type: string;
  content_hash?: string;
  last_updated?: string;
}

export interface StoryRecord {
  id: string
  slug?: string
  title: string
  status: string
  priority?: string
  type?: string
  epic?: string
  assigned_to?: string
  blocked_by?: string[]   // deserialized from JSON
  blocks?: string[]       // deserialized from JSON
  workflow_id: string | null
  body_md: string
  file_path: string
  date?: string
  flagged?: boolean
  updated_at?: string
  last_synced_at?: string
}

export interface ProjectRecord {
  id: string;            // 'owner/repo'
  path: string;          // local filesystem path
  billing_mode: string;  // 'CAPEX', 'OPEX', 'NONE'
  billing_details?: string; // JSON string
  created_at?: string;
  updated_at?: string;
}

export interface TestRunRecord {
  id?: number;
  run_at?: string;
  total_tests: number;
  passed: number;
  failed: number;
  skipped: number;
  coverage_pct: number | null;
  duration_ms: number | null;
}

export interface ModelCallRecord {
  id?: number;
  session_id: string;
  panel_id: string;
  model_id: string;
  provider: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  latency_ms?: number;
  reasoning?: string;
  workflow_run_id?: string;
  parent_call_id?: number;
  created_at?: string;
}

export interface ModelCallStats {
  total_calls: number
  total_tokens_in: number
  total_tokens_out: number
  total_cost_usd: number
  by_model: Array<{ model_id: string; provider: string; calls: number; tokens_in: number; tokens_out: number; cost_usd: number }>
}

export interface JulesSession {
  id: string
  story_id: string
  repo: string
  branch: string
  prompt_hash?: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  pr_url?: string
  pr_number?: number
  activities_json?: string
  started_at?: string
  completed_at?: string
  error_message?: string
}

export class StateLedger {
  public db: Database.Database;

  constructor(dbPath?: string) {
    const finalPath = dbPath ?? path.join(app.getPath('userData'), 'copernicus.db');

    const dir = path.dirname(finalPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(finalPath);
    this.init();
  }

  private init() {
    this.db.pragma('journal_mode = WAL');
    this.db.exec(SCHEMA.intents);
    this.db.exec(SCHEMA.events);
    this.db.exec(SCHEMA.memory);
    this.db.exec(SCHEMA.shared_assets);
    this.db.exec(SCHEMA.context_snapshots);
    this.db.exec(SCHEMA.project_memory);

    // Story Persistence (Story 160)
    this.db.exec(SCHEMA.stories);
    this.migrateStories();

    // Jules Sessions (Story 161)
    this.db.exec(SCHEMA.jules_sessions);

    // Test Runs (Story 162)
    this.db.exec(SCHEMA.test_runs);

    // Model Call Ledger (Story 156)
    this.db.exec(SCHEMA.model_calls);

    // Projects & Epics (Story 211)
    this.db.exec(SCHEMA.projects);
    this.db.exec(SCHEMA.epics);

    // Dev Sessions (from DevtimeManager integration)
    this.db.exec(SCHEMA.dev_sessions);
  }

  // ── Projects & Epics (Story 211) ──────────────────────────────────────────

  upsertProject(p: ProjectRecord): void {
    this.db.prepare(`
      INSERT INTO projects (id, path, billing_mode, billing_details, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(path) DO UPDATE SET
        id = excluded.id,
        billing_mode = excluded.billing_mode,
        billing_details = excluded.billing_details,
        updated_at = CURRENT_TIMESTAMP
    `).run(p.id, p.path, p.billing_mode, p.billing_details ?? null)
  }

  getProjectByPath(path: string): ProjectRecord | null {
    const row = this.db.prepare('SELECT * FROM projects WHERE path = ?').get(path) as any
    return row ?? null
  }

  getProjectById(id: string): ProjectRecord | null {
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any
    return row ?? null
  }

  // ── Test Runs (Story 162) ────────────────────────────────────────────────

  upsertTestRun(data: Omit<TestRunRecord, 'id' | 'run_at'>): number {
    const info = this.db.prepare(`
      INSERT INTO test_runs (total_tests, passed, failed, skipped, coverage_pct, duration_ms)
      VALUES (@total_tests, @passed, @failed, @skipped, @coverage_pct, @duration_ms)
    `).run(data)
    return info.lastInsertRowid as number
  }

  getTestRunHistory(limit = 20): TestRunRecord[] {
    return this.db.prepare(
      'SELECT * FROM test_runs ORDER BY run_at DESC LIMIT ?'
    ).all(limit) as TestRunRecord[]
  }

  // ── Model Call Ledger (Story 156) ────────────────────────────────────────

  logModelCall(record: Omit<ModelCallRecord, 'id' | 'created_at'>): number {
    const info = this.db.prepare(`
      INSERT INTO model_calls
        (session_id, panel_id, model_id, provider, tokens_in, tokens_out,
         cost_usd, latency_ms, reasoning, workflow_run_id, parent_call_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.session_id, record.panel_id, record.model_id, record.provider,
      record.tokens_in, record.tokens_out, record.cost_usd,
      record.latency_ms ?? null, record.reasoning ?? null,
      record.workflow_run_id ?? null,
      record.parent_call_id ?? null
    )
    return info.lastInsertRowid as number
  }

  getSessionStats(session_id: string): ModelCallStats {
    const total = this.db.prepare(`
      SELECT COUNT(*) as total_calls,
             SUM(tokens_in) as total_tokens_in,
             SUM(tokens_out) as total_tokens_out,
             SUM(cost_usd) as total_cost_usd
      FROM model_calls WHERE session_id = ?
    `).get(session_id) as any

    const byModel = this.db.prepare(`
      SELECT model_id, provider,
             COUNT(*) as calls,
             SUM(tokens_in) as tokens_in,
             SUM(tokens_out) as tokens_out,
             SUM(cost_usd) as cost_usd
      FROM model_calls WHERE session_id = ?
      GROUP BY model_id, provider ORDER BY calls DESC
    `).all(session_id) as any[]

    return {
      total_calls:      total.total_calls      ?? 0,
      total_tokens_in:  total.total_tokens_in  ?? 0,
      total_tokens_out: total.total_tokens_out ?? 0,
      total_cost_usd:   total.total_cost_usd   ?? 0,
      by_model: byModel,
    }
  }

  getRecentCalls(limit = 100, panel_id?: string): ModelCallRecord[] {
    if (panel_id) {
      return this.db.prepare(
        'SELECT * FROM model_calls WHERE panel_id = ? ORDER BY created_at DESC LIMIT ?'
      ).all(panel_id, limit) as ModelCallRecord[]
    }
    return this.db.prepare(
      'SELECT * FROM model_calls ORDER BY created_at DESC LIMIT ?'
    ).all(limit) as ModelCallRecord[]
  }

  getAllTimeCost(): number {
    const row = this.db.prepare('SELECT SUM(cost_usd) as total FROM model_calls').get() as any
    return row?.total ?? 0
  }

  // ── Jules Sessions (Story 161) ──────────────────────────────────────────

  upsertJulesSession(s: JulesSession): void {
    this.db.prepare(`
      INSERT INTO jules_sessions
        (id, story_id, repo, branch, prompt_hash, status, pr_url, pr_number,
         activities_json, started_at, completed_at, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status          = excluded.status,
        pr_url          = excluded.pr_url,
        pr_number       = excluded.pr_number,
        activities_json = excluded.activities_json,
        completed_at    = excluded.completed_at,
        error_message   = excluded.error_message
    `).run(
      s.id, s.story_id, s.repo, s.branch, s.prompt_hash ?? null, s.status,
      s.pr_url ?? null, s.pr_number ?? null, s.activities_json ?? null,
      s.started_at ?? null, s.completed_at ?? null, s.error_message ?? null
    )
  }

  getJulesSessionsByStory(story_id: string): JulesSession[] {
    return this.db.prepare(
      'SELECT * FROM jules_sessions WHERE story_id = ? ORDER BY started_at DESC'
    ).all(story_id) as JulesSession[]
  }

  listJulesSessions(status?: string): JulesSession[] {
    if (status) {
      return this.db.prepare(
        'SELECT * FROM jules_sessions WHERE status = ? ORDER BY started_at DESC LIMIT 50'
      ).all(status) as JulesSession[]
    }
    return this.db.prepare(
      'SELECT * FROM jules_sessions ORDER BY started_at DESC LIMIT 50'
    ).all() as JulesSession[]
  }

  private migrateStories(): void {
    const newCols: string[] = [
      'ALTER TABLE stories ADD COLUMN slug TEXT',
      'ALTER TABLE stories ADD COLUMN assigned_to TEXT',
      'ALTER TABLE stories ADD COLUMN blocked_by TEXT DEFAULT \'[]\'',
      'ALTER TABLE stories ADD COLUMN blocks TEXT DEFAULT \'[]\'',
      'ALTER TABLE stories ADD COLUMN workflow_id TEXT',
      'ALTER TABLE stories ADD COLUMN body_md TEXT NOT NULL DEFAULT \'\'',
      'ALTER TABLE stories ADD COLUMN file_path TEXT NOT NULL DEFAULT \'\'',
      'ALTER TABLE stories ADD COLUMN date TEXT',
      'ALTER TABLE stories ADD COLUMN flagged INTEGER DEFAULT 0',
      'ALTER TABLE stories ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
    ]
    for (const sql of newCols) {
      try { this.db.exec(sql) } catch { /* column already exists — ignore */ }
    }
  }

  // ── Intents ──────────────────────────────────────────────────────────────

  logIntent(content: string, status: string = 'pending', agent_id: string = 'default'): number {
    const stmt = this.db.prepare('INSERT INTO intents (content, status, agent_id) VALUES (?, ?, ?)');
    const info = stmt.run(content, status, agent_id);
    return info.lastInsertRowid as number;
  }

  getRecentIntents(limit: number = 10): Intent[] {
    const stmt = this.db.prepare('SELECT * FROM intents ORDER BY created_at DESC LIMIT ?');
    return stmt.all(limit) as Intent[];
  }

  // ── Events ───────────────────────────────────────────────────────────────

  logEvent(type: string, content: string, metadata: any = {}, agent_id: string = 'default'): number {
    const stmt = this.db.prepare('INSERT INTO events (type, content, metadata, agent_id) VALUES (?, ?, ?, ?)');
    const info = stmt.run(type, content, JSON.stringify(metadata), agent_id);
    return info.lastInsertRowid as number;
  }

  getRecentEvents(limit: number = 50): EventLog[] {
    const stmt = this.db.prepare('SELECT * FROM events ORDER BY created_at DESC LIMIT ?');
    const rows = stmt.all(limit) as any[];
    return rows.map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : {}
    }));
  }

  // ── Memory ───────────────────────────────────────────────────────────────

  addMemory(content: string, tags: string[] = [], agent_id: string = 'default'): number {
    const stmt = this.db.prepare('INSERT INTO memory (content, tags, agent_id) VALUES (?, ?, ?)');
    const info = stmt.run(content, JSON.stringify(tags), agent_id);
    return info.lastInsertRowid as number;
  }

  searchMemory(query: string): MemoryFragment[] {
    const stmt = this.db.prepare('SELECT * FROM memory WHERE content LIKE ? ORDER BY created_at DESC LIMIT 10');
    const rows = stmt.all(`%${query}%`) as any[];
    return rows.map(row => ({
      ...row,
      tags: row.tags ? JSON.parse(row.tags) : []
    }));
  }

  // ── Assets ───────────────────────────────────────────────────────────────

  registerAsset(assetPath: string, type: string, content_hash?: string) {
    const stmt = this.db.prepare(`
      INSERT INTO shared_assets (path, type, content_hash, last_updated)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(path) DO UPDATE SET
        content_hash = excluded.content_hash,
        last_updated = CURRENT_TIMESTAMP
    `);
    stmt.run(assetPath, type, content_hash);
  }

  findAsset(assetPath: string): SharedAsset | undefined {
    const stmt = this.db.prepare('SELECT * FROM shared_assets WHERE path = ?');
    return stmt.get(assetPath) as SharedAsset | undefined;
  }

  // ── Stories (Story 160) ─────────────────────────────────────────────────

  upsertStory(s: Omit<StoryRecord, 'updated_at' | 'last_synced_at'>): void {
    this.db.prepare(`
      INSERT INTO stories
        (id, slug, title, status, priority, type, epic, assigned_to,
         blocked_by, blocks, workflow_id, body_md, file_path, date, flagged,
         updated_at, last_synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        slug           = excluded.slug,
        title          = excluded.title,
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
      s.id, s.slug ?? null, s.title, s.status,
      s.priority ?? null, s.type ?? null, s.epic ?? null, s.assigned_to ?? null,
      JSON.stringify(s.blocked_by ?? []), JSON.stringify(s.blocks ?? []),
      s.workflow_id ?? null,
      s.body_md, s.file_path, s.date ?? null,
      s.flagged ? 1 : 0
    )
  }

  listStoriesFromDb(): StoryRecord[] {
    const rows = this.db.prepare(
      'SELECT * FROM stories ORDER BY id DESC'
    ).all() as any[]
    return rows.map(r => this._deserializeStory(r))
  }

  getStoryById(id: string): StoryRecord | null {
    const row = this.db.prepare('SELECT * FROM stories WHERE id = ?').get(id) as any
    return row ? this._deserializeStory(row) : null
  }

  updateStoryFields(id: string, fields: Partial<Pick<StoryRecord,
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
    this.db.prepare(`UPDATE stories SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
  }

  deleteStory(id: string): void {
    this.db.prepare('DELETE FROM stories WHERE id = ?').run(id)
  }

  vacuum(): void {
    this.db.exec('VACUUM')
  }

  private _deserializeStory(row: any): StoryRecord {
    return {
      ...row,
      blocked_by: row.blocked_by ? JSON.parse(row.blocked_by) : [],
      blocks:     row.blocks     ? JSON.parse(row.blocks)     : [],
      flagged:    row.flagged === 1,
    }
  }

  saveSnapshot(payload: any): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO context_snapshots (id, panel_id, model_id, provider, messages, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      payload.id || crypto.randomUUID(),
      payload.panel_id,
      payload.model_id,
      payload.provider,
      typeof payload.messages === 'string' ? payload.messages : JSON.stringify(payload.messages),
      Date.now()
    );
  }

  getLatestSnapshot(panelId: string): any | null {
    const row = this.db.prepare(`
      SELECT * FROM context_snapshots WHERE panel_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(panelId) as any;
    if (!row) return null;
    try {
      return { ...row, messages: JSON.parse(row.messages) };
    } catch {
      return row;
    }
  }

  addProjectMemory(payload: { content: string, importance?: number, source: string }): void {
    this.db.prepare(`
      INSERT INTO project_memory (id, content, importance, source, created_at, last_accessed)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      payload.content,
      payload.importance ?? 3,
      payload.source,
      Date.now(),
      Date.now()
    );
  }

  searchProjectMemory(limit: number = 5): any[] {
    return this.db.prepare(`
      SELECT * FROM project_memory ORDER BY (importance * 1.0 / (1.0 + (strftime('%s', 'now') * 1000 - created_at) / 86400000.0)) DESC LIMIT ?
    `).all(limit) as any[];
  }

  close() {
    this.db.close();
  }
}

// Module-level singleton for use across main-process modules
export const stateLedger = new StateLedger()
