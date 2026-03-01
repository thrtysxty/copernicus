import type { ProviderType } from '../auth-manager';

export type NodeType = 'agent' | 'tool' | 'decision' | 'trigger' | 'flow';

export type NodeStatus = 'idle' | 'running' | 'completed' | 'failed' | 'error' | 'skipped';

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
}

export interface ToolNodeData {
  variant: 'shell-command' | 'makefile-run' | 'file-read' | 'file-write'
         | 'story-update' | 'log-event' | 'send-chat' | 'notify' | 'screenshot' | 'browser-action';
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
}

export interface TriggerNodeData {
  variant: 'manual' | 'story-activated' | 'story-status-change' | 'terminal-exit';
  storyId?: string;
  expectedStatus?: string;
  terminalId?: string;
}

export interface DecisionNodeData {
  variant: 'exit-code-gate' | 'output-match' | 'human-approval' | 'story-status-check';
  pattern?: string;       // output-match: regex string
  expectedStatus?: string; // story-status-check
  storyId?: string;
}

export interface FlowNodeData {
  variant: 'delay';
  durationMs: number;
}

export type WorkflowNodeData =
  | AgentNodeData
  | ToolNodeData
  | TriggerNodeData
  | DecisionNodeData
  | FlowNodeData;

export interface WFNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  data: WorkflowNodeData; // For storing config like agent name, command, etc.
  status?: NodeStatus;
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
