export interface HubEvent {
  event_id: string;
  timestamp: string;
  token_id: string;
  event_type: string;
  action: string | null;
  result: string | null;
  notes: string | null;
}

export interface HubAttribution {
  attr_id: string;
  timestamp: string;
  surface: string;
  instructing_actor: string | null;
  executing_actor: string;
  authority_level: number;
  action_type: string;
  target: string | null;
  summary: string | null;
  git_sha: string | null;
  token_id: string | null;
}

export interface HubCostSummary {
  by_role: Array<{ role_name: string; total_usd: number; token_count: number }>;
  active_tokens: Array<{ token_id: string; role_name: string; cost_usd: number; max_cost_usd: number }>;
  daily: Array<{ date: string; total_usd: number; token_count: number; top_role?: string }>;
}
