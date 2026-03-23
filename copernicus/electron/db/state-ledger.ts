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

export interface KanbanColumnRecord {
  id: string;
  status: string;
  color: string;
  accent: string;
  minimized: number;
  sort_order: number;
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
  persona_role?: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  latency_ms?: number;
  reasoning?: string;
  workflow_run_id?: string;
  parent_call_id?: number;
  created_at?: string;
  prompt_text?: string | null;
  response_text?: string | null;
  context_json?: string | null;
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
  last_search_context?: string
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
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.init();
  }

  private init() {
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

    // Review Sessions (Story 333)
    this.db.exec(SCHEMA.review_sessions);

    // Test Runs (Story 162)
    this.db.exec(SCHEMA.test_runs);

    // Model Call Ledger (Story 156)
    this.db.exec(SCHEMA.model_calls);
    try {
      this.db.exec("ALTER TABLE model_calls ADD COLUMN persona_role TEXT DEFAULT 'unknown'");
    } catch (e) { /* Column already exists */ }

    // Replay Debugging Migrations (Story 385)
    try { this.db.exec(`ALTER TABLE model_calls ADD COLUMN prompt_text TEXT`) } catch (e) {}
    try { this.db.exec(`ALTER TABLE model_calls ADD COLUMN response_text TEXT`) } catch (e) {}
    try { this.db.exec(`ALTER TABLE model_calls ADD COLUMN context_json TEXT`) } catch (e) {}

    // Projects & Epics (Story 211)
    this.db.exec(SCHEMA.projects);
    this.db.exec(SCHEMA.epics);

    // Dev Sessions (from DevtimeManager integration)
    this.db.exec(SCHEMA.dev_sessions);

    // File Transactions (Story 220)
    this.db.exec(SCHEMA.file_transactions);
    this.db.exec(SCHEMA.file_transaction_entries);

    // Agent Queue (Story 340)
    this.db.exec(SCHEMA.dispatch_queue);

    // Template Overrides (Story 330)
    this.db.exec(SCHEMA.template_overrides);

    // Workflow Snapshots (Story 345)
    this.db.exec(SCHEMA.workflow_snapshots);
    this.db.exec(SCHEMA.workflow_snapshots_idx)

    // Agent Worktrees
    this.db.exec(SCHEMA.agent_worktrees)

    // Kanban Columns (Story 428)
    this.db.exec(SCHEMA.kanban_columns);
    this.initKanbanColumns();

    // Agent Memory (Story 489)
    this.db.exec(SCHEMA.agent_memory);
    this.db.exec(SCHEMA.agent_work_log);
    this.db.exec(SCHEMA.memory_working_set);
    this.migrateAgentMemory();
  }

  // ── Agent Memory (Story 489) ──────────────────────────────────────────

  private migrateAgentMemory(): void {
    const hasRows = this.db.prepare('SELECT COUNT(*) as count FROM agent_memory WHERE bank_id = ? AND event_type = ?').get('chat', 'memory_fact') as { count: number };
    
    if (hasRows && hasRows.count === 0) {
      this.db.transaction(() => {
        const rows = this.db.prepare('SELECT * FROM project_memory').all() as any[];
        const insertStmt = this.db.prepare(`
          INSERT INTO agent_memory (id, project_id, bank_id, event_type, content, importance, ts)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const row of rows) {
          const newId = crypto.randomUUID();
          insertStmt.run(
            newId,
            'default', // project_id
            'chat',    // bank_id
            'memory_fact', // event_type
            row.content,
            row.importance,
            Math.floor(row.created_at / 1000) // Convert from ms to seconds
          );
        }
      })();
    }
  }

  addAgentMemory(params: { id: string, projectId: string, bankId: string, eventType: string, content: string, importance: number, tags: string | null, entities: string | null, meta: string | null, ts: number }): void {
    this.db.prepare(`
      INSERT INTO agent_memory (id, project_id, bank_id, event_type, content, importance, tags, entities, meta, ts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.id,
      params.projectId,
      params.bankId,
      params.eventType,
      params.content,
      params.importance,
      params.tags,
      params.entities,
      params.meta,
      params.ts
    );
  }

  getMemoryWorkingSet(projectId: string, bankId: string, limit: number): any[] {
    return this.db.prepare(`
      SELECT * FROM memory_working_set
      WHERE project_id = ? AND bank_id = ?
      ORDER BY score DESC
      LIMIT ?
    `).all(projectId, bankId, limit) as any[];
  }

  recallAgentMemory(projectId: string, bankId: string, query: string, limit: number): any[] {
    return this.db.prepare(`
      SELECT * FROM memory_working_set
      WHERE project_id = ? AND bank_id = ? AND content LIKE ?
      ORDER BY score DESC
      LIMIT ?
    `).all(projectId, bankId, `%${query}%`, limit) as any[];
  }

  supersedeMemory(oldId: string, newId: string): void {
    this.db.transaction(() => {
      this.db.prepare(`
        UPDATE agent_memory SET importance = 1 WHERE id = ?
      `).run(oldId);
      
      this.db.prepare(`
        UPDATE agent_memory SET supersedes_id = ? WHERE id = ?
      `).run(newId, oldId);
    })();
  }

  logAgentWork(params: { id: string, projectId: string, bankId: string, eventType: string, meta: string, ts: number }): void {
    this.db.prepare(`
      INSERT INTO agent_work_log (id, project_id, bank_id, event_type, meta, ts)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(params.id, params.projectId, params.bankId, params.eventType, params.meta, params.ts);
  }

  getAgentWorkLog(projectId: string, bankId: string, limit: number): any[] {
    return this.db.prepare(`
      SELECT * FROM agent_work_log
      WHERE project_id = ? AND bank_id = ?
      ORDER BY ts DESC
      LIMIT ?
    `).all(projectId, bankId, limit) as any[];
  }

  // ── Kanban Columns (Story 428) ──────────────────────────────────────────

  private initKanbanColumns(): void {
    const existing = this.db.prepare('SELECT COUNT(*) as count FROM kanban_columns').get() as any;
    if (existing && existing.count === 0) {
      const DEFAULT_COLUMNS = [
        { id: 'planning',        status: 'PLANNING',       color: 'bg-slate-500/10 border-slate-500/30',   accent: 'bg-slate-500' },
        { id: 'storyboarding',   status: 'STORYBOARDING',  color: 'bg-purple-500/10 border-purple-500/30', accent: 'bg-purple-500' },
        { id: 'sprint-planning', status: 'SPRINT_PLANNING', color: 'bg-indigo-500/10 border-indigo-500/30', accent: 'bg-indigo-500' },
        { id: 'development',     status: 'IN_PROGRESS',    color: 'bg-yellow-500/10 border-yellow-500/30', accent: 'bg-yellow-500' },
        { id: 'testing',         status: 'TESTING',        color: 'bg-orange-500/10 border-orange-500/30', accent: 'bg-orange-500' },
        { id: 'qa',              status: 'QA',             color: 'bg-amber-500/10 border-amber-500/30',   accent: 'bg-amber-500' },
        { id: 'documenting',     status: 'DOCUMENTING',    color: 'bg-cyan-500/10 border-cyan-500/30',     accent: 'bg-cyan-500' },
        { id: 'ready-to-build',  status: 'READY',          color: 'bg-teal-500/10 border-teal-500/30',     accent: 'bg-teal-500' },
        { id: 'done',            status: 'COMPLETE',       color: 'bg-green-500/10 border-green-500/30',   accent: 'bg-green-500' },
      ];

      const insert = this.db.prepare(`
        INSERT INTO kanban_columns (id, status, color, accent, minimized, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      this.db.transaction(() => {
        DEFAULT_COLUMNS.forEach((col, index) => {
          insert.run(col.id, col.status, col.color, col.accent, 0, index);
        });
      })();
    }
  }

  getKanbanColumns(): KanbanColumnRecord[] {
    return this.db.prepare('SELECT * FROM kanban_columns ORDER BY sort_order ASC').all() as KanbanColumnRecord[];
  }

  setKanbanColumn(id: string, updates: Partial<KanbanColumnRecord>): void {
    const existing = this.db.prepare('SELECT * FROM kanban_columns WHERE id = ?').get(id) as KanbanColumnRecord;
    if (!existing) {
      throw new Error('column not found');
    }

    const sets: string[] = [];
    const vals: unknown[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (['status', 'color', 'accent', 'minimized', 'sort_order'].includes(key)) {
        sets.push(`${key} = ?`);
        vals.push(value);
      }
    }

    if (sets.length > 0) {
      vals.push(id);
      this.db.prepare(`UPDATE kanban_columns SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    }
  }

  // ── Template Overrides (Story 330) ────────────────────────────────────────

  getTemplateOverride(id: string): { content: string } | null {
    const row = this.db.prepare('SELECT content FROM template_overrides WHERE template_id = ?').get(id) as any
    return row ? { content: row.content } : null
  }

  saveTemplateOverride(id: string, content: string): void {
    this.db.prepare(`
      INSERT INTO template_overrides (template_id, content, updated_at)
      VALUES (?, ?, (datetime('now')))
      ON CONFLICT(template_id) DO UPDATE SET
        content = excluded.content,
        updated_at = excluded.updated_at
    `).run(id, content)
  }

  deleteTemplateOverride(id: string): void {
    this.db.prepare('DELETE FROM template_overrides WHERE template_id = ?').run(id)
  }

  // ── File Transactions (Story 220) ──────────────────────────────────────────

  logTransaction(tx: { id: string, status: string, description?: string, files: { path: string, beforeHash?: string, afterHash?: string, originalDataPath?: string }[] }): void {
    this.db.prepare(`
      INSERT INTO file_transactions (id, status, description)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        updated_at = CURRENT_TIMESTAMP
    `).run(tx.id, tx.status, tx.description ?? null)

    // Clear existing entries if we're updating
    this.db.prepare('DELETE FROM file_transaction_entries WHERE transaction_id = ?').run(tx.id)

    for (const f of tx.files) {
      this.db.prepare(`
        INSERT INTO file_transaction_entries (transaction_id, file_path, before_hash, after_hash, original_data_path)
        VALUES (?, ?, ?, ?, ?)
      `).run(tx.id, f.path, f.beforeHash, f.afterHash, f.originalDataPath ?? null)
    }
  }

  getLastTransaction(): { id: string, files: { path: string, beforeHash?: string, afterHash?: string, originalDataPath?: string }[] } | null {
    const row = this.db.prepare(`
      SELECT * FROM file_transactions 
      WHERE status = 'COMMITTED' 
      ORDER BY created_at DESC LIMIT 1
    `).get() as any
    if (!row) return null

    const entries = this.db.prepare(`
      SELECT * FROM file_transaction_entries WHERE transaction_id = ?
    `).all(row.id) as any[]

    return {
      id: row.id,
      files: entries.map(e => ({
        path: e.file_path,
        beforeHash: e.before_hash,
        afterHash: e.after_hash,
        originalDataPath: e.original_data_path
      }))
    }
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
        (session_id, panel_id, model_id, provider, persona_role, tokens_in, tokens_out,
         cost_usd, latency_ms, reasoning, workflow_run_id, parent_call_id,
         prompt_text, response_text, context_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.session_id, record.panel_id, record.model_id, record.provider,
      record.persona_role ?? 'unknown',
      record.tokens_in, record.tokens_out, record.cost_usd,
      record.latency_ms ?? null, record.reasoning ?? null,
      record.workflow_run_id ?? null,
      record.parent_call_id ?? null,
      record.prompt_text ?? null,
      record.response_text ?? null,
      record.context_json ?? null
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

  getSessionStatsByRole(sessionId: string): { role: string, tokens: number, cost: number }[] {
    return this.db.prepare(`
      SELECT COALESCE(persona_role, 'unknown') as role,
             SUM(tokens_in + tokens_out) as tokens, SUM(cost_usd) as cost
      FROM model_calls WHERE session_id = ?
      GROUP BY role ORDER BY cost DESC
    `).all(sessionId) as any[]
  }

  getAllTimeStatsByRole(): { role: string, tokens: number, cost: number }[] {
    return this.db.prepare(`
      SELECT COALESCE(persona_role, 'unknown') as role,
             SUM(tokens_in + tokens_out) as tokens, SUM(cost_usd) as cost
      FROM model_calls GROUP BY role ORDER BY cost DESC
    `).all() as any[]
  }

  queryModelCallsSprint(since: number): object[] {
    return this.db.prepare(`
      SELECT model_id, provider,
             COUNT(*) as calls,
             SUM(tokens_in) as tokens_in,
             SUM(tokens_out) as tokens_out,
             SUM(cost_usd) as cost_usd,
             AVG(latency_ms) as avg_latency_ms
      FROM model_calls
      WHERE created_at > datetime(? / 1000, 'unixepoch')
      GROUP BY model_id, provider
      ORDER BY calls DESC
    `).all(since) as object[];
  }

  queryModelPerformanceSprint(since: number): object[] {
    return this.db.prepare(`
      SELECT model_id, provider, task_type,
             COUNT(*) as observations,
             AVG(speed_score) as avg_speed,
             AVG(cost_score) as avg_cost,
             AVG(accuracy_score) as avg_accuracy,
             AVG(adherence_score) as avg_adherence,
             AVG(composite_qs) as avg_composite_qs,
             MIN(adherence_score) as min_adherence
      FROM model_performance
      WHERE timestamp > datetime(? / 1000, 'unixepoch')
      GROUP BY model_id, provider, task_type
      ORDER BY avg_composite_qs DESC
    `).all(since) as object[];
  }

  // ── Jules Sessions (Story 161) ──────────────────────────────────────────

  upsertJulesSession(s: JulesSession): void {
    this.db.prepare(`
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
      'ALTER TABLE stories RENAME COLUMN epic_id TO epic',
      'ALTER TABLE stories ADD COLUMN epic TEXT',
    ]
    for (const sql of newCols) {
      try { this.db.exec(sql) } catch { /* column already exists — ignore */ }
    }

    // Drop the FK constraint on epic (was epic_id FK to epics table — epic is free-text).
    // SQLite can't DROP CONSTRAINT, so rebuild the table if the FK still exists.
    // PRAGMA must be set outside the transaction (SQLite limitation).
    try {
      const hasFk = (this.db.pragma('foreign_key_list(stories)') as any[]).some(
        (r: any) => r.table === 'epics'
      )
      if (hasFk) {
        this.db.pragma('foreign_keys = OFF')
        this.db.transaction(() => {
          this.db.exec(`
            CREATE TABLE stories_rebuilt (
              id             TEXT PRIMARY KEY,
              slug           TEXT UNIQUE,
              title          TEXT NOT NULL,
              status         TEXT NOT NULL DEFAULT 'DRAFT',
              priority       TEXT,
              type           TEXT,
              epic           TEXT,
              assigned_to    TEXT,
              blocked_by     TEXT DEFAULT '[]',
              blocks         TEXT DEFAULT '[]',
              workflow_id    TEXT,
              body_md        TEXT NOT NULL DEFAULT '',
              file_path      TEXT NOT NULL DEFAULT '',
              date           TEXT,
              flagged        INTEGER DEFAULT 0,
              updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
              last_synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO stories_rebuilt SELECT
              id, slug, title, status, priority, type, epic, assigned_to,
              blocked_by, blocks, workflow_id, body_md, file_path, date,
              flagged, updated_at, last_synced_at
            FROM stories;
            DROP TABLE stories;
            ALTER TABLE stories_rebuilt RENAME TO stories;
            CREATE INDEX IF NOT EXISTS idx_stories_status ON stories(status);
            CREATE INDEX IF NOT EXISTS idx_stories_priority ON stories(priority, status);
          `)
        })()
        this.db.pragma('foreign_keys = ON')
      }
    } catch { /* table already clean — ignore */ }
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
    const fingerprint = payload.content.trim().slice(0, 120)
    const existing = this.db.prepare(
      "SELECT id FROM project_memory WHERE substr(content, 1, 120) = ?"
    ).get(fingerprint)
    if (existing) return
    this.db.prepare(`
      INSERT INTO project_memory (id, content, importance, source, created_at, last_accessed)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), payload.content, payload.importance ?? 3, payload.source, Date.now(), Date.now())
  }

  searchProjectMemory(limit: number = 5): any[] {
    return this.db.prepare(`
      SELECT * FROM project_memory ORDER BY (importance * 1.0 / (1.0 + (strftime('%s', 'now') * 1000 - created_at) / 86400000.0)) DESC LIMIT ?
    `).all(limit) as any[];
  }

  close() {
    this.db.close();
  }

  listRetroReports(projectId: string): any[] {
    return this.db.prepare(`
      SELECT * FROM retro_reports
      WHERE project_id = ?
      ORDER BY ts_generated DESC
    `).all(projectId) as any[];
  }

  getRetroReport(id: string): any {
    const report = this.db.prepare('SELECT * FROM retro_reports WHERE id = ?').get(id) as any;
    if (!report) return null;

    const items = this.db.prepare('SELECT * FROM retro_items WHERE retro_id = ?').all(id);
    return { ...report, items };
  }

  createRetroReport(data: {
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
    
    this.db.transaction(() => {
      this.db.prepare(`
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
        const insertItem = this.db.prepare(`
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

  updateRetroItem(id: string, data: { status: string; edited_content?: string }): boolean {
    this.db.prepare(`
      UPDATE retro_items
      SET status = ?, edited_content = COALESCE(?, edited_content)
      WHERE id = ?
    `).run(data.status, data.edited_content || null, id);
    return true;
  }

  pushRetroReady(id: string): boolean {
    this.db.prepare(`
      UPDATE retro_reports
      SET status = 'pending_review'
      WHERE id = ?
    `).run(id);
    return true;
  }
}

// Module-level singleton for use across main-process modules
export const stateLedger = new StateLedger()
