import React, { useState, useEffect } from 'react';
import { useIpcError } from '../../../hooks/useIpcError';
import { useToastStore } from '../../../store/toastStore';
import { Zap, Play, Square, Cpu, Activity } from 'lucide-react';
import log from '../../../utils/logger';
import { unwrapIpc } from '../../../types/ipc';
import { MLXProviderPanel } from '../../providers/MLXProviderPanel';

export const LocalModelSection: React.FC = () => {
  const invoke = useIpcError();
  const addToast = useToastStore(s => s.addToast);
  
  const [status, setStatus] = useState<{ running: boolean, port: number | null }>({
    running: false,
    port: null
  });
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      const result = await invoke<any>('localmodel:status');
      if (result.ok) {
        const data = unwrapIpc<{ running: boolean, port: number | null }>(result);
        if (data) setStatus(data);
      }
    } catch (e) {
      log.error('Failed to fetch local model status', e);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [invoke]);

  const handleStart = async () => {
    setLoading(true);
    try {
      const result = await invoke<any>('localmodel:start');
      if (result.ok) {
        const data = unwrapIpc<{ running: boolean, port: number | null }>(result);
        if (data) {
          setStatus(data);
          if (data.running) {
            addToast('Local model server started successfully', 'success');
          } else {
            addToast('Local model failed to start. Ensure Python and mlx_lm are installed (pip install mlx_lm).', 'error');
          }
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      addToast(`Start failed: ${message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      const result = await invoke<any>('localmodel:stop');
      if (result.ok) {
        const data = unwrapIpc<{ running: boolean, port: number | null }>(result);
        if (data) {
          setStatus(data);
          addToast('Local model server stopped', 'info');
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      addToast(`Stop failed: ${message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-widest font-mono">Local AI</h2>
        <p className="text-[10px] text-zinc-500 font-mono mt-1">Manage bundled inference for zero-dependency AI features.</p>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-zinc-400">
          <Cpu size={14} />
          <h3 className="text-[10px] uppercase font-bold tracking-wider">Bundled Model</h3>
        </div>
        
        <div className="bg-[#0F0F0F] border border-zinc-800 rounded-lg overflow-hidden">
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded bg-zinc-900 ${status.running ? 'text-copernicus-phosphor' : 'text-zinc-600'}`}>
                <Zap size={20} className={status.running ? 'animate-pulse' : ''} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-tight">Gemma 4 e4b (MLX)</h4>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${status.running ? 'bg-copernicus-phosphor shadow-[0_0_5px_rgba(74,222,128,0.5)]' : 'bg-red-500'}`} />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                    {status.running ? `Running on port ${status.port}` : 'Stopped'}
                  </span>
                </div>
              </div>
            </div>

            <button 
              onClick={status.running ? handleStop : handleStart}
              disabled={loading}
              className={`px-6 py-2 rounded text-[10px] font-bold uppercase transition-all flex items-center gap-2 border ${
                status.running 
                  ? 'bg-red-950/20 border-red-900/30 text-red-400 hover:bg-red-900/30' 
                  : 'bg-copernicus-phosphor text-[#050505] rounded-none hover:brightness-110 border-copernicus-phosphor/30'
              } disabled:opacity-50`}
            >
              {loading ? (
                <Activity size={12} className="animate-spin" />
              ) : (
                status.running ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />
              )}
              {loading ? 'Processing...' : (status.running ? 'Stop Server' : 'Start Server')}
            </button>
          </div>

          <div className="px-6 py-3 bg-zinc-900/30 border-t border-zinc-800/50">
            <p className="text-[9px] text-zinc-500 font-mono italic leading-relaxed">
              Google Gemma 4 (8B, 128K context). GPU-accelerated via Metal on Apple Silicon. Downloaded once, runs offline.
            </p>
          </div>
        </div>
      </section>

      {/* MLX Native Inference — renders only on Apple Silicon, returns null otherwise */}
      <MLXProviderPanel />
    </div>
  );
};
