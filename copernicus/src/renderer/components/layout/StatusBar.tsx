import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useWorkspaceStore } from '../../store/layout'
import { useCommandStore, LspState } from '../../store/commandStore'
import { useTelemetryStore } from '../../store/telemetryStore'
import { useIpcError } from '../../hooks/useIpcError'
import type { ModelCallStats } from '../../../../electron/db/state-ledger'
import { IpcResult, unwrapIpc } from '../../types/ipc'
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
  } = useWorkspaceStore()

  const { lspState } = useCommandStore()

  const {
    agentTelemetry,
    capexTotal,
    setTelemetry: setTelemetryStore
  } = useTelemetryStore()

  // agentTelemetry still drives the token counter and capex — kept in store subscription

  const { timerState, elapsedSeconds, startTimer, stopTimer, endSession } = useSessionStore()

  const [hasError, setHasError] = useState(false)
  const [indexStatus, setIndexStatus] = useState<{ indexing: boolean; filesIndexed: number; totalFiles: number; provider: string } | null>(null)
  const [localLspState, setLocalLspState] = useState<LspState | null>(null)

  useEffect(() => {
    invoke<IpcResult<LspState>>('lsp:status').then(r => {
      if (!r?.ok) return
      const state = unwrapIpc<LspState>(r)
      if (state) setLocalLspState(state)
    }).catch(() => {})

    if (!window.ipcRenderer) return
    const removeStatusListener = window.ipcRenderer.on('lsp:status-changed', (_e: Electron.IpcRendererEvent, update: any) => {
      setLocalLspState(prev => {
        if (!prev) return prev
        const isRunning = update.status === 'running'
        return {
          ...prev,
          running: isRunning,
          status: update.status,
          // You might want to also track 'reason' or 'attempt' if you want to show it in the UI
          ...(update.attempt ? { attempt: update.attempt } : {}),
          ...(update.reason ? { reason: update.reason } : {})
        } as LspState
      })
    })

    return () => removeStatusListener()
  }, [invoke])

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
    invoke<IpcResult<ModelConfig>>('models:active').then(r => {
      const m = unwrapIpc<ModelConfig>(r)
      if (m) setActiveModel(m)
    }).catch(() => {})
  }, [invoke])

  // Poll git branch and status every 5 seconds
  useEffect(() => {
    const pollGit = async () => {
      try {
        const branchRes = await invoke<IpcResult<string>>('git:current-branch')
        const branch = unwrapIpc<string>(branchRes) ?? 'unknown'

        const statusRes = await invoke<IpcResult<any[]>>('git:status')
        const status = unwrapIpc<any[]>(statusRes) ?? []

        const isDirty = status.length > 0

        useWorkspaceStore.getState().setGitBranch(branch)
        useWorkspaceStore.getState().setGitDirty(isDirty)
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
      invoke<IpcResult<{ indexing: boolean; filesIndexed: number; totalFiles: number; provider: string }>>('codebase:index-status')
        .then(result => {
          const data = unwrapIpc<{ indexing: boolean; filesIndexed: number; totalFiles: number; provider: string }>(result)
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
    invoke<IpcResult<number>>('ledger:all-time-cost').then(result => {
      const cost = unwrapIpc<number>(result)
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



  // Poll security score every 5 seconds
  useEffect(() => {
    const pollScore = async () => {
      try {
        const res = await invoke<IpcResult<{ grade: string; lspErrors: number; sentinelHits: number; npmAuditIssues: number }>>('security:score')
        const score = unwrapIpc<{ grade: string; lspErrors: number; sentinelHits: number; npmAuditIssues: number }>(res)
        if (score) setSecurityScore(score)
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

        {/* LSP Status Indicator */}
        {(localLspState ?? lspState) && (() => {
          const lsp = (localLspState ?? lspState)!;
          let color = 'text-red-500';
          let statusText = 'Stopped';

          if (lsp.status === 'running') { color = 'text-green-500'; statusText = 'Running'; }
          else if (lsp.status === 'restarting') { color = 'text-yellow-500 animate-pulse'; statusText = 'Restarting'; }
          else if (lsp.status === 'dead') { color = 'text-red-600'; statusText = 'Dead'; }

          // Use the dynamic type from state if it exists (added by listener)
          const attemptText = lsp.attempt ? ` (Retry ${lsp.attempt}/3)` : '';
          const reasonText = lsp.reason ? ` - ${lsp.reason}` : '';

          return (
            <Tooltip
              content={`${lsp.serverName ?? 'LSP'} — ${statusText}${attemptText}${reasonText} | ${lsp.openFiles} files | ${lsp.errorCount} errors | ${lsp.warningCount} warnings`}
            >
              <div className="flex items-center gap-1.5 px-3 cursor-help">
                <span className={`text-[8px] ${color}`}>●</span>
                <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
                  {(lsp.serverName ?? 'LS').substring(0, 2).toUpperCase()}
                  {lsp.errorCount > 0 && <span className="text-red-400"> {lsp.errorCount}e</span>}
                  {lsp.warningCount > 0 && <span className="text-amber-400"> {lsp.warningCount}w</span>}
                </span>
              </div>
            </Tooltip>
          );
        })()}

        {/* Security Posture Score */}
        {securityScore && (
          <Tooltip content={`${securityScore.lspErrors} LSP errors · ${securityScore.sentinelHits} Sentinel hits · ${securityScore.npmAuditIssues} npm audit issues`}>
            <div
              className="flex items-center gap-1.5 px-3 cursor-pointer hover:text-zinc-400 transition-colors"
              onClick={() => useWorkspaceStore.getState().setView('reporter')}
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

        {/* LSP indicator */}
        <Tooltip content={(localLspState ?? lspState) ? `Language server: ${(localLspState ?? lspState)?.serverName ?? 'LSP'}` : "Language server — click for details"}>
          <div className="flex items-center gap-1.5 px-3 text-[10px] cursor-pointer">
            {(localLspState ?? lspState) && (() => {
              const lsp = (localLspState ?? lspState)!;
              let bgColor = 'bg-red-500';
              if (lsp.status === 'running') bgColor = 'bg-green-500';
              else if (lsp.status === 'restarting') bgColor = 'bg-yellow-500 animate-pulse';
              else if (lsp.status === 'dead') bgColor = 'bg-red-600';

              return (
                <div className="flex items-center gap-1 mr-2 border-r border-copernicus-steel/30 pr-3">
                  <span className="text-zinc-500 font-bold uppercase tracking-tighter">
                    {(lsp.serverName ?? 'LS').substring(0, 2).toUpperCase()}
                  </span>
                  <div className={`w-1.5 h-1.5 rounded-full ${bgColor}`} />
                </div>
              );
            })()}
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

        {/* Technical Pulse */}
        <Tooltip content="Technical Pulse — click for health checks">
          <div className="flex items-center gap-1.5 px-3 text-[10px] cursor-pointer" onClick={() => setPulseOpen(v => !v)}>
            <span className="text-copernicus-phosphor/60">⚡</span>
          </div>
        </Tooltip>
      </div>
      </footer>  )
}
