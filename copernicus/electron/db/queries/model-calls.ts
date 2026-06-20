import type { Database } from 'libsql';
import type { ModelCallRecord, ModelCallStats } from '../types';

interface TotalStatsRow {
  total_calls: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost_usd: number;
}

interface ByModelRow {
  model_id: string;
  provider: string;
  calls: number;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
}

export function logModelCall(db: Database, record: Omit<ModelCallRecord, 'id' | 'created_at'>): number {
  const info = db.prepare(`
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
  );
  return info.lastInsertRowid as number;
}

export function getSessionStats(db: Database, session_id: string): ModelCallStats {
  const total = db.prepare(`
    SELECT COUNT(*) as total_calls,
           SUM(tokens_in) as total_tokens_in,
           SUM(tokens_out) as total_tokens_out,
           SUM(cost_usd) as total_cost_usd
    FROM model_calls WHERE session_id = ?
  `).get(session_id) as TotalStatsRow | undefined;

  const byModel = db.prepare(`
    SELECT model_id, provider,
           COUNT(*) as calls,
           SUM(tokens_in) as tokens_in,
           SUM(tokens_out) as tokens_out,
           SUM(cost_usd) as cost_usd
    FROM model_calls WHERE session_id = ?
    GROUP BY model_id, provider ORDER BY calls DESC
  `).all(session_id) as ByModelRow[];

  return {
    total_calls:      total?.total_calls      ?? 0,
    total_tokens_in:  total?.total_tokens_in  ?? 0,
    total_tokens_out: total?.total_tokens_out ?? 0,
    total_cost_usd:   total?.total_cost_usd   ?? 0,
    by_model: byModel,
  };
}

export function getRecentCalls(db: Database, limit = 100, panel_id?: string): ModelCallRecord[] {
  if (panel_id) {
    return db.prepare('SELECT * FROM model_calls WHERE panel_id = ? ORDER BY created_at DESC LIMIT ?').all(panel_id, limit) as ModelCallRecord[];
  }
  return db.prepare('SELECT * FROM model_calls ORDER BY created_at DESC LIMIT ?').all(limit) as ModelCallRecord[];
}

export function getEditDecisionsCounts(db: Database, promptId: string): { accept: number, reject: number, abort: number } {
  const rows = db.prepare('SELECT decision, COUNT(*) as count FROM edit_decisions WHERE prompt_id = ? GROUP BY decision').all(promptId) as { decision: string, count: number }[];
  const result = { accept: 0, reject: 0, abort: 0 };
  for (const row of rows) {
    if (row.decision === 'accept') result.accept = row.count;
    if (row.decision === 'reject') result.reject = row.count;
    if (row.decision === 'abort') result.abort = row.count;
  }
  return result;
}

export function getAllTimeCost(db: Database): number {
  const row = db.prepare('SELECT SUM(cost_usd) as total FROM model_calls').get() as { total: number } | undefined;
  return row?.total ?? 0;
}

export function getSessionStatsByRole(db: Database, sessionId: string): { role: string, tokens: number, cost: number }[] {
  return db.prepare(`
    SELECT COALESCE(persona_role, 'unknown') as role,
           SUM(tokens_in + tokens_out) as tokens, SUM(cost_usd) as cost
    FROM model_calls WHERE session_id = ?
    GROUP BY role ORDER BY cost DESC
  `).all(sessionId) as { role: string, tokens: number, cost: number }[];
}

export function getAllTimeStatsByRole(db: Database): { role: string, tokens: number, cost: number }[] {
  return db.prepare(`
    SELECT COALESCE(persona_role, 'unknown') as role,
           SUM(tokens_in + tokens_out) as tokens, SUM(cost_usd) as cost
    FROM model_calls GROUP BY role ORDER BY cost DESC
  `).all() as { role: string, tokens: number, cost: number }[];
}

export function queryModelCallsSprint(db: Database, since: number): object[] {
  return db.prepare(`
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

export function queryModelPerformanceSprint(db: Database, since: number): object[] {
  return db.prepare(`
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
