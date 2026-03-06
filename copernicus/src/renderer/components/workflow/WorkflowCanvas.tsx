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
  const {
    activeStoryId,
    setActiveWorkflowTemplate,
    tourStep,
    setTourStep,
    setTourHighlight,
    setHasCompletedTour,
  } = useLayoutStore();

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

  useEffect(() => {
    const removeSave = window.ipcRenderer.on('workflow:save', () => {
      saveWorkflow();
    });
    const removeReset = window.ipcRenderer.on('workflow:reset-canvas', async () => {
      await invoke('workflow:reset');
      setNodes([]);
      setEdges([]);
      setIsRunning(false);
      setActiveWorkflowTemplate(null);
    });
    const removeRun = window.ipcRenderer.on('workflow:run-canvas', () => {
      runWorkflow();
    });

    return () => {
      removeSave();
      removeReset();
      removeRun();
    };
  }, [invoke, nodes, edges, rootPath, activeStoryId]);

  return (
    <div className="flex flex-col h-full bg-[#050505] text-white overflow-hidden relative pt-1">
      {/* FIXED: Modal Centering using flex-col and absolute inset-0 */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-[100]">
          <div className="bg-zinc-900 border border-copernicus-steel rounded p-6 w-96 shadow-2xl">
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
                  className="text-left p-3 rounded bg-zinc-800 border border-transparent hover:border-copernicus-phosphor/50 hover:bg-zinc-700 transition-all group"
                >
                  <p className="text-xs font-bold text-zinc-200 group-hover:text-copernicus-phosphor transition-colors">{t.name}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{t.description}</p>
                </button>
              ))}
              <button
                onClick={() => {
                  setNodes([{ id: 'start', type: 'trigger', label: 'Start', x: 50, y: 150, data: { variant: 'manual' } }]);
                  setEdges([]);
                }}
                className="text-center p-3 mt-2 rounded border border-dashed border-zinc-700 text-zinc-600 hover:text-copernicus-phosphor hover:border-copernicus-phosphor transition-all text-xs font-mono uppercase tracking-widest"
              >
                + Empty Canvas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FIXED: Edge-to-edge layout by ensuring w-full on flex container */}
      <div className="flex flex-row flex-1 overflow-hidden w-full relative">
        {/* Palette */}
        <div className="w-40 bg-[#080808] border-r border-copernicus-steel
                        flex flex-col overflow-y-auto shrink-0 p-2 gap-3 z-20">
          <NodePaletteSection title="TRIGGERS"  nodes={PALETTE_TRIGGERS}  onDragStart={handlePaletteDragStart} />
          <NodePaletteSection title="AGENT"     nodes={PALETTE_AGENTS}    onDragStart={handlePaletteDragStart} />
          <NodePaletteSection title="TOOLS"     nodes={PALETTE_TOOLS}     onDragStart={handlePaletteDragStart} />
          <NodePaletteSection title="DECISIONS" nodes={PALETTE_DECISIONS} onDragStart={handlePaletteDragStart} />
          <NodePaletteSection title="FLOW"      nodes={PALETTE_FLOW}      onDragStart={handlePaletteDragStart} />
        </div>

        {/* SVG Canvas - Full width expansion */}
        <div className="flex-1 relative bg-black">
          <svg
            ref={svgRef}
            tabIndex={0}
            className="w-full h-full cursor-crosshair outline-none"
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
        </div>

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

      {tourStep > 0 && tourStep < 6 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50">
          <div className="bg-[#0A0A0A] border-2 border-copernicus-phosphor rounded-lg p-6 w-[400px] shadow-[0_0_40px_rgba(74,222,128,0.1)] transition-all duration-300 transform scale-100">
             {/* Animated Preview Placeholder */}
             <div className="w-full h-40 bg-black rounded border border-copernicus-steel/50 mb-6 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-copernicus-phosphor/10 to-transparent animate-pulse" />
                
                {tourStep === 1 && (
                  <div className="p-4 flex flex-col gap-3">
                     <div className="h-2 w-1/3 bg-zinc-800 rounded animate-pulse" />
                     <div className="grid grid-cols-3 gap-2">
                       <div className="h-16 bg-zinc-900 border border-copernicus-steel/20 rounded animate-pulse" />
                       <div className="h-16 bg-zinc-900 border border-copernicus-steel/20 rounded animate-pulse delay-75" />
                       <div className="h-16 bg-zinc-900 border border-copernicus-steel/20 rounded animate-pulse delay-150" />
                     </div>
                  </div>
                )}
                {tourStep === 2 && (
                   <div className="p-4 font-mono text-[9px] text-zinc-600">
                      <div className="flex gap-2 mb-1 opacity-50"><span className="text-zinc-800">1 |</span> <span className="text-blue-400">import</span> React <span className="text-blue-400">from</span> <span className="text-green-400">&apos;react&apos;</span></div>
                      <div className="flex gap-2 mb-1 animate-pulse"><span className="text-zinc-800">2 |</span> <span className="text-purple-400">export default function</span> <span className="text-yellow-400">App</span>() {'{'}</div>
                      <div className="flex gap-2 mb-1 animate-pulse delay-75"><span className="text-zinc-800">3 |</span>   <span className="text-blue-400">return</span> &lt;<span className="text-red-400">div</span>&gt;Hello World&lt;/<span className="text-red-400">div</span>&gt;</div>
                      <div className="flex gap-2 mb-1 animate-pulse delay-150"><span className="text-zinc-800">4 |</span> {'}'}</div>
                   </div>
                )}
                {tourStep === 3 && (
                   <div className="p-4 flex items-center justify-center h-full">
                      <div className="w-24 h-24 border-2 border-dashed border-copernicus-phosphor/40 rounded-full animate-[spin_10s_linear_infinite] flex items-center justify-center">
                         <div className="w-16 h-16 bg-copernicus-phosphor/20 rounded-lg animate-pulse" />
                      </div>
                   </div>
                )}
                {tourStep === 4 && (
                   <div className="p-4 flex flex-col gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded bg-zinc-800 animate-pulse" />
                        <div className="h-0.5 w-16 bg-zinc-800 animate-pulse" />
                        <div className="w-8 h-8 rounded bg-zinc-800 animate-pulse delay-150" />
                      </div>
                      <div className="flex items-center gap-4 ml-12">
                        <div className="h-0.5 w-8 bg-zinc-800 animate-pulse delay-75" />
                        <div className="w-8 h-8 rounded bg-zinc-800 animate-pulse delay-200" />
                      </div>
                   </div>
                )}
                {tourStep === 5 && (
                   <div className="p-4 grid grid-cols-2 gap-2">
                      <div className="h-10 bg-zinc-900 border border-zinc-800 rounded animate-pulse" />
                      <div className="h-10 bg-zinc-900 border border-zinc-800 rounded animate-pulse delay-75" />
                      <div className="h-10 bg-zinc-900 border border-zinc-800 rounded animate-pulse delay-150" />
                      <div className="h-10 bg-zinc-900 border border-zinc-800 rounded animate-pulse delay-200" />
                   </div>
                )}
             </div>

             <div className="flex justify-between items-end">
                <div className="space-y-1">
                   <div className="text-[10px] text-zinc-600 font-mono uppercase tracking-[0.2em] font-bold">AREA {tourStep} OF 5</div>
                   <div className="text-lg font-bold text-copernicus-phosphor uppercase tracking-widest drop-shadow-[0_0_10px_rgba(74,222,128,0.3)]">
                      {tourStep === 1 && "PLANNER"}
                      {tourStep === 2 && "EDITOR"}
                      {tourStep === 3 && "DESIGNER"}
                      {tourStep === 4 && "ORCHESTRATOR"}
                      {tourStep === 5 && "COMMAND"}
                   </div>
                </div>
                <div className="flex gap-4 items-center h-10">
                   <button
                     onClick={() => {
                        setHasCompletedTour()
                        setTourHighlight(null)
                     }}
                     className="text-[9px] text-zinc-500 hover:text-zinc-300 uppercase underline decoration-zinc-700 underline-offset-4 font-bold"
                   >
                     Skip
                   </button>
                   <button
                     onClick={() => {
                       const nextStep = tourStep + 1
                       setTourStep(nextStep)
                       if (nextStep === 2) setTourHighlight('editor')
                       else if (nextStep === 3) setTourHighlight('designer')
                       else if (nextStep === 4) setTourHighlight('orchestrator')
                       else if (nextStep === 5) setTourHighlight('reporter')
                       else if (nextStep === 6) setTourHighlight(null)
                     }}
                     className="px-6 py-2 bg-copernicus-phosphor text-[#050505] text-[10px] font-bold uppercase tracking-wider rounded-sm hover:bg-copernicus-phosphor/90 transition-all hover:scale-105 active:scale-95 shadow-[0_4px_10px_rgba(74,222,128,0.2)]"
                   >
                     Next →
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
