import React, { useEffect, useState } from 'react'
import { useLayoutStore } from '../../store/layout'
import { useIpcError } from '../../hooks/useIpcError'
import type { ModelCallStats } from '../../../../electron/db/state-ledger'
import { unwrapIpc } from '../../types/ipc'

export const StatusBar: React.FC = () => {
  const invoke = useIpcError()
  const {
    workingDir,
    gitBranch,
    isGitDirty,
    agentTelemetry,
    capexTotal,
    capexSessionTime,
    activeStoryId,
    setTelemetry
  } = useLayoutStore()

  const [hasError, setHasError] = useState(false)
  const [indexStatus, setIndexStatus] = useState<{ indexing: boolean; filesIndexed: number; totalFiles: number; provider: string } | null>(null)

  // Session Timer Effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTelemetry({ capexSessionTime: capexSessionTime + 1 })
    }, 1000)
    return () => clearInterval(timer)
  }, [capexSessionTime, setTelemetry])

  // Poll codebase index status every 5s
  useEffect(() => {
    const poll = () => {
      invoke<{ indexing: boolean; filesIndexed: number; totalFiles: number; provider: string }>('codebase:index-status')
        .then(result => {
          const data = (result as any).data || result
          setIndexStatus(data)
        })
        .catch(() => {})
    }
    poll()
    const interval = setInterval(poll, 5000)
    return () => clearInterval(interval)
  }, [invoke])

  // Load all-time cost on mount and listen for live ledger updates
  useEffect(() => {
    if (!window.ipcRenderer) return
    invoke<number>('ledger:all-time-cost').then(result => {
      const cost = unwrapIpc<any>(result)
      if (typeof cost === 'number') setTelemetry({ capexTotal: cost })
    }).catch(() => {})

    const removeLedger = window.ipcRenderer.on(
      'ledger:stats-update',
      (_e: Electron.IpcRendererEvent, stats: ModelCallStats) => {
        const telemetry: Record<string, any> = {}
        stats.by_model.forEach(m => {
          telemetry[m.model_id] = {
            tokensIn:  m.tokens_in,
            tokensOut: m.tokens_out,
            cost:      m.cost_usd,
            limit:     200000,
          }
        })
        setTelemetry({ agentTelemetry: telemetry, capexTotal: stats.total_cost_usd })
      }
    )
    return () => removeLedger()
  }, [invoke, setTelemetry])

  // Listen for critical errors
  useEffect(() => {
    if (!window.ipcRenderer) return
    const removeListener = window.ipcRenderer.on('app:critical-error', () => {
      setHasError(true)
    })
    return () => removeListener()
  }, [])

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h}h ${m}m ${s}s`
  }

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`
    return tokens.toString()
  }

  return (
    <footer className="h-5 w-full bg-copernicus-bg border-t border-hairline border-copernicus-steel flex items-center justify-between px-2 text-[10px] text-zinc-600 select-none overflow-hidden">
      <div className="flex items-center gap-3 divide-x divide-copernicus-steel/30 min-w-0 overflow-hidden">

        {/* Workspace Root */}
        <div className="flex items-center gap-1.5 cursor-pointer hover:text-zinc-400 transition-colors pr-3">
          <span className="text-copernicus-phosphor/60">📁</span>
          <span className="truncate max-w-[150px]">{workingDir}</span>
        </div>

        {/* Git Branch */}
        <div className="flex items-center gap-1.5 px-3">
          <span className="text-copernicus-phosphor/60">🌿</span>
          <span className={`${isGitDirty ? 'text-zinc-400' : 'text-copernicus-phosphor/80'}`}>
            {gitBranch}{isGitDirty ? '*' : ''}
          </span>
        </div>

        {/* Agent Telemetry */}
        <div className="flex items-center gap-4 px-3 overflow-hidden">
          {Object.entries(agentTelemetry).map(([agent, data]) => (
            <div key={agent} className="flex items-center gap-1.5 shrink-0">
              <span className="uppercase font-bold text-zinc-500">{agent}:</span>
              <span className="text-zinc-400">
                {formatTokens(data.tokensIn + data.tokensOut)}
              </span>
              <span className="text-zinc-500">${data.cost.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 divide-x divide-copernicus-steel/30 flex-shrink-0">
        {/* Error Indicator */}
        {hasError && (
          <button
            className="text-red-400 text-[8px] font-mono px-3 animate-pulse flex items-center gap-1 hover:text-red-300 transition-colors"
            onClick={() => invoke('app:open-log')}
            title="Critical error — click to open log"
          >
            ● ERROR
          </button>
        )}

        {/* CapEx Segment */}
        <div className="flex items-center gap-3 px-3 cursor-pointer hover:text-zinc-400 transition-colors">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500">⏱</span>
            <span>{formatTime(capexSessionTime)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 uppercase font-bold">CapEx</span>
            <span className="text-copernicus-phosphor phosphor-glow font-bold">${capexTotal.toLocaleString()}</span>
          </div>
        </div>

        {/* Codebase Index Status */}
        {indexStatus && (
          <div className="flex items-center gap-1.5 px-3 text-[10px]">
            {indexStatus.provider === 'none' ? (
              <span className="text-zinc-600 italic">No embedding provider</span>
            ) : indexStatus.indexing ? (
              <span className="text-zinc-500 animate-pulse uppercase tracking-tighter">
                Indexing [{indexStatus.provider}]… {indexStatus.filesIndexed}/{indexStatus.totalFiles}
              </span>
            ) : (
              <span className="text-zinc-600 uppercase tracking-tighter">Index ready</span>
            )}
          </div>
        )}

        {/* Story ID & Status */}
        <div className="flex items-center gap-3 pl-3">
          <span className="italic underline underline-offset-2 text-zinc-500">{activeStoryId || 'NO_STORY'}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-copernicus-phosphor phosphor-glow text-[8px] animate-pulse">●</span>
            <span className="uppercase text-zinc-500 tracking-tighter">Technical_Pulse_Online</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
