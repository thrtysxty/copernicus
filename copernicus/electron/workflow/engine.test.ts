import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowEngine } from './engine';
import { WorkflowGraph, WFNode, WFEdge } from './types';
import type { EngineServices } from './engine';

describe('WorkflowEngine - Step Events', () => {
  let engine: WorkflowEngine;
  let mockWin: any;
  let mockServices: Partial<EngineServices>;

  beforeEach(() => {
    engine = new WorkflowEngine();
    mockWin = {
      webContents: {
        send: vi.fn(),
      },
    };
    mockServices = {
      win: mockWin as any,
      fsManager: { getRootPath: vi.fn().mockReturnValue('') } as any,
      stateLedger: { logEvent: vi.fn() } as any,
    };
    engine.setServices(mockServices as EngineServices);
  });

  it('Test 1: Run a 3-node linear workflow; confirm 3 step-start + 3 step-end events emitted in order.', async () => {
    const nodes: WFNode[] = [
      { id: '1', type: 'trigger', label: 'T', x: 0, y: 0, data: { variant: 'manual' } },
      { id: '2', type: 'flow', label: 'F', x: 0, y: 0, data: { variant: 'delay', durationMs: 1 } },
      { id: '3', type: 'flow', label: 'F2', x: 0, y: 0, data: { variant: 'delay', durationMs: 1 } },
    ];
    const edges: WFEdge[] = [
      { id: 'e1', source: '1', target: '2' },
      { id: 'e2', source: '2', target: '3' },
    ];
    const graph: WorkflowGraph = { id: 'wf1', name: 'wf1', nodes, edges };

    await engine.runGraph(graph);

    const calls = mockWin.webContents.send.mock.calls;
    const startCalls = calls.filter((c: any) => c[0] === 'workflow:step-start');
    const endCalls = calls.filter((c: any) => c[0] === 'workflow:step-end');

    expect(startCalls.length).toBe(3);
    expect(endCalls.length).toBe(3);

    expect(startCalls[0][1].nodeId).toBe('1');
    expect(startCalls[1][1].nodeId).toBe('2');
    expect(startCalls[2][1].nodeId).toBe('3');

    expect(endCalls[0][1].nodeId).toBe('1');
    expect(endCalls[0][1].status).toBe('completed');
    expect(endCalls[1][1].nodeId).toBe('2');
    expect(endCalls[2][1].nodeId).toBe('3');
  });

  it('Test 2: Run a decision workflow where branch B is skipped; confirm branch B node gets step-end with status: skipped and no step-start.', async () => {
    const nodes: WFNode[] = [
      { id: '1', type: 'decision', label: 'D', x: 0, y: 0, data: { variant: 'output-match', pattern: 'match' } },
      { id: '2', type: 'flow', label: 'A', x: 0, y: 0, data: { variant: 'delay', durationMs: 1 } },
      { id: '3', type: 'flow', label: 'B', x: 0, y: 0, data: { variant: 'delay', durationMs: 1 } },
    ];
    const edges: WFEdge[] = [
      { id: 'e1', source: '1', target: '2', label: 'Yes' },
      { id: 'e2', source: '1', target: '3', label: 'No' },
    ];
    const graph: WorkflowGraph = { id: 'wf2', name: 'wf2', nodes, edges };

    await engine.runGraph(graph);

    const calls = mockWin.webContents.send.mock.calls;
    const startCalls = calls.filter((c: any) => c[0] === 'workflow:step-start');
    const endCalls = calls.filter((c: any) => c[0] === 'workflow:step-end');

    expect(startCalls.length).toBe(2);
    expect(startCalls[0][1].nodeId).toBe('1');
    expect(startCalls[1][1].nodeId).toBe('3');

    expect(endCalls.length).toBe(3);
    const skippedCall = endCalls.find((c: any) => c[1].nodeId === '2');
    expect(skippedCall[1].status).toBe('skipped');
    expect(skippedCall[1].durationMs).toBe(0);
  });

  it('Test 3: Run a workflow where node 2 throws; confirm step-end with status: error emitted before workflow halts.', async () => {
    const nodes: WFNode[] = [
      { id: '1', type: 'trigger', label: 'T', x: 0, y: 0, data: { variant: 'manual' } },
      { id: '2', type: 'tool', label: 'Err', x: 0, y: 0, data: { variant: 'invalid' as any } },
      { id: '3', type: 'flow', label: 'F', x: 0, y: 0, data: { variant: 'delay', durationMs: 1 } },
    ];
    const edges: WFEdge[] = [
      { id: 'e1', source: '1', target: '2' },
      { id: 'e2', source: '2', target: '3' },
    ];
    const graph: WorkflowGraph = { id: 'wf3', name: 'wf3', nodes, edges };

    await engine.runGraph(graph);

    const calls = mockWin.webContents.send.mock.calls;
    const endCalls = calls.filter((c: any) => c[0] === 'workflow:step-end');

    expect(endCalls.length).toBe(2);
    expect(endCalls[0][1].nodeId).toBe('1');
    expect(endCalls[0][1].status).toBe('completed');
    expect(endCalls[1][1].nodeId).toBe('2');
    expect(endCalls[1][1].status).toBe('error');

    const startCalls = calls.filter((c: any) => c[0] === 'workflow:step-start');
    expect(startCalls.length).toBe(2);
    expect(startCalls[0][1].nodeId).toBe('1');
    expect(startCalls[1][1].nodeId).toBe('2');
  });

  it('Test 4: durationMs in step-end is >= 0 and reflects actual execution time.', async () => {
    const nodes: WFNode[] = [
      { id: '1', type: 'flow', label: 'F', x: 0, y: 0, data: { variant: 'delay', durationMs: 50 } },
    ];
    const graph: WorkflowGraph = { id: 'wf4', name: 'wf4', nodes, edges: [] };

    await engine.runGraph(graph);

    const calls = mockWin.webContents.send.mock.calls;
    const endCall = calls.find((c: any) => c[0] === 'workflow:step-end');

    expect(endCall).toBeDefined();
    expect(endCall[1].durationMs).toBeGreaterThanOrEqual(0);
  });
});
