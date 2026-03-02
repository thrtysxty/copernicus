import React from 'react';
import { Terminal } from './Terminal';
import { GeminiPanel } from './GeminiPanel';
import { useLayoutStore } from '../../store/layout';
import { X, Loader2 } from 'lucide-react';

interface TerminalTabsProps {
  cwd?: string;
}

export const TerminalTabs: React.FC<TerminalTabsProps> = ({ cwd }) => {
  const { terminals, activeTerminalId, setActiveTerminal, removeTerminal } = useLayoutStore();

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
            {tab.isBusy && (
              <Loader2 size={8} className="animate-spin mr-1.5 text-copernicus-phosphor" />
            )}
            <span className={tab.isBusy ? 'phosphor-glow' : ''}>
              {tab.label}
              {tab.ephemeral && (
                <span className="ml-1 text-[8px] text-zinc-600" title="Auto-closes on completion">◌</span>
              )}
            </span>

            {tab.id !== 'terminal-local' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeTerminal(tab.id);
                }}
                className="ml-2 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
              >
                <X size={10} />
              </button>
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
            {tab.id.startsWith('gemini-') ? (
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
