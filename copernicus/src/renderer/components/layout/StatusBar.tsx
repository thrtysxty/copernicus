import React, { useEffect, useState, useRef } from 'react'
import { useLayoutStore } from '../../store/layout'
import { useIpcError } from '../../hooks/useIpcError'
import type { ModelCallStats } from '../../../../electron/db/state-ledger'
import { unwrapIpc } from '../../types/ipc'
import { StatusBarOverlay } from './StatusBarOverlay'
import { useSessionStore, formatElapsed } from '../../store/sessionStore'
import { AgentTelemetryOverlay } from './AgentTelemetryOverlay'

const Tooltip: React.FC<{ content: string; children: React.ReactNode }> = ({ content, children }) => (
  <div className="relative group/tip">
    {children}
    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-900 border border-zinc-700 text-[9px] font-mono text-zinc-300 rounded whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity delay-300 z-50">
      {content}
    </div>
  </div>
)

export const StatusBar: React.FC = () => {
  const invoke = useIpcError()
  const {
    workingDir,
    gitBranch,
    isGitDirty,
    agentTelemetry,
    capexTotal,
    setSessionEnded
  } = useLayoutStore()

  const { timerState, elapsedSeconds, startTimer, stopTimer, endSession } = useSessionStore()

  const [hasError, setHasError] = useState(false)
  const [indexStatus, setIndexStatus] = useState<{ indexing: boolean; filesIndexed: number; totalFiles: number; provider: string } | null>(null)

  const agentAnchorRef = useRef<HTMLDivElement>(null)
  const [agentOverlayOpen, setAgentOverlayOpen] = useState(false)

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
      if (typeof cost === 'number') {
        useLayoutStore.getState().setTelemetry({ capexTotal: cost })
      }
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
        useLayoutStore.getState().setTelemetry({ agentTelemetry: telemetry, capexTotal: stats.total_cost_usd })
      }
    )
    return () => removeLedger()
  }, [invoke])

  // Listen for critical errors
  useEffect(() => {
    if (!window.ipcRenderer) return
    const removeListener = window.ipcRenderer.on('app:critical-error', () => {
      setHasError(true)
    })
    return () => removeListener()
  }, [])

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`
    return tokens.toString()
  }

  const totalTokens = Object.values(agentTelemetry ?? {}).reduce((acc, curr) => acc + curr.tokensIn + curr.tokensOut, 0)

  return (
    <footer className="h-5 w-full bg-copernicus-bg border-t border-hairline border-copernicus-steel flex items-center justify-between px-2 text-[10px] text-zinc-600 select-none overflow-hidden">
      <div className="flex items-center gap-3 divide-x divide-copernicus-steel/30 min-w-0 overflow-hidden">

        {/* Workspace Root */}
        <div className="flex items-center gap-1.5 cursor-pointer hover:text-zinc-400 transition-colors pr-3">
          <span className="text-copernicus-phosphor/60">📁</span>
          <span className="truncate max-w-[150px]">{workingDir}</span>
        </div>

        {/* Git Branch */}
        <Tooltip content="Current git branch">
          <div className="flex items-center gap-1.5 px-3">
            <span className="text-copernicus-phosphor/60">🌿</span>
            <span className={`${isGitDirty ? 'text-zinc-400' : 'text-copernicus-phosphor/80'}`}>
              {gitBranch}{isGitDirty ? '*' : ''}
            </span>
          </div>
        </Tooltip>

        {/* Agent Telemetry */}
        <div ref={agentAnchorRef}>
          <Tooltip content="Active agents — click for details">
            <div 
              className="flex items-center gap-4 px-3 overflow-hidden cursor-pointer"
              onClick={() => setAgentOverlayOpen(v => !v)}
            >
              {Object.entries(agentTelemetry ?? {}).map(([agent, data]) => (
                <div key={agent} className="flex items-center gap-1.5 shrink-0">
                  <span className="uppercase font-bold text-zinc-500">{agent}:</span>
                  <span className="text-zinc-400">
                    {formatTokens(data.tokensIn + data.tokensOut)}
                  </span>
                  <span className="text-zinc-500">${data.cost.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </Tooltip>
        </div>
      </div>

      <StatusBarOverlay anchorRef={agentAnchorRef} open={agentOverlayOpen} onClose={() => setAgentOverlayOpen(false)}>
        <AgentTelemetryOverlay />
      </StatusBarOverlay>

      <div className="flex items-center gap-3 divide-x divide-copernicus-steel/30 flex-shrink-0">
        {/* Timer display */}
        <div className="flex items-center gap-1.5 px-2">
          <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
            {timerState === 'idle' && elapsedSeconds === 0 ? '--:--:--' : formatElapsed(elapsedSeconds)}
          </span>
          {timerState === 'idle' && (
            <button onClick={startTimer} className="text-[9px] text-zinc-600 hover:text-copernicus-phosphor transition-colors uppercase">▶</button>
          )}
          {timerState === 'running' && (<>
            <button onClick={stopTimer} className="text-[9px] text-zinc-600 hover:text-yellow-400 transition-colors">⏸</button>
            <button onClick={() => { endSession(); setSessionEnded(true) }} className="text-[9px] text-zinc-600 hover:text-red-400 transition-colors uppercase">■</button>
          </>)}
          {timerState === 'paused' && (<>
            <button onClick={startTimer} className="text-[9px] text-zinc-600 hover:text-copernicus-phosphor transition-colors">▶</button>
            <button onClick={() => { endSession(); setSessionEnded(true) }} className="text-[9px] text-zinc-600 hover:text-red-400 transition-colors uppercase">■</button>
          </>)}
        </div>

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

        {/* Model Badge */}
        <Tooltip content="Active model">
          <div className="flex items-center gap-1.5 px-3">
            <span className="text-zinc-500 uppercase font-bold text-[9px]">Claude 3.7 Sonnet</span>
          </div>
        </Tooltip>

        {/* Token Counter */}
        <Tooltip content="Tokens used this session">
          <div className="flex items-center gap-1.5 px-3">
            <span className="text-zinc-500 uppercase font-bold text-[9px]">Tokens</span>
            <span>{formatTokens(totalTokens)}</span>
          </div>
        </Tooltip>

        {/* CapEx Segment / Cost Badge */}
        <Tooltip content="Estimated cost (USD) this session">
          <div className="flex items-center gap-3 px-3 cursor-pointer hover:text-zinc-400 transition-colors">
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500 uppercase font-bold">CapEx</span>
              <span className="text-copernicus-phosphor phosphor-glow font-bold">${capexTotal.toLocaleString()}</span>
            </div>
          </div>
        </Tooltip>

        {/* Codebase Index Status / LSP indicator */}
        <Tooltip content="Language server — click for details">
          <div className="flex items-center gap-1.5 px-3 text-[10px] cursor-pointer">
            {indexStatus && indexStatus.provider !== 'none' ? (
              indexStatus.indexing ? (
                <span className="text-zinc-500 animate-pulse uppercase tracking-tighter">
                  Indexing [{indexStatus.provider}]… {indexStatus.filesIndexed}/{indexStatus.totalFiles}
                </span>
              ) : (
                <span className="text-zinc-600 uppercase tracking-tighter">Index ready</span>
              )
            ) : (
              <span className="text-zinc-600 italic">No embedding provider</span>
            )}
          </div>
        </Tooltip>
      </div>
    </footer>
  )
}
