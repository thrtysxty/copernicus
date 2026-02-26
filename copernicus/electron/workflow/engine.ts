import { WorkflowState, VALID_TRANSITIONS } from './states';
import { WorkflowGraph, WFNode, NodeStatus, WorkflowExecutionEvent } from './types';

export type StateCallback = (event: WorkflowExecutionEvent) => void;

export class WorkflowEngine {
  private currentState: WorkflowState = 'IDLE';
  private nodeStatuses: Map<string, NodeStatus> = new Map();

  constructor() {
    console.log('[SYSTEM] WorkflowEngine Initialized in IDLE state.');
  }

  public getState(): WorkflowState {
    return this.currentState;
  }

  public getNodeStatuses(): Record<string, NodeStatus> {
    return Object.fromEntries(this.nodeStatuses);
  }

  public transition(newState: WorkflowState): boolean {
    const isValid = VALID_TRANSITIONS.some(
      t => t.from === this.currentState && t.to === newState
    );

    if (isValid) {
      console.log(`[WorkflowEngine] Transition: ${this.currentState} -> ${newState}`);
      this.currentState = newState;
      return true;
    }

    console.warn(`[SECURITY] Invalid workflow transition attempted: ${this.currentState} -> ${newState}`);
    return false;
  }

  public async runGraph(graph: WorkflowGraph, callback?: StateCallback): Promise<void> {
    if (!this.transition('RUNNING')) {
      throw new Error('WorkflowEngine could not transition to RUNNING state.');
    }

    // Reset statuses
    this.nodeStatuses.clear();
    graph.nodes.forEach(n => this.nodeStatuses.set(n.id, 'idle'));

    try {
      const sortedNodes = this.topologicalSort(graph);
      console.log('[WorkflowEngine] Execution Order:', sortedNodes.map(n => n.id).join(' -> '));

      for (const node of sortedNodes) {
        await this.executeNode(node, callback);
      }

      this.transition('COMPLETE');
    } catch (error) {
      console.error('[WorkflowEngine] Execution Failed:', error);
      this.transition('FAILED');
    }
  }

  private topologicalSort(graph: WorkflowGraph): WFNode[] {
    const { nodes, edges } = graph;
    const inDegree: Map<string, number> = new Map();
    const adj: Map<string, string[]> = new Map();

    nodes.forEach(node => {
      inDegree.set(node.id, 0);
      adj.set(node.id, []);
    });

    edges.forEach(edge => {
      if (adj.has(edge.source) && inDegree.has(edge.target)) {
        adj.get(edge.source)!.push(edge.target);
        inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
      }
    });

    const queue: string[] = [];
    inDegree.forEach((degree, id) => {
      if (degree === 0) {
        queue.push(id);
      }
    });

    const sorted: WFNode[] = [];
    while (queue.length > 0) {
      const u = queue.shift()!;
      const node = nodes.find(n => n.id === u);
      if (node) sorted.push(node);

      const neighbors = adj.get(u) || [];
      for (const v of neighbors) {
        inDegree.set(v, (inDegree.get(v)!) - 1);
        if (inDegree.get(v) === 0) {
          queue.push(v);
        }
      }
    }

    if (sorted.length !== nodes.length) {
      throw new Error('Workflow contains a cycle or invalid nodes.');
    }

    return sorted;
  }

  private async executeNode(node: WFNode, callback?: StateCallback): Promise<void> {
    console.log(`[WorkflowEngine] Executing node: ${node.id} (${node.type})`);
    
    this.updateNodeStatus(node.id, 'running', callback);

    const delay = node.type === 'agent' ? 2000 : 
                  node.type === 'tool' ? 1000 : 500;
    
    await new Promise(resolve => setTimeout(resolve, delay));

    this.updateNodeStatus(node.id, 'completed', callback);
  }

  private updateNodeStatus(nodeId: string, status: NodeStatus, callback?: StateCallback) {
    this.nodeStatuses.set(nodeId, status);
    if (callback) {
      callback({
        nodeId,
        status,
        timestamp: Date.now(),
        message: `Node ${nodeId} is now ${status}`
      });
    }
  }
}

export const workflowEngine = new WorkflowEngine();
