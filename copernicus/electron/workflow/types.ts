import type { ProviderType } from '../auth-manager';

export type NodeType = 'agent' | 'tool' | 'decision' | 'trigger' | 'flow' | 'verification' | 'extension';

export type NodeStatus = 'idle' | 'running' | 'completed' | 'failed' | 'error' | 'skipped' | 'paused';

export type WFNodeRole =
  | 'researcher'
  | 'planner'
  | 'checker'
  | 'executor'
  | 'verifier'
  | 'auditor';

export interface WFNodeRoleConfig {
  role: WFNodeRole;
  modelTier: 'fast' | 'thinker' | 'coder';
  toolPolicy: 'all' | 'read-only' | 'read-no-exec' | 'read-bash-no-write';
  description: string;
}

export interface AgentNodeData {
  variant: 'agent';
  provider: ProviderType;
  modelId: string;
  persona: string;
  systemPrompt: string;
  task: string;
  contextFiles: string[];
  outputChannel: 'terminal' | 'chat' | 'file' | 'context';
  outputFile?: string;
  temperature?: number;
  maxTokens?: number;
  useWorktree?: boolean;
  mergeMode?: 'gated' | 'yolo';
}

export interface ToolNodeData {
  variant: 'shell-command' | 'makefile-run' | 'file-read' | 'file-write'
         | 'story-update' | 'log-event' | 'send-chat' | 'notify' | 'screenshot' | 'browser-action'
         | 'jules-watch' | 'github-fetch-diff' | 'github-post-comment' | 'kanban-flag-card'
         | 'db-query' | 'memory-write' | 'agents-md-append';
  command?: string;       // shell-command, makefile-run
  filePath?: string;      // file-read, file-write
  content?: string;       // file-write
  storyId?: string;       // story-update
  field?: string;         // story-update field name
  value?: string;         // story-update field value
  message?: string;       // log-event, send-chat, notify
  action?: 'launch' | 'navigate' | 'click' | 'fill' | 'screenshot' | 'evaluate' | 'close'; // browser-action
  url?: string;           // browser-action: navigate
  selector?: string;      // browser-action: click, fill, screenshot
  contextKey?: string;    // db-query: key to store result in context
  query?: string;         // db-query: SQL query
  importance?: number;    // memory-write: memory importance (1-5)
  source?: string;        // memory-write, agents-md-append: source info
}

export interface TriggerNodeData {
  variant: 'manual' | 'story-activated' | 'story-status-change' | 'terminal-exit' | 'cron';
  storyId?: string;
  expectedStatus?: string;
  terminalId?: string;
  scheduleNl?: string;
  scheduleCron?: string;
}

export interface DecisionNodeData {
  variant: 'exit-code-gate' | 'output-match' | 'story-status-check' | 'human-approval';
  pattern?: string;       // output-match: regex string
  expectedStatus?: string; // story-status-check
  storyId?: string;
  message?: string;       // human-approval
}

export interface FlowNodeData {
  variant: 'delay';
  durationMs: number;
}

export interface VerificationNodeData {
  variant: 'verification';
  checklist: string[];
}

export interface ExtensionNodeData {
  extensionType: string; // The registered node type key from ExtensionRegistry
  label?: string;
  config?: Record<string, unknown>;
}

export type WorkflowNodeData =
  | AgentNodeData
  | ToolNodeData
  | TriggerNodeData
  | DecisionNodeData
  | FlowNodeData
  | VerificationNodeData
  | { type: 'extension'; data: ExtensionNodeData };

export interface WFNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  data: WorkflowNodeData; // For storing config like agent name, command, etc.
  status?: NodeStatus;
  role?: WFNodeRole;
}

export interface WFEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  data?: any;
}

export interface WorkflowGraph {
  id: string;
  name: string;
  nodes: WFNode[];
  edges: WFEdge[];
}

export interface WorkflowExecutionEvent {
  nodeId: string;
  status: NodeStatus;
  timestamp: number;
  message?: string;
  error?: string;
}

export interface WorkflowStepStartEvent {
  workflowId: string;
  nodeId: string;
  nodeType: string;
  turn: number;
  timestamp: number;
}

export interface WorkflowStepEndEvent {
  workflowId: string;
  nodeId: string;
  status: 'completed' | 'error' | 'skipped';
  durationMs: number;
  timestamp: number;
}
