import React from 'react';
import { Terminal } from './Terminal';
import { GeminiPanel } from './GeminiPanel';
import { JulesPanel } from '../jules/JulesPanel';
import { useLayoutStore } from '../../store/layout';
import { X, Loader2, Square } from 'lucide-react';
import { useIpcError } from '../../hooks/useIpcError';
import { IpcResult } from '../../types/ipc';

interface TerminalTabsProps {
  cwd?: string;
}

export const TerminalTabs: React.FC<TerminalTabsProps> = ({ cwd }) => {
  const { terminals, activeTerminalId, setActiveTerminal, removeTerminal, setTerminalBusy } = useLayoutStore();
  const invoke = useIpcError();

  const getAgentBadge = (id: string) => {
    switch (id) {
      case 'terminal-claude': return { letter: 'C', color: 'text-[#4ADE80]' };
      case 'terminal-gemini': return { letter: 'G', color: 'text-[#60A5FA]' };
      case 'terminal-jules': return { letter: 'J', color: 'text-[#FBBF24]' };
      default: return null;
    }
  };

  const handleStopAgent = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const result = await invoke<IpcResult<void>>('terminal:stop-agent', { id });
    if (result?.ok) {
      setTerminalBusy(id, false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-copernicus-bg">
      <div className="flex border-b border-copernicus-steel h-6 overflow-x-auto no-scrollbar">
        {terminals.map((tab) => (
          <div
            key={tab.id}
            className={`
              flex items-center group px-3 text-[10px] font-mono border-r border-copernicus-steel hover:bg-copernicus-steel/20 transition-colors uppercase cursor-pointer relative
              ${activeTerminalId === tab.id ? 'text-copernicus-phosphor bg-copernicus-steel/10' : 'text-zinc-500'}
            `}
            onClick={() => setActiveTerminal(tab.id)}
          >
            {(() => {
              const badge = getAgentBadge(tab.id);
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

            <span className={tab.isBusy ? 'phosphor-glow' : ''}>
              {tab.label}
              {tab.ephemeral && (
                <span className="ml-1 text-[8px] text-zinc-600" title="Auto-closes on completion">◌</span>
              )}
            </span>

            {tab.id !== 'terminal-local' && (
              <div className="flex items-center ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {getAgentBadge(tab.id) && tab.isBusy ? (
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

            {/* Busy Pulse Indicator (under-bar) */}
            {tab.isBusy && (
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-copernicus-phosphor animate-pulse" />
            )}
          </div>
        ))}
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
