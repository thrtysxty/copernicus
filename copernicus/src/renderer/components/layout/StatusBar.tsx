import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useLayoutStore } from '../../store/layout'
import { useTelemetryStore } from '../../store/telemetryStore'
import { useIpcError } from '../../hooks/useIpcError'
import type { ModelCallStats } from '../../../../electron/db/state-ledger'
import { unwrapIpc } from '../../types/ipc'
import { StatusBarOverlay } from './StatusBarOverlay'
import { useSessionStore, formatElapsed } from '../../store/sessionStore'
import { AgentTelemetryOverlay } from './AgentTelemetryOverlay'
import { TechnicalPulseOverlay } from './TechnicalPulseOverlay'

interface ModelConfig { id: string; name: string; provider: string } // telemetry model picker

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
    setSessionEnded
  } = useLayoutStore()

  const {
    agentTelemetry,
    capexTotal,
    setTelemetry: setTelemetryStore
  } = useTelemetryStore()

  // agentTelemetry still drives the token counter and capex — kept in store subscription

  const { timerState, elapsedSeconds, startTimer, stopTimer, endSession } = useSessionStore()

  const [hasError, setHasError] = useState(false)
  const [indexStatus, setIndexStatus] = useState<{ indexing: boolean; filesIndexed: number; totalFiles: number; provider: string } | null>(null)
  const [lspErrorCount, setLspErrorCount] = useState(0)
  const [securityScore, setSecurityScore] = useState<{ grade: string; lspErrors: number; sentinelHits: number; npmAuditIssues: number } | null>(null)
  const [pulseOpen, setPulseOpen] = useState(false)

  const modelAnchorRef = useRef<HTMLDivElement>(null)
  const [modelOverlayOpen, setModelOverlayOpen] = useState(false)
  const [activeModel, setActiveModel] = useState<ModelConfig | null>(null)

  const handleModelSelected = useCallback((model: ModelConfig) => {
    setActiveModel(model)
    setModelOverlayOpen(false)
  }, [])

  // Fetch active model on mount
  useEffect(() => {
    invoke<ModelConfig>('models:active').then(r => {
      const m = unwrapIpc<ModelConfig>(r as any)
      if (m) setActiveModel(m)
    }).catch(() => {})
  }, [invoke])

  // Poll git branch and status every 5 seconds
  useEffect(() => {
    const pollGit = async () => {
      try {
        const branchRes = await invoke('git:current-branch')
        const branch = unwrapIpc<string>(branchRes as any) ?? 'unknown'
        
        const statusRes = await invoke('git:status')
        const status = unwrapIpc<any[]>(statusRes as any) ?? []
        
        const isDirty = status.length > 0
        
        useLayoutStore.getState().setGitBranch(branch)
        useLayoutStore.getState().setGitDirty(isDirty)
      } catch (e) {
        // Ignore polling errors
      }
    }
    
    pollGit()
    const interval = setInterval(pollGit, 5000)
    return () => clearInterval(interval)
  }, [invoke])

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
        setTelemetryStore({ capexTotal: cost })
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
        setTelemetryStore({ agentTelemetry: telemetry, capexTotal: stats.total_cost_usd })
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

  useEffect(() => {
    if (!window.ipcRenderer) return
    const removeLsp = window.ipcRenderer.on('lsp:diagnostics-update', (_e, data: any) => {
      setLspErrorCount(data?.errorCount ?? 0)
    })

    // Fetch initial count
    invoke<any>('lsp:workspace-check').then(res => {
      if (res && typeof res.errorCount === 'number') {
        setLspErrorCount(res.errorCount)
      }
    }).catch(() => {})

    return () => removeLsp()
  }, [invoke])

  // Poll security score every 5 seconds
  useEffect(() => {
    const pollScore = async () => {
      try {
        const res = await invoke<{ grade: string; lspErrors: number; sentinelHits: number; npmAuditIssues: number }>('security:score')
        if (res) setSecurityScore(res)
      } catch { /* ignore polling errors */ }
    }
    pollScore()
    const interval = setInterval(pollScore, 5000)
    return () => clearInterval(interval)
  }, [invoke])

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

      </div>

      <StatusBarOverlay anchorRef={modelAnchorRef} open={modelOverlayOpen} onClose={() => setModelOverlayOpen(false)} width={320}>
        <AgentTelemetryOverlay onModelSelected={handleModelSelected} activeModelId={activeModel?.id} />
      </StatusBarOverlay>

      {pulseOpen && <TechnicalPulseOverlay onClose={() => setPulseOpen(false)} />}

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

        {/* LSP Error Badge */}
        {lspErrorCount > 0 && (
          <div
            title={`${lspErrorCount} TypeScript error(s) in workspace`}
            className="flex items-center gap-1.5 px-3 text-yellow-400 font-mono text-[9px] animate-pulse cursor-help"
          >
            ⚠ {lspErrorCount}
          </div>
        )}

        {/* Security Posture Score */}
        {securityScore && (
          <Tooltip content={`${securityScore.lspErrors} LSP errors · ${securityScore.sentinelHits} Sentinel hits · ${securityScore.npmAuditIssues} npm audit issues`}>
            <div
              className="flex items-center gap-1.5 px-3 cursor-pointer hover:text-zinc-400 transition-colors"
              onClick={() => useLayoutStore.getState().setView('reporter')}
            >
              <span className={`text-[9px] font-mono font-bold ${securityScore.grade === 'A' ? 'text-green-400' : securityScore.grade === 'B' ? 'text-yellow-400' : 'text-red-400'}`}>
                {securityScore.grade}
              </span>
            </div>
          </Tooltip>
        )}

        {/* Model Badge — click to open model picker */}
        <Tooltip content="Active model — click to switch">
          <div
            ref={modelAnchorRef}
            className="flex items-center gap-1.5 px-3 cursor-pointer hover:text-zinc-400 transition-colors"
            onClick={() => setModelOverlayOpen(v => !v)}
          >
            <span className="text-copernicus-phosphor/70 uppercase font-bold text-[9px]">
              {activeModel ? activeModel.name : '—'}
            </span>
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
        <Tooltip content="Technical Pulse — click for health checks">
          <div className="flex items-center gap-1.5 px-3 text-[10px] cursor-pointer" onClick={() => setPulseOpen(v => !v)}>
            <span className="text-copernicus-phosphor/60">⚡</span> {/* Icon for Technical Pulse */}
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
      </footer>  )
}
