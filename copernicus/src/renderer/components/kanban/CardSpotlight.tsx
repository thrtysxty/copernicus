import log from '../../utils/logger'
import React, { useEffect, useState } from 'react';
import { useIpcError } from '../../hooks/useIpcError';
import { unwrapIpc } from '../../types/ipc';
import { Check, X, CircleSlash } from 'lucide-react';

interface CardSpotlightProps {
  promptId?: string;
}

export const CardSpotlight: React.FC<CardSpotlightProps> = ({ promptId }) => {
  const invoke = useIpcError();
  const [stats, setStats] = useState({ accept: 0, reject: 0, abort: 0 });

  useEffect(() => {
    if (!promptId) return;

    let isMounted = true;

    const fetchStats = async () => {
      try {
        const result = await invoke<any>('db:get-edit-decisions', { promptId });
        if (result.ok) {
          const data = unwrapIpc<{ accept: number, reject: number, abort: number }>(result);
          if (isMounted && data) {
            setStats(data);
          }
        }
      } catch (err) {
        log.error('Failed to fetch edit decisions:', err);
      }
    };

    fetchStats();

    return () => {
      isMounted = false;
    };
  }, [promptId, invoke]);

  const hasStats = stats.accept > 0 || stats.reject > 0 || stats.abort > 0;

  if (!promptId || !hasStats) {
    return null;
  }

  return (
    <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2">
      {stats.accept > 0 && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-green-500/10 text-green-400 border border-green-500/20">
          <Check size={10} /> {stats.accept} accepted
        </span>
      )}
      {stats.reject > 0 && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <X size={10} /> {stats.reject} rejected
        </span>
      )}
      {stats.abort > 0 && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
          <CircleSlash size={10} /> {stats.abort} aborted
        </span>
      )}
    </div>
  );
};
