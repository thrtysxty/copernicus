import React, { useState, useEffect } from 'react';
import { useWorkspaceStore } from '../store/workspace';
import { useAgentStore } from '../store/agents';
import { useCapexStore } from '../store/capex';
import { SlashCommandInput } from './SlashCommandInput';

export const StatusBar: React.FC = () => {
  const { cwd, gitBranch } = useWorkspaceStore();
  const { activeAgent } = useAgentStore();
  const { sessionActive, startTime } = useCapexStore();
  const [showQuickInput, setShowQuickInput] = useState(false);
  const [elapsed, setElapsed] = useState('00:00');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setShowQuickInput(prev => !prev);
      }
      if (e.key === 'Escape') {
        setShowQuickInput(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    let interval: any;
    if (sessionActive && startTime) {
      interval = setInterval(() => {
        const seconds = Math.floor((Date.now() - startTime) / 1000);
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        setElapsed(`${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      }, 1000);
    } else {
      setElapsed('00:00');
    }
    return () => clearInterval(interval);
  }, [sessionActive, startTime]);

  return (
    <div className="h-6 bg-blue-600 text-white text-xs flex items-center px-2 space-x-4 relative">
      {showQuickInput && (
        <div className="absolute bottom-full left-0 w-full p-2 bg-gray-900 border-t border-blue-500 shadow-2xl">
          <SlashCommandInput 
            placeholder="Quick Command (Enter to execute, Esc to close)..."
            onSendMessage={() => setShowQuickInput(false)}
          />
        </div>
      )}
      <div className="font-bold flex items-center space-x-1">
        <span>ATLAS</span>
        {sessionActive && <span className="text-[10px] bg-red-500 px-1 rounded animate-pulse">REC</span>}
      </div>
      <div>{cwd}</div>
      <div className="flex items-center space-x-1 border-l border-blue-400 pl-4">
        <span className="opacity-75">Git:</span>
        <span className="font-mono">{gitBranch || 'main'}</span>
      </div>
      
      <div className="flex items-center space-x-1 border-l border-blue-400 pl-4">
        <span className="opacity-75">Session:</span>
        <span className="font-mono font-bold">{elapsed}</span>
      </div>

      <div className="flex-1 text-right">
        <span className="opacity-75 mr-2 italic">Ctrl+P for commands</span>
        Active Agent: <span className="font-bold">{activeAgent.toUpperCase()}</span>
      </div>
    </div>
  );
};
