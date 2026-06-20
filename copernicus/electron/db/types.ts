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
  blocked_by?: string[]
  blocks?: string[]
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
  id: string;
  path: string;
  billing_mode: string;
  billing_details?: string;
  target_device?: string;
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
  prompt_id?: string | null;
  commit_sha?: string | null;
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
