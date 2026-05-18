import log from '../utils/logger'
import * as crypto from 'crypto';
import type { Database } from 'libsql';
import DatabaseConstructor from 'libsql';
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
  promptId?: string | null;
  commitSha?: string | null;
}

export interface MemoryFragment {
  id?: number;
  content: string;
  tags?: string[];
  agent_id?: string;
  bank_id?: string;
  event_type?: string;
  importance?: number;
  created_at?: number;
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
  project_id: string
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
  target_device?: string;   // 'MOBILE' | 'DESKTOP' | 'TABLET' | 'AGNOSTIC'
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

export interface WorkflowWave {
  id: string;
  workflowId: string;
  waveIndex: number;
  storyIds: string[];
  status: string;
  startedAt: number;
  completedAt: number | null;
}

export class StateLedger {
  public db: Database;

  constructor(dbPath?: string) {
    const finalPath = dbPath ?? path.join(app.getPath('userData'), 'copernicus.db');

    const dir = path.dirname(finalPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new DatabaseConstructor(finalPath);
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.init();
  }

  // Typed query helpers — eliminates `as any` at call sites
  private queryAll<T>(sql: string, ...params: unknown[]): T[] {
    return this.db.prepare(sql).all(...params) as T[]
  }

  private queryGet<T>(sql: string, ...params: unknown[]): T | undefined {
    return this.db.prepare(sql).get(...params) as T | undefined
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

    // Knowledge Base migrations (Story 566)
    this.migrateKnowledgeBase();

    // Model Calls schema migration for Story 456
    try { this.db.exec(`ALTER TABLE model_calls ADD COLUMN IF NOT EXISTS prompt_id TEXT`) } catch (e) {}
    try { this.db.exec(`ALTER TABLE model_calls ADD COLUMN IF NOT EXISTS commit_sha TEXT`) } catch (e) {}

    // Projects & Epics (Story 211)
    this.db.exec(SCHEMA.projects);
    try { this.db.exec("ALTER TABLE projects ADD COLUMN target_device TEXT NOT NULL DEFAULT 'AGNOSTIC'") } catch (e) { /* column already exists */ }
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
    try { this.db.exec("ALTER TABLE agent_memory ADD COLUMN story_id TEXT") } catch (e) { /* column already exists */ }
    this.db.exec(SCHEMA.agent_work_log);
    try { this.db.exec("ALTER TABLE agent_work_log ADD COLUMN story_id TEXT") } catch (e) { /* column already exists */ }
    this.db.exec(SCHEMA.memory_working_set);

    // NotebookLM
    this.db.exec(SCHEMA.nlm_notebooks);

    // Intelligence Documents (Story 566 / 694)
    this.db.exec(SCHEMA.intelligence_documents);

    this.migrateAgentMemory();
  }

  // ── Agent Memory (Story 489) ──────────────────────────────────────────

  private migrateAgentMemory(): void {
    const hasRows = this.queryGet<{ count: number }>('SELECT COUNT(*) as count FROM agent_memory WHERE bank_id = ? AND event_type = ?', 'chat', 'memory_fact');

    if (hasRows && hasRows.count === 0) {
      this.db.transaction(() => {
        const rows = this.queryAll<MemoryFragment>('SELECT * FROM project_memory');
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
            Math.floor((row.created_at ?? Date.now()) / 1000) // Convert from ms to seconds
          );
        }
      })();
    }
  }

  insertWorkflowWave(id: string, workflowId: string, waveIndex: number, storyIds: string[], startedAt: number): void {
    this.db.prepare(`
      INSERT INTO workflow_waves (id, workflow_id, wave_index, story_ids, status, started_at)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `).run(id, workflowId, waveIndex, JSON.stringify(storyIds), startedAt);
  }

  updateWorkflowWaveStatus(id: string, status: string, completedAt?: number): void {
    if (completedAt) {
      this.db.prepare(`
        UPDATE workflow_waves SET status = ?, completed_at = ? WHERE id = ?
      `).run(status, completedAt, id);
    } else {
      this.db.prepare(`
        UPDATE workflow_waves SET status = ? WHERE id = ?
      `).run(status, id);
    }
  }

  getWorkflowWaves(workflowId: string): WorkflowWave[] {
    const rows = this.queryAll<{
      id: string;
      workflowId: string;
      waveIndex: number;
      storyIds: string;
      status: string;
      startedAt: number;
      completedAt: number | null;
    }>(`
      SELECT id, workflow_id as workflowId, wave_index as waveIndex, story_ids as storyIds, status, started_at as startedAt, completed_at as completedAt
      FROM workflow_waves
      WHERE workflow_id = ?
      ORDER BY wave_index ASC
    `, workflowId);

    return rows.map(r => ({
      ...r,
      storyIds: JSON.parse(r.storyIds || '[]')
    }));
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

  getAllAgentMemoryForProject(projectId: string): MemoryFragment[] {
    return this.queryAll<MemoryFragment>('SELECT * FROM agent_memory WHERE project_id = ?', projectId);
  }

  getMemoryWorkingSet(projectId: string, bankId: string, limit: number): any[] {
    return this.queryAll<any>(`
      SELECT * FROM memory_working_set
      WHERE project_id = ? AND bank_id = ?
      ORDER BY score DESC
      LIMIT ?
    `, projectId, bankId, limit);
  }

  getMemoryWorkingSetForProject(projectId: string, limit: number, bankId?: string): any[] {
    if (bankId) {
      return this.queryAll<any>(`
        SELECT * FROM memory_working_set
        WHERE project_id = ? AND bank_id = ?
        ORDER BY score DESC
        LIMIT ?
      `, projectId, bankId, limit);
    } else {
      return this.queryAll<any>(`
        SELECT * FROM memory_working_set
        WHERE project_id = ?
        ORDER BY score DESC
        LIMIT ?
      `, projectId, limit);
    }
  }

  getAgentMemoryTimeRange(projectId: string, fromTs: number, toTs: number, limit: number): MemoryFragment[] {
    return this.queryAll<MemoryFragment>(`
      SELECT * FROM agent_memory
      WHERE project_id = ? AND ts BETWEEN ? AND ?
      ORDER BY ts ASC LIMIT ?
    `, projectId, fromTs, toTs, limit);
  }

  getAgentWorkLogTimeRange(projectId: string, fromTs: number, toTs: number, limit: number): any[] {
    return this.queryAll<any>(`
      SELECT * FROM agent_work_log
      WHERE project_id = ? AND ts BETWEEN ? AND ?
      ORDER BY ts ASC LIMIT ?
    `, projectId, fromTs, toTs, limit);
  }

  recallAgentMemory(projectId: string, bankId: string, query: string, limit: number): MemoryFragment[] {
    return this.queryAll<MemoryFragment>(`
      SELECT * FROM memory_working_set
      WHERE project_id = ? AND bank_id = ? AND content LIKE ?
      ORDER BY score DESC
      LIMIT ?
    `, projectId, bankId, `%${query}%`, limit);
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

  demoteMemoryImportance(id: string): void {
    this.db.prepare(`
      UPDATE agent_memory SET importance = 1 WHERE id = ?
    `).run(id);
  }

  logAgentWork(params: { id: string, projectId: string, bankId: string, eventType: string, meta: string, ts: number }): void {
    this.db.prepare(`
      INSERT INTO agent_work_log (id, project_id, bank_id, event_type, meta, ts)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(params.id, params.projectId, params.bankId, params.eventType, params.meta, params.ts);
  }

  getAgentWorkLog(projectId: string, bankId: string, limit: number): any[] {
    return this.queryAll<any>(`
      SELECT * FROM agent_work_log
      WHERE project_id = ? AND bank_id = ?
      ORDER BY ts DESC
      LIMIT ?
    `, projectId, bankId, limit);
  }

  // ── Kanban Columns (Story 428) ──────────────────────────────────────────

  private initKanbanColumns(): void {
    const existing = this.queryGet<{ count: number }>('SELECT COUNT(*) as count FROM kanban_columns');
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
    return this.queryAll<KanbanColumnRecord>('SELECT * FROM kanban_columns ORDER BY sort_order ASC');
  }

  setKanbanColumn(id: string, updates: Partial<KanbanColumnRecord>): void {
    const existing = this.queryGet<KanbanColumnRecord>('SELECT * FROM kanban_columns WHERE id = ?', id);
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
    const row = this.queryGet<{ content: string }>('SELECT content FROM template_overrides WHERE template_id = ?', id);
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
    const row = this.queryGet<{ id: string; created_at: string; status: string; description: string | null }>(`
      SELECT * FROM file_transactions
      WHERE status = 'COMMITTED'
      ORDER BY created_at DESC LIMIT 1
    `);
    if (!row) return null

    const entries = this.queryAll<{ file_path: string; before_hash: string | null; after_hash: string | null; original_data_path: string | null }>(`
      SELECT * FROM file_transaction_entries WHERE transaction_id = ?
    `, row.id);

    return {
      id: row.id,
      files: entries.map(e => ({
        path: e.file_path,
        beforeHash: e.before_hash ?? undefined,
        afterHash: e.after_hash ?? undefined,
        originalDataPath: e.original_data_path ?? undefined
      }))
    }
  }

  // ── Projects & Epics (Story 211) ──────────────────────────────────────────

  upsertProject(p: ProjectRecord): void {
    this.db.prepare(`
      INSERT INTO projects (id, path, billing_mode, billing_details, target_device, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(path) DO UPDATE SET
        id = excluded.id,
        billing_mode = excluded.billing_mode,
        billing_details = excluded.billing_details,
        target_device = excluded.target_device,
        updated_at = CURRENT_TIMESTAMP
    `).run(p.id, p.path, p.billing_mode, p.billing_details ?? null, p.target_device ?? 'AGNOSTIC')
  }

  updateProjectTargetDevice(path: string, targetDevice: string): void {
    this.db.prepare(`
      UPDATE projects
      SET target_device = ?, updated_at = CURRENT_TIMESTAMP
      WHERE path = ?
    `).run(targetDevice, path)
  }

  getProjectByPath(path: string): ProjectRecord | null {
    const row = this.queryGet<ProjectRecord>('SELECT * FROM projects WHERE path = ?', path);
    return row ?? null
  }

  getActiveProject(): ProjectRecord | null {
    const { settingsStore } = require('../main');
    const path = settingsStore.get('workspace') as string;
    return path ? this.getProjectByPath(path) : null;
  }

  getProjectById(id: string): ProjectRecord | null {
    const row = this.queryGet<ProjectRecord>('SELECT * FROM projects WHERE id = ?', id);
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
    return this.queryAll<TestRunRecord>(
      'SELECT * FROM test_runs ORDER BY run_at DESC LIMIT ?', limit
    )
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
    const total = this.queryGet<{
      total_calls: number;
      total_tokens_in: number;
      total_tokens_out: number;
      total_cost_usd: number;
    }>(`
      SELECT COUNT(*) as total_calls,
             SUM(tokens_in) as total_tokens_in,
             SUM(tokens_out) as total_tokens_out,
             SUM(cost_usd) as total_cost_usd
      FROM model_calls WHERE session_id = ?
    `, session_id) ?? { total_calls: 0, total_tokens_in: 0, total_tokens_out: 0, total_cost_usd: 0 };

    const byModel = this.queryAll<{ model_id: string; provider: string; calls: number; tokens_in: number; tokens_out: number; cost_usd: number }>(`
      SELECT model_id, provider,
             COUNT(*) as calls,
             SUM(tokens_in) as tokens_in,
             SUM(tokens_out) as tokens_out,
             SUM(cost_usd) as cost_usd
      FROM model_calls WHERE session_id = ?
      GROUP BY model_id, provider ORDER BY calls DESC
    `, session_id);

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
      return this.queryAll<ModelCallRecord>(
        'SELECT * FROM model_calls WHERE panel_id = ? ORDER BY created_at DESC LIMIT ?', panel_id, limit
      )
    }
    return this.queryAll<ModelCallRecord>(
      'SELECT * FROM model_calls ORDER BY created_at DESC LIMIT ?', limit
    )
  }

  getEditDecisionsCounts(promptId: string): { accept: number, reject: number, abort: number } {
    try {
      const rows = this.queryAll<{ decision: string, count: number }>('SELECT decision, COUNT(*) as count FROM edit_decisions WHERE prompt_id = ? GROUP BY decision', promptId);
      const result = { accept: 0, reject: 0, abort: 0 };
      for (const row of rows) {
        if (row.decision === 'accept') result.accept = row.count;
        if (row.decision === 'reject') result.reject = row.count;
        if (row.decision === 'abort') result.abort = row.count;
      }
      return result;
    } catch (e) {
      log.error('Failed to get edit decisions counts', e);
      return { accept: 0, reject: 0, abort: 0 };
    }
  }

  getAllTimeCost(): number {
    const row = this.queryGet<{ total: number }>('SELECT SUM(cost_usd) as total FROM model_calls');
    return row?.total ?? 0
  }

  getSessionStatsByRole(sessionId: string): { role: string, tokens: number, cost: number }[] {
    return this.queryAll<{ role: string, tokens: number, cost: number }>(`
      SELECT COALESCE(persona_role, 'unknown') as role,
             SUM(tokens_in + tokens_out) as tokens, SUM(cost_usd) as cost
      FROM model_calls WHERE session_id = ?
      GROUP BY role ORDER BY cost DESC
    `, sessionId);
  }

  getAllTimeStatsByRole(): { role: string, tokens: number, cost: number }[] {
    return this.queryAll<{ role: string, tokens: number, cost: number }>(`
      SELECT COALESCE(persona_role, 'unknown') as role,
             SUM(tokens_in + tokens_out) as tokens, SUM(cost_usd) as cost
      FROM model_calls GROUP BY role ORDER BY cost DESC
    `);
  }

  queryModelCallsSprint(since: number): object[] {
    return this.queryAll<object>(`
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
    `, since);
  }

  queryModelPerformanceSprint(since: number): object[] {
    return this.queryAll<object>(`
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
    `, since);
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
    return this.queryAll<JulesSession>(
      'SELECT * FROM jules_sessions WHERE story_id = ? ORDER BY started_at DESC', story_id
    )
  }

  listJulesSessions(status?: string): JulesSession[] {
    if (status) {
      return this.queryAll<JulesSession>(
        'SELECT * FROM jules_sessions WHERE status = ? ORDER BY started_at DESC LIMIT 50', status
      )
    }
    return this.queryAll<JulesSession>(
      'SELECT * FROM jules_sessions ORDER BY started_at DESC LIMIT 50'
    )
  }

  private migrateStories(): void {
    const newCols: string[] = [
      'ALTER TABLE stories ADD COLUMN project_id TEXT NOT NULL DEFAULT \'\'',
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
      const fkList = this.db.pragma('foreign_key_list(stories)') as unknown[];
      const hasFk = fkList.some((r: any) => r.table === 'epics');
      if (hasFk) {
        this.db.pragma('foreign_keys = OFF')
        this.db.transaction(() => {
          this.db.exec(`
            CREATE TABLE stories_rebuilt (
              id             TEXT PRIMARY KEY,
              slug           TEXT UNIQUE,
              title          TEXT NOT NULL,
              project_id     TEXT NOT NULL DEFAULT '',
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
              id, slug, title, project_id, status, priority, type, epic, assigned_to,
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
    return this.queryAll<Intent>('SELECT * FROM intents ORDER BY created_at DESC LIMIT ?', limit);
  }

  // ── Events ───────────────────────────────────────────────────────────────

  logEvent(type: string, content: string, metadata: any = {}, agent_id: string = 'default'): number {
    const stmt = this.db.prepare('INSERT INTO events (type, content, metadata, agent_id) VALUES (?, ?, ?, ?)');
    const info = stmt.run(type, content, JSON.stringify(metadata), agent_id);
    return info.lastInsertRowid as number;
  }

  getRecentEvents(limit: number = 50): EventLog[] {
    const rows = this.queryAll<any>(`
      SELECT e.*, m.prompt_id, m.commit_sha
      FROM events e
      LEFT JOIN model_calls m ON CASE WHEN json_valid(e.content) THEN json_extract(e.content, '$.session_id') ELSE NULL END = m.session_id
      ORDER BY e.created_at DESC LIMIT ?
    `, limit);
    return rows.map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      promptId: row.prompt_id || null,
      commitSha: row.commit_sha || null
    }));
  }

  // ── Memory ───────────────────────────────────────────────────────────────

  addMemory(content: string, tags: string[] = [], agent_id: string = 'default'): number {
    const stmt = this.db.prepare('INSERT INTO memory (content, tags, agent_id) VALUES (?, ?, ?)');
    const info = stmt.run(content, JSON.stringify(tags), agent_id);
    return info.lastInsertRowid as number;
  }

  searchMemory(query: string): MemoryFragment[] {
    type DbRow = Omit<MemoryFragment, 'tags'> & { tags?: string }
    const rows = this.queryAll<DbRow>('SELECT * FROM memory WHERE content LIKE ? ORDER BY created_at DESC LIMIT 10', `%${query}%`);
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
    return this.queryGet<SharedAsset>('SELECT * FROM shared_assets WHERE path = ?', assetPath);
  }

  // ── Stories (Story 160) ─────────────────────────────────────────────────

  upsertStory(s: Omit<StoryRecord, 'updated_at' | 'last_synced_at'>): void {
    this.db.prepare(`
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
      s.id, s.slug ?? null, s.title, s.project_id, s.status,
      s.priority ?? null, s.type ?? null, s.epic ?? null, s.assigned_to ?? null,
      JSON.stringify(s.blocked_by ?? []), JSON.stringify(s.blocks ?? []),
      s.workflow_id ?? null,
      s.body_md, s.file_path, s.date ?? null,
      s.flagged ? 1 : 0
    )
  }

  listStoriesFromDb(projectId?: string): StoryRecord[] {
    let rows: any[];
    if (projectId !== undefined) {
      rows = this.queryAll<any>('SELECT * FROM stories WHERE project_id = ? ORDER BY id DESC', projectId);
    } else {
      rows = this.queryAll<any>('SELECT * FROM stories ORDER BY id DESC');
    }
    return rows.map(r => this._deserializeStory(r))
  }

  deleteOrphanedStories(projectId: string, validFilePaths: string[]): void {
    if (validFilePaths.length === 0) {
      this.db.prepare('DELETE FROM stories WHERE project_id = ?').run(projectId)
      return
    }

    // SQLite limits parameters, but usually up to 999. In this simple case we map them dynamically.
    const placeholders = validFilePaths.map(() => '?').join(',')
    const sql = `DELETE FROM stories WHERE project_id = ? AND file_path NOT IN (${placeholders})`
    this.db.prepare(sql).run(projectId, ...validFilePaths)
  }

  getStoryById(id: string): StoryRecord | null {
    const row = this.queryGet<StoryRecord>('SELECT * FROM stories WHERE id = ?', id);
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
    const row = this.queryGet<any>('SELECT * FROM context_snapshots WHERE panel_id = ? ORDER BY created_at DESC LIMIT 1', panelId);
    if (!row) return null;
    try {
      return { ...row, messages: JSON.parse(row.messages) };
    } catch {
      return row;
    }
  }

  insertAgentWorkLog(params: { id: string, projectId: string, bankId: string, eventType: string, meta: string, ts: number }): void {
    this.db.prepare(`
      INSERT INTO agent_work_log (id, project_id, bank_id, event_type, meta, ts)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(params.id, params.projectId, params.bankId, params.eventType, params.meta, params.ts);
  }

  addProjectMemory(payload: { content: string, importance?: number, source: string }): void {
    const fingerprint = payload.content.trim().slice(0, 120)
    const existing = this.queryGet('SELECT id FROM project_memory WHERE substr(content, 1, 120) = ?', fingerprint)
    if (existing) return
    this.db.prepare(`
      INSERT INTO project_memory (id, content, importance, source, created_at, last_accessed)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), payload.content, payload.importance ?? 3, payload.source, Date.now(), Date.now())
  }

  searchProjectMemory(limit: number = 5): MemoryFragment[] {
    return this.queryAll<MemoryFragment>(`
      SELECT * FROM project_memory ORDER BY (importance * 1.0 / (1.0 + (strftime('%s', 'now') * 1000 - created_at) / 86400000.0)) DESC LIMIT ?
    `, limit);
  }

  close() {
    this.db.close();
  }

  listRetroReports(projectId: string): any[] {
    return this.queryAll<any>(`
      SELECT * FROM retro_reports
      WHERE project_id = ?
      ORDER BY ts_generated DESC
    `, projectId);
  }

  getRetroReport(id: string): any {
    const report = this.queryGet<any>('SELECT * FROM retro_reports WHERE id = ?', id);
    if (!report) return null;

    const items = this.queryAll<any>('SELECT * FROM retro_items WHERE retro_id = ?', id);
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

  approveRetroReport(id: string, originatedStories: string[]): boolean {
    this.db.prepare(`
      UPDATE retro_reports
      SET status = 'approved', ts_approved = ?, retro_originated_stories = ?
      WHERE id = ?
    `).run(Date.now(), JSON.stringify(originatedStories), id)
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

  // ── Knowledge Base (Story 566) ────────────────────────────────────────────

  private migrateKnowledgeBase(): void {
    const newCols = [
      'ALTER TABLE intelligence_documents ADD COLUMN section TEXT',
      'ALTER TABLE intelligence_documents ADD COLUMN tags TEXT',
      'ALTER TABLE intelligence_documents ADD COLUMN source TEXT NOT NULL DEFAULT \'curated\'',
      'ALTER TABLE intelligence_documents ADD COLUMN version INTEGER NOT NULL DEFAULT 1',
      'ALTER TABLE intelligence_documents ADD COLUMN excerpt TEXT',

      // Story 590: Agent YAML Schema
      'ALTER TABLE intelligence_documents ADD COLUMN agent_model TEXT',
      'ALTER TABLE intelligence_documents ADD COLUMN agent_max_tokens INTEGER',
      'ALTER TABLE intelligence_documents ADD COLUMN agent_temperature REAL',
      'ALTER TABLE intelligence_documents ADD COLUMN agent_skills TEXT',
      'ALTER TABLE intelligence_documents ADD COLUMN agent_tools TEXT'
    ];
    for (const sql of newCols) {
      try { this.db.exec(sql); } catch { /* column already exists */ }
    }
  }

  upsertKbArticle(doc: {
    id: string;
    title: string;
    section: string;
    tags: string[];
    source: string;
    version: number;
    content: string;
    excerpt?: string;
  }): void {
    const ts = Date.now();
    const existing = this.queryGet<{ version: number }>('SELECT version FROM intelligence_documents WHERE id = ?', doc.id);

    if (existing) {
      if (doc.version > existing.version) {
        this.db.prepare(`
          UPDATE intelligence_documents
          SET title = ?, section = ?, tags = ?, source = ?, version = ?, content = ?, excerpt = ?, ts = ?
          WHERE id = ?
        `).run(doc.title, doc.section, JSON.stringify(doc.tags), doc.source, doc.version, doc.content, doc.excerpt || '', ts, doc.id);
      }
    } else {
      this.db.prepare(`
        INSERT INTO intelligence_documents (
          id, project_id, type, title, description, content, section, tags, source, version, excerpt, ts
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        doc.id,
        'default', // project_id
        'kb_article', // type
        doc.title,
        '', // description
        doc.content,
        doc.section,
        JSON.stringify(doc.tags),
        doc.source,
        doc.version,
        doc.excerpt || '',
        ts
      );
    }
  }

  listKbArticles(): Record<string, any[]> {
    const rows = this.queryAll<{ id: string; title: string; section: string; tags: string }>(`
      SELECT id, title, section, tags
      FROM intelligence_documents
      WHERE source = 'curated'
      ORDER BY section ASC, title ASC
    `);

    const mapped = rows.map(r => ({
      ...r,
      tags: r.tags ? JSON.parse(r.tags) : []
    }));

    return mapped.reduce((acc, curr) => {
      const sec = curr.section || 'uncategorized';
      if (!acc[sec]) {
        acc[sec] = [];
      }
      acc[sec].push(curr);
      return acc;
    }, {} as Record<string, any[]>);
  }

  getKbArticle(id: string): any {
    const row = this.queryGet<any>('SELECT * FROM intelligence_documents WHERE id = ?', id);

    if (!row) return null;
    return {
      ...row,
      tags: row.tags ? JSON.parse(row.tags) : []
    };
  }

  searchKbArticles(query: string): any[] {
    const searchPattern = `%${query}%`;
    return this.queryAll<any>(`
      SELECT id, title, section, excerpt
      FROM intelligence_documents
      WHERE source IN ('curated', 'user', 'community')
      AND (title LIKE ? OR content LIKE ?)
      ORDER BY ts DESC
    `, searchPattern, searchPattern);
  }

  // ── Intelligence Documents ────────────────────────────────────────────────

  listIntelDocs(projectId: string): any[] {
    const rows = this.queryAll<any>(`
      SELECT * FROM intelligence_documents
      WHERE project_id = ?
      ORDER BY type ASC, title ASC
    `, projectId);

    return rows.map(r => {
      const mapped = {
        ...r,
        projectId: r.project_id,
        pathScope: r.path_scope ? JSON.parse(r.path_scope) : null,
        toolRestrictions: r.tool_restrictions ? JSON.parse(r.tool_restrictions) : null,
        preferredModel: r.preferred_model,
        providers: r.providers ? JSON.parse(r.providers) : [],
        syncStatus: r.sync_status ? JSON.parse(r.sync_status) : {},
        agentModel: r.agent_model,
        agentMaxTokens: r.agent_max_tokens,
        agentTemperature: r.agent_temperature,
        agentSkills: r.agent_skills ? JSON.parse(r.agent_skills) : null,
        agentTools: r.agent_tools ? JSON.parse(r.agent_tools) : null
      };
      delete mapped.project_id;
      delete mapped.path_scope;
      delete mapped.tool_restrictions;
      delete mapped.preferred_model;
      delete mapped.sync_status;
      delete mapped.agent_model;
      delete mapped.agent_max_tokens;
      delete mapped.agent_temperature;
      delete mapped.agent_skills;
      delete mapped.agent_tools;
      return mapped;
    });
  }

  getIntelDoc(id: string): any {
    const row = this.queryGet<any>('SELECT * FROM intelligence_documents WHERE id = ?', id);

    if (!row) return null;

    // Remove raw snake_case keys after mapping to camelCase
    const mapped = {
      ...row,
      projectId: row.project_id,
      pathScope: row.path_scope ? JSON.parse(row.path_scope) : null,
      toolRestrictions: row.tool_restrictions ? JSON.parse(row.tool_restrictions) : null,
      preferredModel: row.preferred_model,
      providers: row.providers ? JSON.parse(row.providers) : [],
      syncStatus: row.sync_status ? JSON.parse(row.sync_status) : {},
      agentModel: row.agent_model,
      agentMaxTokens: row.agent_max_tokens,
      agentTemperature: row.agent_temperature,
      agentSkills: row.agent_skills ? JSON.parse(row.agent_skills) : null,
      agentTools: row.agent_tools ? JSON.parse(row.agent_tools) : null
    };

    delete mapped.project_id;
    delete mapped.path_scope;
    delete mapped.tool_restrictions;
    delete mapped.preferred_model;
    delete mapped.sync_status;
    delete mapped.agent_model;
    delete mapped.agent_max_tokens;
    delete mapped.agent_temperature;
    delete mapped.agent_skills;
    delete mapped.agent_tools;

    return mapped;
  }

  createIntelDoc(data: {
    projectId: string;
    type: string;
    title: string;
    description?: string;
    content?: string;
    pathScope?: string[];
    providers?: any[];
  }): any {
    // We use a custom ULID-like random ID to mimic the doc_<ulid> requested.
    const id = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const ts = Date.now();
    const syncStatus = {};

    this.db.prepare(`
      INSERT INTO intelligence_documents (
        id, project_id, type, title, description, content, path_scope, providers, sync_status, ts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.projectId,
      data.type,
      data.title,
      data.description || '',
      data.content || '',
      data.pathScope ? JSON.stringify(data.pathScope) : null,
      data.providers ? JSON.stringify(data.providers) : '[]',
      JSON.stringify(syncStatus),
      ts
    );

    return {
      id,
      projectId: data.projectId,
      type: data.type,
      title: data.title,
      description: data.description || '',
      content: data.content || '',
      pathScope: data.pathScope || null,
      toolRestrictions: null,
      preferredModel: null,
      providers: data.providers || [],
      syncStatus,
      ts
    };
  }

  updateIntelDoc(id: string, partial: any): any {
    const ts = Date.now();
    const allowed = [
      'title', 'description', 'content', 'pathScope', 'toolRestrictions',
      'preferredModel', 'providers', 'syncStatus',
      'agentModel', 'agentMaxTokens', 'agentTemperature', 'agentSkills', 'agentTools'
    ];
    const sets: string[] = ['ts = ?'];
    const vals: any[] = [ts];

    // Map camelCase keys to snake_case db columns
    const keyMap: Record<string, string> = {
      pathScope: 'path_scope',
      toolRestrictions: 'tool_restrictions',
      preferredModel: 'preferred_model',
      syncStatus: 'sync_status',
      agentModel: 'agent_model',
      agentMaxTokens: 'agent_max_tokens',
      agentTemperature: 'agent_temperature',
      agentSkills: 'agent_skills',
      agentTools: 'agent_tools'
    };

    for (const [k, v] of Object.entries(partial)) {
      if (allowed.includes(k)) {
        const dbKey = keyMap[k] || k;
        sets.push(`${dbKey} = ?`);

        if (['pathScope', 'toolRestrictions', 'providers', 'syncStatus', 'agentSkills', 'agentTools'].includes(k)) {
           vals.push(v ? JSON.stringify(v) : null);
        } else {
           vals.push(v);
        }
      }
    }

    vals.push(id);
    this.db.prepare(`UPDATE intelligence_documents SET ${sets.join(', ')} WHERE id = ?`).run(...vals);

    return this.getIntelDoc(id);
  }

  deleteIntelDoc(id: string): boolean {
    this.db.prepare('DELETE FROM intelligence_documents WHERE id = ?').run(id);
    return true;
  }

  getNlmNotebooks() {
    return this.queryAll<any>('SELECT * FROM nlm_notebooks ORDER BY created_at DESC');
  }

  registerNlmNotebook(notebook: { id: string; name: string; domain: string; description: string }) {
    const stmt = this.db.prepare(`
      INSERT INTO nlm_notebooks (id, name, domain, description)
      VALUES (@id, @name, @domain, @description)
      ON CONFLICT(id) DO UPDATE SET
        name = @name,
        domain = @domain,
        description = @description
    `);
    stmt.run(notebook);
    return this.getNlmNotebooks();
  }

  removeNlmNotebook(id: string) {
    this.db.prepare('DELETE FROM nlm_notebooks WHERE id = ?').run(id);
    return this.getNlmNotebooks();
  }

  getFailedAgentWorkLog(projectId: string, storyId: string, failedAgentId: string): any[] {
    // Schema doesn't have session_id or story_id directly on agent_work_log.
    // They are stored in 'meta' or 'bank_id'.
    // The requirement says:
    // SELECT * FROM agent_work_log WHERE session_id = :failedAgentId OR (story_id = :storyId AND event_type IN ('tool_call','file_edit','git_commit','error')) ORDER BY ts ASC
    // We'll emulate session_id and story_id via bank_id and JSON in meta if needed.
    // Assuming bank_id = storyId and session_id is in meta.
    return this.queryAll<any>(`
      SELECT * FROM agent_work_log
      WHERE project_id = ?
        AND (
          json_extract(meta, '$.sessionId') = ?
          OR json_extract(meta, '$.nodeId') = ?
          OR (bank_id = ? AND event_type IN ('tool_call', 'file_edit', 'git_commit', 'error'))
        )
      ORDER BY ts ASC
    `, projectId, failedAgentId, failedAgentId, storyId);
  }

  // Codebase Indexer Vector Search

  initCodebaseVecTable() {
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS codebase_vec USING vec0(
        chunk_id TEXT PRIMARY KEY,
        file_path TEXT,
        line_start INTEGER,
        line_end INTEGER,
        symbols TEXT,
        symbol_uid TEXT,
        lsp_metadata TEXT,
        chunk_index INTEGER,
        content TEXT,
        embedding FLOAT[768]
      );
    `);
  }

  clearCodebaseVecFile(filePath: string) {
    this.db.prepare('DELETE FROM codebase_vec WHERE file_path = ?').run(filePath);
  }

  insertCodebaseVecChunk(
    chunkId: string,
    filePath: string,
    lineStart: number,
    lineEnd: number,
    symbols: string,
    symbolUid: string | null,
    lspMetadata: string | null,
    chunkIndex: number,
    content: string,
    embedding: Float32Array
  ) {
    this.db.prepare(`
      INSERT INTO codebase_vec(chunk_id, file_path, line_start, line_end, symbols, symbol_uid, lsp_metadata, chunk_index, content, embedding)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(chunkId, filePath, lineStart, lineEnd, symbols, symbolUid, lspMetadata, chunkIndex, content, embedding);
  }

  searchCodebaseVecBySymbol(symbolUid: string): any[] {
    return this.queryAll<any>(`
      SELECT chunk_id, file_path, line_start, line_end, symbols, content
      FROM codebase_vec
      WHERE symbol_uid = ?
    `, symbolUid);
  }

  searchCodebaseVec(embedding: Float32Array, topK: number): any[] {
    return this.queryAll<any>(`
      SELECT chunk_id, file_path, line_start, line_end, symbols, content, distance
      FROM codebase_vec
      WHERE embedding MATCH ?
      ORDER BY distance
      LIMIT ?
    `, embedding, topK);
  }

  // General App Queries

  getDailyCosts(days: number): any[] {
    return this.queryAll<any>(`
      SELECT date(created_at) as day,
             SUM(cost_usd) as total_cost,
             SUM(tokens_in + tokens_out) as total_tokens
      FROM model_calls
      WHERE created_at >= date('now', '-' || ? || ' days')
      GROUP BY date(created_at) ORDER BY day ASC
    `, days);
  }

  getCostByModel(): any[] {
    return this.queryAll<any>(`
      SELECT model_id, provider,
             SUM(cost_usd) as total_cost,
             COUNT(*) as call_count,
             SUM(tokens_in) as tokens_in,
             SUM(tokens_out) as tokens_out
      FROM model_calls GROUP BY model_id, provider ORDER BY total_cost DESC
    `);
  }

  getCostByStory(): any[] {
    return this.queryAll<any>(`
      SELECT panel_id as story_id,
             SUM(cost_usd) as total_cost,
             COUNT(*) as call_count,
             SUM(tokens_in + tokens_out) as total_tokens
      FROM model_calls
      WHERE panel_id IS NOT NULL AND panel_id != 'chat'
      GROUP BY panel_id ORDER BY total_cost DESC LIMIT 50
    `);
  }

  getWeeklyVelocity(weeks: number): any[] {
    return this.queryAll<any>(`
      SELECT strftime('%Y-W%W', start_time) as week,
             SUM(duration_hours) as hours,
             COUNT(DISTINCT story_id) as stories
      FROM dev_sessions
      WHERE start_time >= date('now', '-' || (? * 7) || ' days')
      GROUP BY week ORDER BY week ASC
    `, weeks);
  }

  getCostHeatmapData(): { churnMap: Record<string, number>, costMap: Record<string, number> } {
    const churn = this.queryAll<{ changed_files: string }>('SELECT changed_files FROM review_sessions');
    const churnMap: Record<string, number> = {};
    churn.forEach(s => {
      try {
        const files = JSON.parse(s.changed_files) as string[];
        if (Array.isArray(files)) files.forEach(f => churnMap[f] = (churnMap[f] || 0) + 1);
      } catch (err) { /* non-critical */ }
    });

    const costs = this.queryAll<{ cost_usd: number; changed_files: string }>(`
      SELECT mc.cost_usd, rs.changed_files
      FROM model_calls mc
      JOIN review_sessions rs ON mc.session_id = rs.session_id
    `);

    const costMap: Record<string, number> = {};
    costs.forEach(c => {
      try {
        const files = JSON.parse(c.changed_files) as string[];
        if (Array.isArray(files)) {
          const splitCost = c.cost_usd / files.length;
          files.forEach(f => costMap[f] = (costMap[f] || 0) + splitCost);
        }
      } catch (err) { /* non-critical */ }
    });

    return { churnMap, costMap };
  }

  // CapEx Analytics
  getCapexLeaderboard(days: number | 'all'): any[] {
    let query = `
      SELECT
        provider,
        model_id,
        COUNT(*) as total_calls,
        SUM(cost_usd) as total_cost,
        AVG(latency_ms) as avg_latency,
        SUM(tokens_out) as total_tokens_out,
        SUM(CASE WHEN tokens_out > 0 THEN 1 ELSE 0 END) as successful_calls
      FROM model_calls
    `;
    const params: unknown[] = [];
    if (days !== 'all') {
      query += ` WHERE created_at >= date('now', '-' || ? || ' days')`;
      params.push(days);
    }
    query += ` GROUP BY provider, model_id`;
    return this.queryAll<any>(query, ...params);
  }

  // Stories
  getStoriesThroughput(): any[] {
    return this.queryAll<any>(`
      SELECT strftime('%Y-W%W', updated_at) as week, COUNT(*) as completed
      FROM stories WHERE status = 'COMPLETE' AND updated_at >= date('now', '-84 days')
      GROUP BY week ORDER BY week ASC
    `);
  }

  getStoriesStatusDistribution(): any[] {
    return this.queryAll<any>(`
      SELECT status, COUNT(*) as count FROM stories GROUP BY status ORDER BY count DESC
    `);
  }

  getStoriesBugsByAssignee(): any[] {
    return this.queryAll<any>(`
      SELECT COALESCE(assigned_to, 'unassigned') as assignee, COUNT(*) as bug_count
      FROM stories WHERE type = 'bug' GROUP BY assigned_to ORDER BY bug_count DESC
    `);
  }

  // Transactions
  runTransaction(fn: () => void): void {
    this.db.transaction(fn)();
  }
}

// Module-level singleton for use across main-process modules
export const stateLedger = new StateLedger()
