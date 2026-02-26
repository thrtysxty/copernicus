import React, { useState, useEffect, useRef } from 'react';
import { useIpcError } from '../../hooks/useIpcError';
import { WorkflowGraph, WFNode, WFEdge, NodeType, NodeStatus } from '../../../../electron/workflow/types';

const GRID_SIZE = 20;

const INITIAL_NODES: WFNode[] = [
  { id: 'start', type: 'trigger', label: 'On Story Open', x: 50, y: 100, data: {} },
  { id: 'architect', type: 'agent', label: 'Architect (Claude)', x: 250, y: 100, data: { agent: 'claude' } },
  { id: 'impl', type: 'agent', label: 'Implementer (Jules)', x: 500, y: 100, data: { agent: 'jules' } },
  { id: 'test', type: 'tool', label: 'Run Tests', x: 750, y: 100, data: { command: 'npm test' } },
  { id: 'decision', type: 'decision', label: 'Tests Pass?', x: 950, y: 100, data: {} },
  { id: 'commit', type: 'tool', label: 'Commit', x: 1150, y: 50, data: { command: 'git commit' } },
  { id: 'review', type: 'agent', label: 'Reviewer (Gemini)', x: 1150, y: 150, data: { agent: 'gemini' } },
];

const INITIAL_EDGES: WFEdge[] = [
  { id: 'e1', source: 'start', target: 'architect' },
  { id: 'e2', source: 'architect', target: 'impl' },
  { id: 'e3', source: 'impl', target: 'test' },
  { id: 'e4', source: 'test', target: 'decision' },
  { id: 'e5', source: 'decision', target: 'commit', label: 'Yes' },
  { id: 'e6', source: 'decision', target: 'review', label: 'No' },
];

export default function WorkflowCanvas() {
  const invoke = useIpcError();
  
  const [nodes, setNodes] = useState<WFNode[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<WFEdge[]>(INITIAL_EDGES);
  
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [connectingNodeId, setConnectingNodeId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number, y: number } | null>(null);
  
  const [isRunning, setIsRunning] = useState(false);
  const [rootPath, setRootPath] = useState<string>('');
  
  const svgRef = useRef<SVGSVGElement>(null);

  // Fetch root path
  useEffect(() => {
    invoke<string>('app:get-root-path')
      .then((rp) => setRootPath(rp))
      .catch((err) => console.error('Failed to get root path:', err));
  }, [invoke]);

  // Poll for status
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning) {
      interval = setInterval(async () => {
        try {
          const result = await invoke<{ state: string; nodeStatuses: Record<string, NodeStatus> }>('workflow:status')
          
          if (result.state === 'COMPLETE' || result.state === 'FAILED') {
            setIsRunning(false);
          }
          
          setNodes(prev => prev.map(n => ({
            ...n,
            status: result.nodeStatuses[n.id] || 'idle'
          })));
          
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [isRunning, invoke]);

  const getSvgCoordinates = (e: React.MouseEvent) => {
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

  const runWorkflow = async () => {
    setIsRunning(true);
    setNodes(prev => prev.map(n => ({ ...n, status: 'idle' })));
    
    const graph: WorkflowGraph = {
      id: 'wf-1',
      name: 'Current Workflow',
      nodes,
      edges
    };
    
    await invoke('workflow:run', graph);
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
          await invoke('fs:save-file', {
              filePath,
              content: JSON.stringify(workflowData, null, 2)
          });
      } catch (err) {
          console.error("Failed to save workflow:", err);
      }
  };

  const getNodeColor = (type: NodeType) => {
    switch (type) {
      case 'agent': return `var(--phosphor)`; 
      case 'tool': return '#60A5FA';
      case 'decision': return '#FBBF24';
      case 'trigger': return '#A78BFA';
      default: return '#ccc';
    }
  };
  
  const getStatusColor = (status?: NodeStatus) => {
      switch (status) {
          case 'running': return '#3B82F6';
          case 'completed': return '#10B981';
          case 'failed': return '#EF4444';
          default: return 'transparent';
      }
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] text-white overflow-hidden relative">
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button 
            onClick={saveWorkflow}
            className="px-4 py-2 rounded font-mono text-xs font-bold uppercase tracking-wider bg-zinc-900 text-zinc-400 border border-copernicus-steel hover:bg-zinc-800 transition-colors"
        >
            Save
        </button>
        <button 
          onClick={runWorkflow}
          disabled={isRunning}
          className={`px-4 py-2 rounded font-mono text-xs font-bold uppercase tracking-wider
            ${isRunning ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed' : 'bg-copernicus-phosphor/20 text-copernicus-phosphor border border-copernicus-phosphor/40 hover:bg-copernicus-phosphor/30'}
            transition-colors`}
        >
          {isRunning ? 'Running...' : 'Run Workflow'}
        </button>
      </div>

      <svg 
        ref={svgRef}
        className="flex-1 w-full h-full cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
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
        {nodes.map(node => (
          <g 
            key={node.id} 
            transform={`translate(${node.x}, ${node.y})`}
            onMouseDown={(e) => handleMouseDown(e, node.id)}
            onMouseUp={(e) => handleNodeMouseUp(e, node.id)}
            className="cursor-pointer select-none"
          >
            {/* Status Halo */}
            {node.status && node.status !== 'idle' && (
                <rect
                    x="-4" y="-4" width="128" height="48"
                    rx="6" ry="6"
                    fill="none"
                    stroke={getStatusColor(node.status)}
                    strokeWidth={2}
                    className="animate-pulse"
                />
            )}
            
            {/* Node Body */}
            <rect 
              width="120" height="40" 
              rx="4" ry="4"
              fill="#0A0A0A"
              stroke={getNodeColor(node.type)}
              strokeWidth={node.type === 'agent' ? 2 : 1}
            />
            
            {/* Label */}
            <text 
              x="60" y="24" 
              textAnchor="middle" 
              fill="#d4d4d8" 
              fontSize="11" 
              fontFamily="monospace"
              fontWeight="bold"
            >
              {node.label}
            </text>
            
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
        ))}
      </svg>
      
      <div className="absolute bottom-4 left-4 text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
        Shift+Drag to connect • Drag to move
      </div>
    </div>
  );
}
