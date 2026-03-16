import { Database } from 'better-sqlite3'

export interface ReplayRun {
  run_id: string        // workflow_run_id or session_id
  started_at: string
  model_id: string
  provider: string
  step_count: number
  outcome: 'success' | 'failed' | 'unknown'
}

export interface ReplayStep {
  id: number
  run_id: string
  model_id: string
  provider: string
  tokens_in: number
  tokens_out: number
  latency_ms: number | null
  created_at: string
  has_prompt: boolean
  has_response: boolean
}

export interface ReplayStepDetail extends ReplayStep {
  prompt_text: string | null
  response_text: string | null
  context_json: string | null
}

export class ReplayEngine {
  constructor(private db: Database) {}

  listRuns(limit = 50): ReplayRun[] {
    // 1. Workflow runs
    const workflows = this.db.prepare(`
      SELECT 
        workflow_run_id as run_id, 
        MIN(created_at) as started_at, 
        model_id, 
        provider, 
        COUNT(*) as step_count 
      FROM model_calls 
      WHERE workflow_run_id IS NOT NULL 
      GROUP BY workflow_run_id 
      ORDER BY started_at DESC 
      LIMIT ?
    `).all(limit) as any[]

    // 2. Individual chat sessions (where workflow_run_id is null)
    const sessions = this.db.prepare(`
      SELECT 
        session_id as run_id, 
        MIN(created_at) as started_at, 
        model_id, 
        provider, 
        COUNT(*) as step_count 
      FROM model_calls 
      WHERE workflow_run_id IS NULL 
      GROUP BY session_id 
      ORDER BY started_at DESC 
      LIMIT ?
    `).all(limit) as any[]

    // Combine and re-sort
    const combined = [...workflows, ...sessions]
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
      .slice(0, limit)
      .map(r => ({
        run_id: r.run_id,
        started_at: r.started_at,
        model_id: r.model_id,
        provider: r.provider,
        step_count: r.step_count,
        outcome: 'unknown' as const
      }))

    return combined
  }

  getSteps(run_id: string): ReplayStep[] {
    const rows = this.db.prepare(`
      SELECT 
        id, 
        COALESCE(workflow_run_id, session_id) as run_id,
        model_id, 
        provider, 
        tokens_in, 
        tokens_out, 
        latency_ms, 
        created_at,
        prompt_text,
        response_text
      FROM model_calls 
      WHERE workflow_run_id = ? OR session_id = ?
      ORDER BY created_at ASC
    `).all(run_id, run_id) as any[]

    return rows.map(r => ({
      id: r.id,
      run_id: r.run_id,
      model_id: r.model_id,
      provider: r.provider,
      tokens_in: r.tokens_in,
      tokens_out: r.tokens_out,
      latency_ms: r.latency_ms,
      created_at: r.created_at,
      has_prompt: !!r.prompt_text,
      has_response: !!r.response_text
    }))
  }

  getStepDetail(id: number): ReplayStepDetail | null {
    const r = this.db.prepare(`
      SELECT 
        id, 
        COALESCE(workflow_run_id, session_id) as run_id,
        model_id, 
        provider, 
        tokens_in, 
        tokens_out, 
        latency_ms, 
        created_at,
        prompt_text,
        response_text,
        context_json
      FROM model_calls 
      WHERE id = ?
    `).get(id) as any

    if (!r) return null

    return {
      id: r.id,
      run_id: r.run_id,
      model_id: r.model_id,
      provider: r.provider,
      tokens_in: r.tokens_in,
      tokens_out: r.tokens_out,
      latency_ms: r.latency_ms,
      created_at: r.created_at,
      has_prompt: !!r.prompt_text,
      has_response: !!r.response_text,
      prompt_text: r.prompt_text,
      response_text: r.response_text,
      context_json: r.context_json
    }
  }
}
