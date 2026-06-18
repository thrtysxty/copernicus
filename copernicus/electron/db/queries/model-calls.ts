import type { Database } from 'libsql';
import type { ModelCallRecord } from '../state-ledger';

export function logModelCall(db: Database, call: Omit<ModelCallRecord, 'id'>): number {
  const result = db.prepare(`
    INSERT INTO model_calls (session_id, panel_id, model_id, provider, persona_role,
                             tokens_in, tokens_out, cost_usd, latency_ms, reasoning,
                             workflow_run_id, parent_call_id, created_at,
                             prompt_text, response_text, context_json, prompt_id, commit_sha)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    call.session_id,
    call.panel_id,
    call.model_id,
    call.provider,
    call.persona_role ?? 'unknown',
    call.tokens_in ?? 0,
    call.tokens_out ?? 0,
    call.cost_usd ?? 0,
    call.latency_ms ?? null,
    call.reasoning ?? null,
    call.workflow_run_id ?? null,
    call.parent_call_id ?? null,
    call.created_at ?? new Date().toISOString(),
    call.prompt_text ?? null,
    call.response_text ?? null,
    call.context_json ?? null,
    call.prompt_id ?? null,
    call.commit_sha ?? null
  );
  return result.lastInsertRowid as number;
}

export function getModelCallsBySession(db: Database, sessionId: string): ModelCallRecord[] {
  return db.prepare(`
    SELECT * FROM model_calls WHERE session_id = ? ORDER BY created_at ASC
  `).all(sessionId) as ModelCallRecord[];
}

export function getRecentModelCalls(db: Database, limit = 50): ModelCallRecord[] {
  return db.prepare(`
    SELECT * FROM model_calls ORDER BY created_at DESC LIMIT ?
  `).all(limit) as ModelCallRecord[];
}

export function getModelCallStats(db: Database): {
  total_calls: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost_usd: number;
  by_model: Array<{ model_id: string; provider: string; calls: number; tokens_in: number; tokens_out: number; cost_usd: number }>;
} {
  const total = db.prepare(`
    SELECT
      COUNT(*) as total_calls,
      SUM(tokens_in) as total_tokens_in,
      SUM(tokens_out) as total_tokens_out,
      SUM(cost_usd) as total_cost_usd
    FROM model_calls
  `).get() as { total_calls: number; total_tokens_in: number; total_tokens_out: number; total_cost_usd: number };

  const byModel = db.prepare(`
    SELECT model_id, provider,
      COUNT(*) as calls,
      SUM(tokens_in) as tokens_in,
      SUM(tokens_out) as tokens_out,
      SUM(cost_usd) as cost_usd
    FROM model_calls
    GROUP BY model_id, provider
    ORDER BY total_cost_usd DESC
  `).all() as Array<{ model_id: string; provider: string; calls: number; tokens_in: number; tokens_out: number; cost_usd: number }>;

  return {
    total_calls: total.total_calls ?? 0,
    total_tokens_in: total.total_tokens_in ?? 0,
    total_tokens_out: total.total_tokens_out ?? 0,
    total_cost_usd: total.total_cost_usd ?? 0,
    by_model: byModel
  };
}

export function getModelCallsByStoryId(db: Database, storyId: string): ModelCallRecord[] {
  return db.prepare(`
    SELECT * FROM model_calls WHERE prompt_id = ? ORDER BY created_at ASC
  `).all(storyId) as ModelCallRecord[];
}

export function getCostByStory(db: Database): Array<{ story_id: string; total_cost: number; call_count: number }> {
  return db.prepare(`
    SELECT prompt_id as story_id,
      SUM(cost_usd) as total_cost,
      COUNT(*) as call_count
    FROM model_calls
    WHERE prompt_id IS NOT NULL
    GROUP BY prompt_id
    ORDER BY total_cost DESC
  `).all() as Array<{ story_id: string; total_cost: number; call_count: number }>;
}

export function getDailyCosts(db: Database, days = 30): Array<{ date: string; cost_usd: number }> {
  return db.prepare(`
    SELECT date(created_at) as date, SUM(cost_usd) as cost_usd
    FROM model_calls
    WHERE created_at >= datetime('now', ? || ' days')
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all(-days) as Array<{ date: string; cost_usd: number }>;
}

export function getCostByModel(db: Database): Array<{ model_id: string; provider: string; total_cost: number; call_count: number }> {
  return db.prepare(`
    SELECT model_id, provider,
      SUM(cost_usd) as total_cost,
      COUNT(*) as call_count
    FROM model_calls
    GROUP BY model_id, provider
    ORDER BY total_cost DESC
  `).all() as Array<{ model_id: string; provider: string; total_cost: number; call_count: number }>;
}

export function getLeaderboard(db: Database): Array<{ panel_id: string; calls: number; cost_usd: number }> {
  return db.prepare(`
    SELECT panel_id, COUNT(*) as calls, SUM(cost_usd) as cost_usd
    FROM model_calls
    GROUP BY panel_id
    ORDER BY cost_usd DESC
  `).all() as Array<{ panel_id: string; calls: number; cost_usd: number }>;
}