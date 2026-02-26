export type NodeType = 'agent' | 'tool' | 'decision' | 'trigger';

export type NodeStatus = 'idle' | 'running' | 'completed' | 'failed';

export interface WFNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  data: Record<string, any>; // For storing config like agent name, command, etc.
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
}
