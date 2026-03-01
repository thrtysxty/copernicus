import React, { useState, useEffect, useRef } from 'react';
import { useIpcError } from '../../hooks/useIpcError';
import { useLayoutStore } from '../../store/layout';
import { WorkflowGraph, WFNode, WFEdge, NodeType, NodeStatus, WorkflowNodeData } from '../../../../electron/workflow/types';
import { NodeInspector } from './NodeInspector';
import log from '../../utils/logger'

const GRID_SIZE = 20;

interface PaletteTile {
  type: NodeType;
  label: string;
  defaultData: WorkflowNodeData;
  color: string;
}

const PALETTE_TRIGGERS: PaletteTile[] = [
  { type: 'trigger', label: 'Manual Start',    color: '#A78BFA',
    defaultData: { variant: 'manual' } as any },
  { type: 'trigger', label: 'Story Activated', color: '#A78BFA',
    defaultData: { variant: 'story-activated' } as any },
  { type: 'trigger', label: 'Status Change',   color: '#A78BFA',
    defaultData: { variant: 'story-status-change', expectedStatus: 'IN PROGRESS' } as any },
  { type: 'trigger', label: 'Terminal Exit',   color: '#A78BFA',
    defaultData: { variant: 'terminal-exit' } as any },
];

const PALETTE_AGENTS: PaletteTile[] = [
  { type: 'agent', label: 'Agent', color: 'var(--phosphor)',
    defaultData: {
      variant: 'agent', provider: 'anthropic',
      modelId: 'claude-3-5-sonnet-20241022', persona: 'Agent',
      systemPrompt: '', task: '', contextFiles: [], outputChannel: 'terminal',
    } as any },
];

const PALETTE_TOOLS: PaletteTile[] = [
  { type: 'tool', label: 'Shell Command',   color: '#60A5FA',
    defaultData: { variant: 'shell-command', command: '' } as any },
  { type: 'tool', label: 'Makefile Target', color: '#60A5FA',
    defaultData: { variant: 'makefile-run', command: 'test' } as any },
  { type: 'tool', label: 'File Read',       color: '#60A5FA',
    defaultData: { variant: 'file-read', filePath: '' } as any },
  { type: 'tool', label: 'File Write',      color: '#60A5FA',
    defaultData: { variant: 'file-write', filePath: '', content: '' } as any },
  { type: 'tool', label: 'Story Update',    color: '#60A5FA',
    defaultData: { variant: 'story-update', field: 'status', value: '' } as any },
  { type: 'tool', label: 'Log Event',       color: '#60A5FA',
    defaultData: { variant: 'log-event', message: '' } as any },
  { type: 'tool', label: 'Screenshot',      color: '#60A5FA',
    defaultData: { variant: 'screenshot' } as any },
  { type: 'tool', label: 'Browser',         color: '#34D399',
    defaultData: { variant: 'browser-action', action: 'screenshot' } as any },
];

const PALETTE_DECISIONS: PaletteTile[] = [
  { type: 'decision', label: 'Exit Code Gate',  color: '#FBBF24',
    defaultData: { variant: 'exit-code-gate' } as any },
  { type: 'decision', label: 'Output Match',    color: '#FBBF24',
    defaultData: { variant: 'output-match', pattern: '' } as any },
  { type: 'decision', label: 'Human Approval',  color: '#FBBF24',
    defaultData: { variant: 'human-approval' } as any },
  { type: 'decision', label: 'Status Check',    color: '#FBBF24',
    defaultData: { variant: 'story-status-check', expectedStatus: 'COMPLETE' } as any },
];

const PALETTE_FLOW: PaletteTile[] = [
  { type: 'flow', label: 'Delay', color: '#71717A',
    defaultData: { variant: 'delay', durationMs: 2000 } as any },
];

function NodePaletteSection({
  title, nodes, onDragStart
}: {
  title: string;
  nodes: PaletteTile[];
  onDragStart: (tile: PaletteTile) => void;
}) {
  return (
    <div>
      <p className="text-[8px] uppercase tracking-widest text-zinc-600 mb-1 px-1">
        {title}
      </p>
      <div className="flex flex-col gap-1">
        {nodes.map(tile => (
          <div
            key={tile.label}
            draggable
            onDragStart={() => onDragStart(tile)}
            className="px-2 py-1.5 rounded text-[10px] font-mono cursor-grab
                       select-none bg-zinc-900 border hover:bg-zinc-800 transition-colors"
            style={{ borderColor: tile.color, color: tile.color }}
          >
            {tile.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WorkflowCanvas() {
  const invoke = useIpcError();
  const { activeStoryId, setActiveWorkflowTemplate } = useLayoutStore();

  const [nodes, setNodes] = useState<WFNode[]>([]);
  const [edges, setEdges] = useState<WFEdge[]>([]);
  const [templates, setTemplates] = useState<{id:string;name:string;description:string}[]>([]);

  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [connectingNodeId, setConnectingNodeId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number, y: number } | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [rootPath, setRootPath] = useState<string>('');

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<Record<string, boolean>>({});
  const [availableModels, setAvailableModels] = useState<{id:string;name:string;provider:string}[]>([]);
  const [draggingTile, setDraggingTile] = useState<PaletteTile | null>(null);
  const [context, setContext] = useState<Record<string, string>>({});

  const svgRef = useRef<SVGSVGElement>(null);

  // Fetch root path and templates
  useEffect(() => {
    invoke<string>('app:get-root-path')
      .then((result: any) => setRootPath(result.data || result))
      .catch((err) => log.error('Failed to get root path:', err));

    invoke<{id:string;name:string;description:string}[]>('workflow:list-templates')
      .then((result: any) => setTemplates(result.data || result))
      .catch(log.error);

    invoke<any[]>('auth:status').then((result: any) => {
      const data = result.data || result;
      const active: Record<string, boolean> = {};
      if (Array.isArray(data)) {
        data.forEach((s: any) => { active[s.provider] = s.isActive; });
      }
      setAuthStatus(active);
    }).catch(log.error);

    invoke<any[]>('models:list').then((result: any) => setAvailableModels(result.data || result)).catch(log.error);
  }, [invoke]);

  // Keyboard delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
          return;
        }
        setNodes(prev => prev.filter(n => n.id !== selectedNodeId));
        setEdges(prev => prev.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId));
        setSelectedNodeId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId]);

  // Status consumption
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning) {
      interval = setInterval(async () => {
        try {
          const result = await invoke<any>('workflow:status')
          const data = result.data || result;

          if (data.state === 'COMPLETE' || data.state === 'FAILED') {
            setIsRunning(false);
          }

          setNodes(prev => prev.map(n => ({
            ...n,
            status: data.nodeStatuses[n.id]?.status || data.nodeStatuses[n.id] || 'idle',
            error: data.nodeStatuses[n.id]?.error
          })));

          if (data.context) setContext(data.context);

        } catch (e) {
          log.error("Polling error", e);
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isRunning, invoke]);

  // Real-time status updates
  useEffect(() => {
    const removeListener = (window as any).ipcRenderer.on('workflow:status-update', (_event: any, update: any) => {
      setNodes(prev => prev.map(n => {
        if (n.id === update.nodeId) {
          return { ...n, status: update.status, error: update.error };
        }
        return n;
      }));
    });
    return () => removeListener();
  }, []);

  const getSvgCoordinates = (e: React.MouseEvent | React.DragEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };

    const CTM = svg.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };

    return {
      x: (e.clientX - CTM.e) / CTM.a,
      y: (e.clientY - CTM.f) / CTM.d
    };
  };

  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setSelectedNodeId(nodeId);
    if (e.shiftKey) {
        setConnectingNodeId(nodeId);
        setDraggingNodeId(null);
        setMousePos(getSvgCoordinates(e));
    } else {
        setDraggingNodeId(nodeId);
        setConnectingNodeId(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const coords = getSvgCoordinates(e);
    setMousePos(coords);

    if (draggingNodeId) {
      setNodes(prev => prev.map(n => {
        if (n.id === draggingNodeId) {
          return {
            ...n,
            x: Math.round(coords.x / GRID_SIZE) * GRID_SIZE,
            y: Math.round(coords.y / GRID_SIZE) * GRID_SIZE
          };
        }
        return n;
      }));
    }
  };

  const handleMouseUp = () => {
    setDraggingNodeId(null);
    setConnectingNodeId(null);
    setMousePos(null);
  };

  const handleNodeMouseUp = (e: React.MouseEvent, targetId: string) => {
      e.stopPropagation();

      if (connectingNodeId) {
          if (connectingNodeId !== targetId) {
              const newEdge: WFEdge = {
                  id: `e-${Date.now()}`,
                  source: connectingNodeId,
                  target: targetId
              };
              setEdges(prev => [...prev, newEdge]);
          }
          setConnectingNodeId(null);
          setMousePos(null);
      } else {
          setDraggingNodeId(null);
      }
  };

  const handlePaletteDragStart = (tile: PaletteTile) => {
    setDraggingTile(tile);
  };

  const handleCanvasDrop = (e: React.DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (!draggingTile || !svgRef.current) return;

    const coords = getSvgCoordinates(e);
    const x = Math.round(coords.x / GRID_SIZE) * GRID_SIZE;
    const y = Math.round(coords.y / GRID_SIZE) * GRID_SIZE;

    const newNode: WFNode = {
      id: `node-${Date.now()}`,
      type: draggingTile.type,
      label: draggingTile.label,
      x,
      y,
      data: { ...draggingTile.defaultData },
    };

    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
    setDraggingTile(null);
  };

  const runWorkflow = async () => {
    setIsRunning(true);
    setNodes(prev => prev.map(n => ({ ...n, status: 'idle', error: undefined })));

    const graph: WorkflowGraph = {
      id: 'wf-1',
      name: 'Current Workflow',
      nodes,
      edges
    };

    const result = await invoke<{ ok: boolean; error?: string }>('workflow:run', graph)
    const data = (result as any).data || result;
    if (!data.ok) {
      log.error('[WorkflowCanvas] workflow:run failed:', data.error)
      setIsRunning(false)
    }
  };

  const saveWorkflow = async () => {
      if (!rootPath) return;

      const workflowData: WorkflowGraph = {
          id: 'wf-current',
          name: 'Current Workflow',
          nodes,
          edges
      };

      const sep = rootPath.includes('/') ? '/' : '/';
      const filePath = `${rootPath}${sep}workflow${sep}workflow.json`;

      try {
          const result = await invoke<any>('fs:save-file', {
              filePath,
              content: JSON.stringify(workflowData, null, 2)
          })
          const data = result.data || result;
          if (!data.ok) {
              log.error('[WorkflowCanvas] fs:save-file failed:', data.error)
          }
      } catch (err) {
          log.error("Failed to save workflow:", err);
      }
  };

  const getNodeColor = (type: NodeType) => {
    switch (type) {
      case 'agent': return `var(--phosphor)`;
      case 'tool': return '#60A5FA';
      case 'decision': return '#FBBF24';
      case 'trigger': return '#A78BFA';
      case 'flow': return '#71717A';
      default: return '#ccc';
    }
  };

  const getStatusColor = (status?: NodeStatus) => {
      switch (status) {
          case 'running': return '#3B82F6';
          case 'completed': return '#10B981';
          case 'failed':
          case 'error': return '#EF4444';
          case 'skipped': return '#71717A';
          default: return 'transparent';
      }
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] text-white overflow-hidden relative">
      {/* Fixed Toolbar AC-6 */}
      <div className="flex-none px-4 py-2 border-b border-copernicus-steel bg-zinc-950 flex items-center justify-between z-30">
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Workflow Studio</span>
          <div className="px-2 py-0.5 border border-copernicus-steel rounded text-[9px] font-mono uppercase tracking-widest">
            <span className={activeStoryId ? 'text-copernicus-phosphor' : 'text-zinc-600'}>
              {activeStoryId ? `BOUND TO: ${activeStoryId}` : 'NO STORY SELECTED'}
            </span>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
              onClick={saveWorkflow}
              className="px-3 py-1 rounded font-mono text-[10px] font-bold uppercase tracking-wider bg-zinc-900 text-zinc-400 border border-copernicus-steel hover:bg-zinc-800 transition-colors"
          >
              Save
          </button>
          <button
            onClick={async () => {
              await invoke('workflow:reset');
              setNodes([]);
              setEdges([]);
              setIsRunning(false);
              setActiveWorkflowTemplate(null);
            }}
            className="px-3 py-1 rounded font-mono text-[10px] font-bold uppercase tracking-wider bg-zinc-900 text-zinc-400 border border-copernicus-steel hover:bg-zinc-800 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={runWorkflow}
            disabled={isRunning}
            className={`px-3 py-1 rounded font-mono text-[10px] font-bold uppercase tracking-wider
              ${isRunning ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed' : 'bg-copernicus-phosphor/20 text-copernicus-phosphor border border-copernicus-phosphor/40 hover:bg-copernicus-phosphor/30'}
              transition-colors`}
          >
            {isRunning ? 'Running...' : 'Run Workflow'}
          </button>
        </div>
      </div>

      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
          <div className="bg-zinc-900 border border-copernicus-steel rounded p-6 w-96">
            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-4">
              Choose a template
            </p>
            <div className="flex flex-col gap-2">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={async () => {
                    const tplResult = await invoke<any>('workflow:get-template', t.id);
                    const tpl = tplResult.data || tplResult;
                    if (tpl.graph) {
                      setNodes(tpl.graph.nodes);
                      setEdges(tpl.graph.edges);
                      setActiveWorkflowTemplate(t.id);
                      if (activeStoryId) {
                        setNodes(prev => prev.map(n =>
                          n.type === 'trigger'
                            ? { ...n, data: { ...n.data, storyId: activeStoryId } }
                            : n
                        ));
                      }
                    }
                  }}
                  className="text-left p-3 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors"
                >
                  <p className="text-xs font-bold text-zinc-200">{t.name}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{t.description}</p>
                </button>
              ))}
              <button
                onClick={() => {
                  setNodes([{ id: 'start', type: 'trigger', label: 'Start', x: 50, y: 150, data: { variant: 'manual' } }]);
                  setEdges([]);
                }}
                className="text-left p-3 rounded border border-dashed border-zinc-700 text-zinc-600 hover:text-zinc-400 text-xs"
              >
                Empty Canvas
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-row flex-1 overflow-hidden">
        {/* Palette */}
        <div className="w-40 bg-[#080808] border-r border-copernicus-steel
                        flex flex-col overflow-y-auto shrink-0 p-2 gap-3">
          <NodePaletteSection title="TRIGGERS"  nodes={PALETTE_TRIGGERS}  onDragStart={handlePaletteDragStart} />
          <NodePaletteSection title="AGENT"     nodes={PALETTE_AGENTS}    onDragStart={handlePaletteDragStart} />
          <NodePaletteSection title="TOOLS"     nodes={PALETTE_TOOLS}     onDragStart={handlePaletteDragStart} />
          <NodePaletteSection title="DECISIONS" nodes={PALETTE_DECISIONS} onDragStart={handlePaletteDragStart} />
          <NodePaletteSection title="FLOW"      nodes={PALETTE_FLOW}      onDragStart={handlePaletteDragStart} />
        </div>

        {/* SVG Canvas */}
        <svg
          ref={svgRef}
          tabIndex={0}
          className="flex-1 h-full cursor-crosshair outline-none"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={() => setSelectedNodeId(null)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleCanvasDrop}
        >
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#3F3F46" />
            </marker>
          </defs>

          {/* Grid */}
          <pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
            <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="#111" strokeWidth="0.5" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Edges */}
          {edges.map(edge => {
            const source = nodes.find(n => n.id === edge.source);
            const target = nodes.find(n => n.id === edge.target);
            if (!source || !target) return null;

            return (
              <g key={edge.id}>
                  <line
                  x1={source.x + 60} y1={source.y + 20}
                  x2={target.x + 60} y2={target.y + 20}
                  stroke="#3F3F46"
                  strokeWidth="2"
                  markerEnd="url(#arrowhead)"
                  />
                  {edge.label && (
                      <text
                          x={(source.x + target.x + 120) / 2}
                          y={(source.y + target.y + 40) / 2 - 5}
                          fill="#52525b"
                          fontSize="10"
                          textAnchor="middle"
                          fontFamily="monospace"
                      >
                          {edge.label}
                      </text>
                  )}
              </g>
            );
          })}

          {/* Connection Line */}
          {connectingNodeId && mousePos && (
              <line
                  x1={nodes.find(n => n.id === connectingNodeId)!.x + 60}
                  y1={nodes.find(n => n.id === connectingNodeId)!.y + 20}
                  x2={mousePos.x}
                  y2={mousePos.y}
                  stroke="#3F3F46"
                  strokeWidth="1"
                  strokeDasharray="5,5"
              />
          )}

          {/* Nodes */}
          {nodes.map(node => {
            const isError = node.status === 'error' || node.status === 'failed';
            const errorMsg = (node as any).error || context[node.id];

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseDown={(e) => handleMouseDown(e, node.id)}
                onMouseUp={(e) => handleNodeMouseUp(e, node.id)}
                className="cursor-pointer select-none"
              >
                {isError && (
                  <title>{errorMsg ?? 'Execution failed'}</title>
                )}
                {/* Selected State */}
                {node.id === selectedNodeId && (
                  <rect
                    x="-6" y="-6" width="132" height="52"
                    rx="6" ry="6"
                    fill="none"
                    stroke="white"
                    strokeWidth={1}
                    strokeDasharray="4,3"
                    opacity={0.4}
                  />
                )}

                {/* Status Halo */}
                {node.status && node.status !== 'idle' && (
                    <rect
                        x="-4" y="-4" width="128" height="48"
                        rx="6" ry="6"
                        fill="none"
                        stroke={getStatusColor(node.status)}
                        strokeWidth={2}
                        className={node.status === 'running' ? "animate-pulse" : ""}
                    />
                )}

                {/* Node Body */}
                <rect
                  width="120" height="40"
                  rx="4" ry="4"
                  fill="#0A0A0A"
                  stroke={isError ? '#EF4444' : getNodeColor(node.type)}
                  strokeWidth={node.type === 'agent' ? 2 : 1}
                />

                {/* Label */}
                <text
                  x="60" y={isError ? 20 : 24}
                  textAnchor="middle"
                  fill="#d4d4d8"
                  fontSize="11"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {node.label}
                </text>

                {/* Error Label */}
                {isError && errorMsg && (
                  <text
                    x="60" y="32"
                    textAnchor="middle"
                    fill="#F87171"
                    fontSize="7"
                    fontFamily="monospace"
                  >
                    ⚠ {errorMsg.slice(0, 20)}...
                  </text>
                )}

                {/* Type Indicator */}
                <text
                    x="60" y="-8"
                    textAnchor="middle"
                    fill="#52525b"
                    fontSize="8"
                    fontFamily="monospace"
                    className="uppercase font-bold tracking-widest"
                >
                    {node.type}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Inspector */}
        {selectedNodeId && (() => {
          const node = nodes.find(n => n.id === selectedNodeId);
          if (!node) return null;
          return (
            <NodeInspector
              node={node}
              authStatus={authStatus}
              availableModels={availableModels}
              onChange={(updated) =>
                setNodes(prev => prev.map(n => n.id === updated.id ? updated : n))
              }
              onClose={() => setSelectedNodeId(null)}
              onDelete={() => {
                setNodes(prev => prev.filter(n => n.id !== selectedNodeId));
                setEdges(prev => prev.filter(e =>
                  e.source !== selectedNodeId && e.target !== selectedNodeId
                ));
                setSelectedNodeId(null);
              }}
              invoke={invoke}
            />
          );
        })()}
      </div>

      <div className="absolute bottom-4 left-44 text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
        Shift+Drag to connect • Drag to move
      </div>
    </div>
  );
}
