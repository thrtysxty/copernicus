import React, { useState, useEffect } from 'react'
import { useIpcError } from '../../hooks/useIpcError'
import { Activity } from 'lucide-react'
import { unwrapIpc } from '../../types/ipc'

interface TelemetryStatus {
  collectorRunning: boolean
  settingsWritten: boolean
}

export const TelemetryStatusTile: React.FC = () => {
  const invoke = useIpcError()
  const [status, setStatus] = useState<TelemetryStatus | null>(null)

  useEffect(() => {
    let mounted = true
    const checkStatus = async () => {
      try {
        const res = await invoke<IpcResult<TelemetryStatus>>('telemetry:status')
        if (mounted && res.ok) {
          setStatus(unwrapIpc<TelemetryStatus>(res))
        }
      } catch (e) {
        // useIpcError already handles throwing via toast or we can ignore
      }
    }
    checkStatus()
    return () => { mounted = false }
  }, [invoke])

  let dotColor = 'bg-zinc-500'
  let labelText = 'Checking...'

  if (status) {
    if (status.collectorRunning && status.settingsWritten) {
      dotColor = 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]'
      labelText = 'Telemetry Active'
    } else if (!status.collectorRunning) {
      dotColor = 'bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)]'
      labelText = 'Collector Offline'
    } else if (!status.settingsWritten) {
      dotColor = 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]'
      labelText = 'Settings Error'
    }
  }

  return (
    <div className="flex items-center justify-between p-3 bg-zinc-900/30 border border-zinc-800 rounded-lg group hover:border-zinc-700 transition-colors mt-4">
      <div className="flex items-center gap-3">
        <div className="p-1.5 rounded bg-zinc-950 text-zinc-500 group-hover:text-zinc-400 transition-colors">
          <Activity size={14} />
        </div>
        <div>
          <div className="text-[11px] font-bold text-zinc-200 uppercase font-mono">Claude Code Telemetry</div>
          <div className="text-[11px] text-zinc-500 font-mono">OpenTelemetry Collector Integration</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-mono text-zinc-400 uppercase">{labelText}</span>
        <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
      </div>
    </div>
  )
}
