import React from 'react';
import { Terminal } from './Terminal';
import { GeminiPanel } from './GeminiPanel';
import { JulesPanel } from '../jules/JulesPanel';
import { useLayoutStore } from '../../store/layout';
import { X, Loader2, Square, Plus, RotateCcw, Maximize2, ChevronDown } from 'lucide-react';
import { useIpcError } from '../../hooks/useIpcError';
import { IpcResult } from '../../types/ipc';

interface TerminalTabsProps {
  cwd?: string;
}

export const TerminalTabs: React.FC<TerminalTabsProps> = ({ cwd }) => {
  const { terminals, activeTerminalId, setActiveTerminal, removeTerminal, setTerminalBusy, addTerminal } = useLayoutStore();
  const setSpotlight = useLayoutStore(s => s.setSpotlight);
  const spotlightPane = useLayoutStore(s => s.spotlightPane);
  const setTerminalOpen = useLayoutStore(s => s.setTerminalOpen);
  const toggleArchive = useLayoutStore(s => s.toggleArchive);
  const invoke = useIpcError();

  const activeTerminal = terminals.find((t) => t.id === activeTerminalId);
  const activeCwd = activeTerminal?.cwd || cwd || 'Unknown Workspace';

  const formatCwd = (pathStr: string) => {
    // Truncate to the last 2 path segments
    const segments = pathStr.split('/').filter(Boolean);
    if (segments.length <= 2) return pathStr;
    return `.../${segments.slice(-2).join('/')}`;
  };

  const getAgentBadge = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes('claude')) return { letter: 'C', color: 'text-[#4ADE80]' };
    if (l.includes('gemini')) return { letter: 'G', color: 'text-[#60A5FA]' };
    if (l.includes('jules')) return { letter: 'J', color: 'text-[#FBBF24]' };
    if (l.includes('ollama')) return { letter: 'O', color: 'text-orange-400' };
    return null;
  };

  const handleStopAgent = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const result = await invoke<IpcResult<void>>('terminal:stop-agent', { id });
    if (result?.ok) {
      setTerminalBusy(id, false);
    }
  };

  const handleNewTerminal = () => {
    const id = `terminal-${Date.now()}`;
    addTerminal(id, 'Bash');
  };

  return (
    <div className="flex flex-col h-full bg-copernicus-bg min-w-0 overflow-hidden">
      {/* Standard h-8 Header */}
      <div className="flex border-t border-zinc-700 border-b border-copernicus-steel h-8 bg-[#050505] items-center shrink-0">
        <div className="flex-grow flex overflow-x-auto no-scrollbar h-8">
          {terminals.map((tab) => (
            <div
              key={tab.id}
              className={`
                flex items-center group px-3 text-[10px] font-mono border-r border-copernicus-steel hover:bg-copernicus-steel/20 transition-colors uppercase cursor-pointer relative min-w-[100px] h-8
                ${activeTerminalId === tab.id ? 'text-copernicus-phosphor bg-copernicus-steel/10' : 'text-zinc-500'}
              `}
              onClick={() => setActiveTerminal(tab.id)}
            >
              {(() => {
                const badge = getAgentBadge(tab.label);
                if (badge) {
                  return (
                    <span className={`mr-1.5 font-bold ${badge.color} ${tab.isBusy ? 'animate-pulse' : ''}`}>
                      {badge.letter}
                    </span>
                  );
                }
                if (tab.isBusy) {
                  return <Loader2 size={8} className="animate-spin mr-1.5 text-copernicus-phosphor" />;
                }
                return null;
              })()}

              <span className={`truncate ${tab.isBusy ? 'phosphor-glow font-bold' : ''}`}>
                {tab.label}
                {tab.ephemeral && (
                  <span className="ml-1 text-[8px] text-zinc-600" title="Auto-closes on completion">◌</span>
                )}
              </span>

              {terminals.length > 1 && (
                <div className="flex items-center ml-auto opacity-0 group-hover:opacity-100 transition-opacity pl-2">
                  {getAgentBadge(tab.label) && tab.isBusy ? (
                    <button
                      onClick={(e) => handleStopAgent(e, tab.id)}
                      className="hover:text-red-400 transition-colors mr-1"
                      title="Stop Agent"
                    >
                      <Square size={10} fill="currentColor" />
                    </button>
                  ) : null}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTerminal(tab.id);
                    }}
                    className="hover:text-red-400 transition-colors"
                  >
                    <X size={10} />
                  </button>
                </div>
              )}
            </div>
          ))}
          
          <button 
            onClick={handleNewTerminal}
            className="px-3 h-8 flex items-center justify-center text-zinc-600 hover:text-copernicus-phosphor transition-colors border-r border-copernicus-steel bg-[#080808] shrink-0"
            title="New Terminal Session"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Panel Controls & CWD */}
        <div className="flex items-center gap-2 px-3 shrink-0">
          <div
            className="text-[10px] font-mono text-zinc-500 mr-2 cursor-help hidden sm:block"
            title={activeCwd}
          >
            {formatCwd(activeCwd)}
          </div>
          <div className="h-4 w-px bg-copernicus-steel/50 mx-1 hidden sm:block"></div>
          <button
            data-testid="terminal-flip-btn"
            onClick={() => toggleArchive()}
            className="text-zinc-600 hover:text-zinc-300 transition-colors opacity-60 hover:opacity-100"
            title="View Archive"
          >
            <RotateCcw size={12} />
          </button>
          <button
            data-testid="terminal-spotlight-btn"
            onClick={() => setSpotlight(spotlightPane === 'terminal' ? null : 'terminal')}
            className="text-zinc-600 hover:text-zinc-300 transition-colors opacity-60 hover:opacity-100"
            title="Spotlight"
          >
            <Maximize2 size={12} />
          </button>
          <button
            data-testid="terminal-collapse-btn"
            onClick={() => setTerminalOpen(false)}
            className="text-zinc-600 hover:text-zinc-300 transition-colors opacity-60 hover:opacity-100"
            title="Collapse panel"
          >
            <ChevronDown size={12} />
          </button>
        </div>
      </div>
      <div className="flex-grow relative overflow-hidden">
        {terminals.map((tab) => (
          <div
            key={tab.id}
            className={`absolute inset-0 ${activeTerminalId === tab.id ? 'z-10 visible' : 'z-0 invisible'}`}
          >
            {tab.id === 'terminal-jules' ? (
              <JulesPanel />
            ) : tab.id.startsWith('gemini-') ? (
              <GeminiPanel sessionId={tab.id.slice('gemini-'.length)} />
            ) : (
              <Terminal id={tab.id} active={activeTerminalId === tab.id} cwd={cwd} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
