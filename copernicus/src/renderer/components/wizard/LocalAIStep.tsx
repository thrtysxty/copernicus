import log from '../../utils/logger'
import React, { useState, useEffect } from 'react';
import { Zap, Check, ArrowRight, Cpu, Activity, Server } from 'lucide-react';
import { useIpcError } from '../../hooks/useIpcError';
import { unwrapIpc } from '../../types/ipc';

interface LocalAIStepProps {
  onNext: () => void;
}

export const LocalAIStep: React.FC<LocalAIStepProps> = ({ onNext }) => {
  const invoke = useIpcError();
  const [ollamaReachable, setOllamaReachable] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [isStartingBundled, setIsStartingBundled] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [activeModelName, setActiveModelName] = useState('');
  const [isCached, setIsCached] = useState(false);

  useEffect(() => {
    // Check if model is cached
    invoke('localmodel:is-cached')
      .then(raw => { setIsCached(unwrapIpc<boolean>(raw) ?? false); })
      .catch(() => {});

    // Check if Ollama is reachable
    invoke('workflow:ollama-status')
      .then(raw => {
        const status = unwrapIpc<any>(raw);
        if (status?.ok || status === true) {
          setOllamaReachable(true);
          // If reachable, fetch models
          invoke('models:list-ollama')
            .then(modelsRaw => {
              const mData = unwrapIpc<any>(modelsRaw);
              if (mData?.models?.length > 0) {
                setOllamaModels(mData.models);
                setSelectedModel(mData.models[0].id);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => setOllamaReachable(false));
  }, [invoke]);

  const handleUseBundled = async () => {
    setIsStartingBundled(true);
    try {
      const res = await invoke<any>('localmodel:start');
      if (res.ok) {
        const data = unwrapIpc<{ running: boolean, port: number | null }>(res);
        if (data?.running) {
          setActiveModelName('Gemma 4 e4b (MLX)');
          setIsConfigured(true);
        }
      }
    } catch (e) {
      log.error('Failed to start bundled model', e);
    } finally {
      setIsStartingBundled(false);
    }
  };

  const handleUseOllama = async () => {
    if (!selectedModel) return;
    try {
      // Set the active model
      await invoke('models:set-active', selectedModel);
      setActiveModelName(selectedModel);
      setIsConfigured(true);
    } catch (e) {
      log.error('Failed to set Ollama model', e);
    }
  };

  if (isConfigured) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
        <div className="w-20 h-20 bg-copernicus-phosphor/20 rounded-full flex items-center justify-center border border-copernicus-phosphor/40">
          <Check size={40} className="text-copernicus-phosphor" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">AI is ready</h2>
          <p className="text-zinc-500 uppercase tracking-[0.2em] text-[10px]">Active Model: <span className="text-copernicus-phosphor">{activeModelName}</span></p>
        </div>
        <button
          onClick={onNext}
          className="group flex items-center gap-4 bg-copernicus-phosphor text-black px-12 py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.3em] transition-all hover:scale-[1.02] hover:brightness-110 active:scale-95 shadow-xl shadow-copernicus-phosphor/20"
        >
          Continue Onboarding <ArrowRight size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto w-full py-4">
      <div className="flex flex-col gap-1 mb-4 border-l-2 border-copernicus-phosphor pl-4">
        <h2 className="text-lg font-bold text-white uppercase tracking-tight flex items-center gap-3">
          <Zap size={18} className="text-copernicus-phosphor" /> Local Intelligence Setup
        </h2>
        <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">No API keys detected. Configuring local fallback.</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Ollama card — always visible */}
        <div className="bg-black/30 border border-copernicus-steel/20 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-3">
              <Server size={18} className="text-copernicus-phosphor" />
              <span className="text-[11px] font-bold text-zinc-200 uppercase tracking-widest">External Ollama</span>
            </div>
            {ollamaReachable
              ? <span className="text-[9px] bg-green-900/30 text-green-400 px-2 py-0.5 rounded font-bold">REACHABLE</span>
              : <span className="text-[9px] bg-zinc-900/40 text-zinc-500 px-2 py-0.5 rounded font-bold">NOT DETECTED</span>
            }
          </div>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Select Model</label>
              <select
                className="w-full bg-black/60 border border-zinc-800 rounded-lg p-3 text-xs text-white outline-none focus:border-copernicus-phosphor transition-colors"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={!ollamaReachable}
              >
                {ollamaModels.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
                {ollamaModels.length === 0 && <option disabled>No models found in Ollama</option>}
              </select>
            </div>
            <button
              onClick={handleUseOllama}
              disabled={!selectedModel || !ollamaReachable}
              className="w-full bg-copernicus-phosphor text-black py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all hover:brightness-110 disabled:opacity-50"
            >
              Use Ollama
            </button>
          </div>
        </div>

        {/* MLX card — always visible */}
        <div className="bg-black/30 border border-copernicus-steel/20 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-3">
              <Cpu size={18} className="text-copernicus-phosphor" />
              <span className="text-[11px] font-bold text-zinc-200 uppercase tracking-widest">Bundled Model</span>
            </div>
            <span className="text-[9px] text-zinc-500 font-mono uppercase">Zero Dependency</span>
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-lg">
              <h4 className="text-xs font-bold text-white uppercase mb-1">Gemma 4 e4b (MLX)</h4>
              <p className="text-[10px] text-zinc-500 leading-relaxed font-mono italic">
                Google Gemma 4 (8B, 128K context). GPU-accelerated via Metal on Apple Silicon. Downloaded once, runs offline.
              </p>
            </div>
            <button
              onClick={handleUseBundled}
              disabled={isStartingBundled}
              className="w-full bg-copernicus-phosphor text-black py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all hover:brightness-110 flex items-center justify-center gap-2"
            >
              {isStartingBundled ? <Activity size={14} className="animate-spin" /> : (!isCached ? null : <PlayIcon />)}
              {isStartingBundled
                ? (isCached ? 'Starting Inference Server...' : 'Downloading model… (~9.6 GB)')
                : (isCached ? 'Start Gemma 4' : 'Download Gemma 4 e4b')}
            </button>
          </div>
        </div>

        <div className="pt-4 flex justify-center">
          <button
            onClick={onNext}
            className="text-[10px] text-zinc-500 hover:text-white uppercase tracking-[0.2em] font-bold transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
};

const PlayIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);
