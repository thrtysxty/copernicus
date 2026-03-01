import { useEffect, useState } from 'react';
import { useIpcError } from '../hooks/useIpcError';
import log from '../utils/logger'

interface StatusData {
    session: {
        entity: string;
        component: string;
        duration_seconds: number;
        value: number;
    } | null;
    total: number;
}

export function CapexStatus() {
  const invoke = useIpcError();
  const [status, setStatus] = useState<StatusData | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const _raw = await invoke<any>('devtime:status');
        const res: StatusData = (_raw as any)?.data ?? _raw;
        setStatus(res);
      } catch (e) {
        log.error("Failed to fetch capex status", e);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 60000); // every minute
    return () => clearInterval(interval);
  }, [invoke]);

  if (!status || !status.session) return (
    <div className="flex items-center gap-2 text-[9px] text-zinc-700 font-mono italic">
        <span>[NO_SESSION_ACTIVE]</span>
    </div>
  );

  const hours = Math.floor(status.session.duration_seconds / 3600);
  const minutes = Math.floor((status.session.duration_seconds % 3600) / 60);
  const currentTotal = status.total + status.session.value;

  return (
    <div className="flex items-center gap-4 text-[9px] text-zinc-500 border-l border-hairline border-copernicus-steel pl-4 ml-4 font-mono">
      <span className="flex items-center gap-1">
        <span className="text-zinc-600 font-bold">TIM:</span> {hours}h {minutes}m
      </span>
      <span>
        <span className="text-zinc-600 font-bold">OBJ:</span> {status.session.entity}/{status.session.component}
      </span>
      <span className="text-copernicus-phosphor">
        VAL: {currentTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
      </span>
    </div>
  );
}
