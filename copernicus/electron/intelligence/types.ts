export type IntelligenceDocType = 'instruction' | 'rule' | 'agent' | 'skill' | 'command';

export type ProviderKey = 'claude' | 'gemini' | 'openai' | string;

export interface ProviderTarget {
  provider: ProviderKey;
  targetId?: string;
  options?: Record<string, any>;
}

export type SyncStatusValue = 'pending' | 'synced' | 'error';

export interface IntelligenceDocument {
  id: string; // doc_<ulid>
  projectId: string;
  type: IntelligenceDocType;
  title: string;
  description: string;
  content: string;
  pathScope: string[] | null;
  toolRestrictions: string[] | null;
  preferredModel: string | null;
  providers: ProviderTarget[];
  syncStatus: Record<ProviderKey, SyncStatusValue>;
  ts: number;

  // Agent schema fields (Story 590)
  agentModel?: string | null;
  agentMaxTokens?: number | null;
  agentTemperature?: number | null;
  agentSkills?: string[] | null;
  agentTools?: string[] | null;
}

export interface IntelligenceDocSuggestion {
  id: string;          // suggestion_<ulid> — ephemeral, not persisted
  type: IntelligenceDocType;
  title: string;
  description: string;
  content: string;
  rationale: string;   // why this suggestion was generated (displayed to user)
}
