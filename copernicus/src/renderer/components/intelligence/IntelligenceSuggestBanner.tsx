import log from '../../utils/logger'
import React, { useState } from 'react';
import { Bot, Plus, X, ShieldAlert, FileText, Wrench, Terminal, Sparkles } from 'lucide-react';
import { IntelligenceDocSuggestion, IntelligenceDocType, IntelligenceDocument } from '../../../../electron/intelligence/types';
import { useIpcError } from '../../hooks/useIpcError';
import { unwrapIpc } from '../../types/ipc';

interface IntelligenceSuggestBannerProps {
  suggestions: IntelligenceDocSuggestion[];
  onComplete: (createdDocs: IntelligenceDocument[]) => void;
  onDismiss: () => void;
}

const TYPE_COLORS: Record<IntelligenceDocType, { bg: string, text: string, icon: React.ReactNode }> = {
  instruction: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', icon: <FileText size={12} /> },
  rule: { bg: 'bg-violet-500/20', text: 'text-violet-400', icon: <ShieldAlert size={12} /> },
  agent: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', icon: <Bot size={12} /> },
  skill: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', icon: <Wrench size={12} /> },
  command: { bg: 'bg-amber-500/20', text: 'text-amber-400', icon: <Terminal size={12} /> }
};

export const IntelligenceSuggestBanner: React.FC<IntelligenceSuggestBannerProps> = ({ suggestions, onComplete, onDismiss }) => {
  const invoke = useIpcError();
  const [activeSuggestions, setActiveSuggestions] = useState<IntelligenceDocSuggestion[]>(suggestions);
  const [isProcessing, setIsProcessing] = useState(false);
  const [createdDocs, setCreatedDocs] = useState<IntelligenceDocument[]>([]);

  const handleSkip = (id: string) => {
    const remaining = activeSuggestions.filter(s => s.id !== id);
    setActiveSuggestions(remaining);
    if (remaining.length === 0) {
      onComplete(createdDocs);
    }
  };

  const handleCreate = async (suggestion: IntelligenceDocSuggestion) => {
    setIsProcessing(true);
    try {
      const payload = {
        projectId: 'current',
        type: suggestion.type,
        title: suggestion.title,
        description: suggestion.description,
        content: suggestion.content,
        providers: []
      };
      const res = await invoke<IpcResult<IntelligenceDocument>>('intel:create', payload);
      const newDoc = unwrapIpc<IntelligenceDocument>(res);
      
      if (newDoc) {
        const newCreated = [...createdDocs, newDoc];
        setCreatedDocs(newCreated);
        
        const remaining = activeSuggestions.filter(s => s.id !== suggestion.id);
        setActiveSuggestions(remaining);
        
        if (remaining.length === 0) {
          onComplete(newCreated);
        }
      }
    } catch (e) {
      log.error('Failed to create doc from suggestion', e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateAll = async () => {
    setIsProcessing(true);
    const newCreated = [...createdDocs];
    try {
      for (const suggestion of activeSuggestions) {
        const payload = {
          projectId: 'current',
          type: suggestion.type,
          title: suggestion.title,
          description: suggestion.description,
          content: suggestion.content,
          providers: []
        };
        const res = await invoke<IpcResult<IntelligenceDocument>>('intel:create', payload);
        const newDoc = unwrapIpc<IntelligenceDocument>(res);
        if (newDoc) {
          newCreated.push(newDoc);
        }
      }
      setActiveSuggestions([]);
      onComplete(newCreated);
    } catch (e) {
      log.error('Failed to create all docs', e);
    } finally {
      setIsProcessing(false);
    }
  };

  if (activeSuggestions.length === 0) return null;

  return (
    <div className="m-4 bg-zinc-900 border border-copernicus-phosphor/30 rounded-lg p-4 relative overflow-hidden shrink-0">
      <div className="absolute top-0 right-0 p-2">
        <button onClick={onDismiss} className="text-zinc-500 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={16} className="text-copernicus-phosphor" />
        <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-widest">Stack Detected: Suggested Intelligence</h3>
      </div>
      
      <p className="text-xs text-zinc-400 mb-4 max-w-2xl">
        Copernicus analyzed your project files and detected your tech stack. We recommend creating these starting rules and conventions to align agents with your codebase.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {activeSuggestions.map(suggestion => (
          <div key={suggestion.id} className="bg-black/50 border border-white/5 rounded p-3 flex flex-col">
            <div className="flex items-start gap-2 mb-2">
              <div className={`mt-0.5 p-1 rounded ${TYPE_COLORS[suggestion.type].bg} ${TYPE_COLORS[suggestion.type].text}`}>
                {TYPE_COLORS[suggestion.type].icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-zinc-200 truncate">{suggestion.title}</div>
                <div className="text-[11px] text-zinc-500 truncate">{suggestion.description}</div>
              </div>
            </div>
            <div className="text-[11px] text-zinc-400 mb-3 bg-zinc-950 p-2 rounded flex-1">
              <span className="font-bold uppercase tracking-wider text-zinc-600 mr-1">Rationale:</span>
              {suggestion.rationale}
            </div>
            <div className="flex justify-end gap-2 mt-auto">
              <button 
                onClick={() => handleSkip(suggestion.id)}
                disabled={isProcessing}
                className="text-[11px] text-zinc-500 hover:text-zinc-300 font-bold uppercase tracking-wider px-2 py-1 transition-colors disabled:opacity-50"
              >
                Skip
              </button>
              <button 
                onClick={() => handleCreate(suggestion)}
                disabled={isProcessing}
                className="text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1 rounded font-bold uppercase tracking-wider transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                <Plus size={10} /> Create
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-2 border-t border-white/5">
        <button
          onClick={handleCreateAll}
          disabled={isProcessing}
          className="text-[11px] bg-copernicus-phosphor hover:brightness-110 text-[#050505] px-4 py-1.5 rounded-sm font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all disabled:opacity-50"
        >
          <Sparkles size={12} /> Create All Suggestions
        </button>
      </div>
    </div>
  );
};
