import log from '../../utils/logger'
import React, { useEffect, useState } from 'react';
import { useIpcError } from '../../hooks/useIpcError';
import { useLayoutStore } from '../../store/layout';
import { Play, Square, FileText, RefreshCw, ChevronLeft } from 'lucide-react';

export interface Container {
  ID: string;
  Names: string;
  Image: string;
  State: string;
  Status: string;
  Ports: string;
}

export const ContainerViewer: React.FC = () => {
  const [containers, setContainers] = useState<Container[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [dockerAvailable, setDockerAvailable] = useState<boolean | null>(null);
  const invoke = useIpcError();
  const toggleFlip = useLayoutStore(s => s.toggleFlip);

  const fetchContainers = async () => {
    setLoading(true);
    try {
      const res = await invoke<{ ok: boolean; data?: Container[]; error?: string }>('runtime:list-containers');
      if (res?.ok && res.data) {
        setContainers(res.data);
      }
    } catch (e) {
      log.error('Failed to fetch containers', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const init = async () => {
      try {
        const checkRes = await invoke<{ ok: boolean; data?: boolean; error?: string }>('runtime:check-docker');
        const isAvailable = checkRes?.ok && checkRes.data === true;
        setDockerAvailable(isAvailable);

        if (isAvailable) {
          fetchContainers();
          interval = setInterval(fetchContainers, 5000); // Auto-refresh every 5s
        }
      } catch (e) {
        log.error('Failed to check docker availability', e);
        setDockerAvailable(false);
      }
    };

    init();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [invoke]);

  const manageContainer = async (id: string, action: 'start' | 'stop' | 'logs') => {
    try {
      await invoke('runtime:manage-container', { id, action });
      if (action !== 'logs') {
        fetchContainers();
      }
    } catch (e) {
      log.error(`Failed to ${action} container ${id}`, e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#080808] text-zinc-300 font-mono text-xs">
      <div className="h-8 flex items-center justify-between px-3 border-b border-copernicus-steel shrink-0">
        <span className="text-[10px] text-zinc-500 uppercase tracking-widest">CONTAINERS</span>
        <div className="flex items-center gap-1">
          <button
            onClick={fetchContainers}
            className={`p-1 text-zinc-500 hover:text-copernicus-phosphor transition-colors ${loading ? 'animate-spin' : ''}`}
            title="Refresh"
          >
            <RefreshCw size={12} />
          </button>
          <button
            onClick={() => toggleFlip('sidebar')}
            className="p-1 text-zinc-500 hover:text-copernicus-phosphor transition-colors"
            title="Back to Explorer"
          >
            <ChevronLeft size={12} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {dockerAvailable === false ? (
          <div className="p-4 text-zinc-600 text-center italic">Docker not available</div>
        ) : dockerAvailable === null ? (
          <div className="p-4 text-zinc-600 text-center italic">Checking Docker...</div>
        ) : containers.length === 0 ? (
          <div className="p-4 text-zinc-600 text-center italic">No containers found</div>
        ) : (
          <ul className="flex flex-col">
            {containers.map((c) => {
              const isActive = c.ID === activeId;
              const isRunning = c.State === 'running';
              return (
                <li
                  key={c.ID}
                  onClick={() => setActiveId(c.ID)}
                  className={`flex flex-col p-3 border-b border-copernicus-steel/50 cursor-pointer transition-colors ${
                    isActive ? 'bg-copernicus-phosphor text-[#050505] rounded-none' : 'hover:bg-zinc-900/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold truncate" title={c.Names}>
                      {c.Names}
                    </span>
                    <span
                      className={`text-[9px] uppercase px-1.5 py-0.5 rounded-sm ${
                        isRunning
                          ? isActive ? 'bg-[#050505] text-copernicus-phosphor' : 'bg-green-500/20 text-green-400'
                          : isActive ? 'bg-red-900 text-red-100' : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {c.State}
                    </span>
                  </div>

                  <div className={`text-[10px] truncate mb-2 ${isActive ? 'text-[#050505]/70' : 'text-zinc-500'}`} title={c.Image}>
                    {c.Image}
                  </div>

                  <div className={`text-[9px] mb-3 ${isActive ? 'text-[#050505]/70' : 'text-zinc-600'}`}>
                    {c.Ports || 'No ports mapped'}
                  </div>

                  <div className="flex items-center gap-2 mt-auto">
                    {!isRunning ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); manageContainer(c.ID, 'start'); }}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors ${
                          isActive
                            ? 'bg-[#050505] text-copernicus-phosphor hover:bg-[#050505]/80'
                            : 'bg-zinc-800 text-zinc-300 hover:text-copernicus-phosphor hover:bg-zinc-700'
                        }`}
                      >
                        <Play size={10} /> Start
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); manageContainer(c.ID, 'stop'); }}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors ${
                          isActive
                            ? 'bg-red-900 text-red-100 hover:bg-red-800'
                            : 'bg-zinc-800 text-red-400 hover:text-red-300 hover:bg-zinc-700'
                        }`}
                      >
                        <Square size={10} /> Stop
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); manageContainer(c.ID, 'logs'); }}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors ${
                        isActive
                          ? 'bg-[#050505]/20 hover:bg-[#050505]/30'
                          : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
                      }`}
                    >
                      <FileText size={10} /> Logs
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ContainerViewer;