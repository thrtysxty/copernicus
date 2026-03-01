import { useEffect, useState } from 'react';
import { useIpcError } from '../hooks/useIpcError';

export function CapexSidebar() {
  const invoke = useIpcError();
  const [report, setReport] = useState<any[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const _raw = await invoke<any>('devtime:report', month);
        const r: any = _raw;
        setReport(Array.isArray(r?.data) ? r.data : Array.isArray(r) ? r : []);
      } catch (e) {
        console.error("Failed to fetch report", e);
      }
    };
    fetchReport();
  }, [month]);

  const totalValue = report.reduce((sum, s) => sum + (s.capitalizable ? s.value : 0), 0);

  return (
    <div className="flex flex-col h-full bg-copernicus-bg text-zinc-400 p-2 text-xs font-mono">
        <div className="mb-4 border-b border-copernicus-steel pb-2">
            <h3 className="text-[10px] uppercase text-copernicus-phosphor tracking-widest mb-2 font-bold italic">CapEx_Analytics</h3>
            <div className="flex justify-between items-center mb-2">
                <input
                    type="month"
                    value={month}
                    onChange={e => setMonth(e.target.value)}
                    className="bg-[#080808] border border-zinc-800 text-zinc-300 p-1 text-[10px] focus:border-copernicus-phosphor focus:outline-none"
                />
                <span className="text-copernicus-phosphor font-bold">${totalValue.toFixed(2)}</span>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-copernicus-steel">
            {report.map(session => (
                <div key={session.id} className="p-2 border border-zinc-800 bg-[#080808] transition-colors hover:border-copernicus-phosphor/30">
                    <div className="flex justify-between mb-1">
                        <span className="text-zinc-300 text-[10px]">{session.start_time.slice(0, 10)}</span>
                        <span className="text-zinc-600 text-[9px]">{new Date(session.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-zinc-500">{session.component}</span>
                        <span className={session.capitalizable ? 'text-copernicus-phosphor' : 'text-zinc-600'}>
                             {session.capitalizable ? 'CAP' : 'EXP'}
                        </span>
                    </div>
                    <div className="text-[10px] text-zinc-500 truncate italic">{session.description || 'No description'}</div>
                     <div className="text-[10px] text-right font-mono text-copernicus-phosphor/80 mt-1">
                        +${session.value.toFixed(2)}
                    </div>
                </div>
            ))}
            {report.length === 0 && (
                <div className="text-center py-8 text-zinc-700 italic text-[10px]">No industrial records found</div>
            )}
        </div>
    </div>
  );
}
