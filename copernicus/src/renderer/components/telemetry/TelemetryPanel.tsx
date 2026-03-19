import React from 'react'
import { Activity, Terminal } from 'lucide-react'
import { useTelemetryStore } from '../../store/telemetryStore'
import { useIpcError } from '../../hooks/useIpcError'

export const TelemetryPanel: React.FC = () => {
  const { agentTelemetry, capexTotal, capexTimer } = useTelemetryStore()
  const invoke = useIpcError()

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3 font-mono text-[10px]">
      <div className="flex items-center gap-2 text-zinc-500 uppercase tracking-widest">
        <Activity size={12} />
        <span>Agent Telemetry</span>
      </div>
      {Object.entries(agentTelemetry ?? {}).map(([id, t]) => (
        <div key={id} className="p-3 bg-zinc-900/50 border border-zinc-800 rounded space-y-1.5 group">
          <div className="flex items-center justify-between">
            <div className="text-zinc-300 font-bold uppercase">{id}</div>
            <button
              className="text-zinc-600 group-hover:text-copernicus-phosphor opacity-0 group-hover:opacity-100 transition-opacity"
              title="Attach Agent Terminal"
              onClick={() => invoke('terminal:attach-agent', { agentId: id, label: id })}
            >
              <Terminal size={14} />
            </button>
          </div>
          <div className="flex justify-between text-zinc-500">
            <span>Tokens In</span><span className="text-copernicus-phosphor/70">{t.tokensIn.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-zinc-500">
            <span>Tokens Out</span><span className="text-copernicus-phosphor/70">{t.tokensOut.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-zinc-500">
            <span>Cost</span><span className="text-copernicus-phosphor/70">${t.cost.toFixed(4)}</span>
          </div>
        </div>
      ))}
      <div className="pt-2 border-t border-zinc-800 flex justify-between text-zinc-500">
        <span>Session</span><span className="text-copernicus-phosphor/70">{capexTimer}</span>
      </div>
      <div className="flex justify-between text-zinc-500">
        <span>Total Cost</span><span className="text-copernicus-phosphor/70">${capexTotal.toFixed(4)}</span>
      </div>
    </div>
  )
}
