import React, { useState, useEffect, useMemo } from 'react'
import { AlertCircle, AlertTriangle, Info, Play, Loader2, FileText, ShieldAlert } from 'lucide-react'
import { useWorkspaceStore } from '../../store/layout'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc } from '../../types/ipc'
import { useDiagnosticsStore, DiagnosticsIssue } from '../../store/diagnostics'

export const DiagnosticsPanel: React.FC = () => {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState('')
  const [activeTab, setActiveTab] = useState<'All' | 'LSP' | 'ESLint' | 'Ruff' | 'Audit'>('All')

  const diagnostics = useDiagnosticsStore(s => s.diagnostics)
  const setDiagnostics = useDiagnosticsStore(s => s.setDiagnostics)
  
  const invoke = useIpcError()
  const openFile = useWorkspaceStore(s => s.openFile)
  const setDiagnosticErrorCount = useWorkspaceStore(s => s.setDiagnosticErrorCount)
  const pendingReview = useWorkspaceStore(s => s.pendingReview)

  // Combined error count for badge (from layout store)
  useEffect(() => {
    const errorCount = diagnostics.filter(d => d.severity === 'error').length
    setDiagnosticErrorCount(errorCount)
  }, [diagnostics, setDiagnosticErrorCount])

  const runTsc = async () => {
    setRunning(true)
    setProgress('Starting tsc...')
    try {
      const res = await invoke<any>('diagnostics:run-tsc')
      if (!res.ok) return
      const diags = unwrapIpc<any[]>(res) ?? []
      const lspDiags: DiagnosticsIssue[] = diags.map((d: any) => ({
        ...d,
        source: 'LSP'
      }))
      
      setDiagnostics([
        ...diagnostics.filter(d => d.source !== 'LSP'),
        ...lspDiags
      ])
    } finally {
      setRunning(false)
      setProgress('')
    }
  }

  const runAudit = async (type: 'npm' | 'pip') => {
    setRunning(true)
    setProgress(`Running ${type} audit...`)
    try {
      const res = await invoke<any>('diag:run-audit', type)
      if (!res.ok) return
      const diags = unwrapIpc<DiagnosticsIssue[]>(res) ?? []
      
      setDiagnostics([
        ...diagnostics.filter(d => d.source !== 'Audit'),
        ...diags
      ])
    } finally {
      setRunning(false)
      setProgress('')
    }
  }

  useEffect(() => {
    const fetchAll = async () => {
      // Get LSP cached
      const lspRes = await invoke<any>('diagnostics:get-all')
      if (lspRes.ok) {
        const lsp = unwrapIpc<any[]>(lspRes) || []
        const lspDiags: DiagnosticsIssue[] = lsp.map(d => ({ ...d, source: 'LSP' as const }))
        useDiagnosticsStore.getState().addDiagnostics(lspDiags)
      }
      
      // Get other diags cached
      const diagRes = await invoke<any>('diag:get-all')
      if (diagRes.ok) {
        const other = unwrapIpc<DiagnosticsIssue[]>(diagRes) || []
        useDiagnosticsStore.getState().addDiagnostics(other)
      }
    }
    fetchAll()

    const removeProgress = window.ipcRenderer.on('diagnostics:tsc-progress', (_e, data: string) => {
      setProgress(data.split('\n').pop() || '')
    })
    const removeComplete = window.ipcRenderer.on('diagnostics:tsc-complete', (_e, diags: any[]) => {
      const lspDiags: DiagnosticsIssue[] = diags.map(d => ({ ...d, source: 'LSP' as const }))
      useDiagnosticsStore.getState().clearDiagnostics('LSP')
      useDiagnosticsStore.getState().addDiagnostics(lspDiags)
    })
    const removeDiagResults = window.ipcRenderer.on('diag:results', (_e, diags: any[]) => {
      // Replaces all non-LSP with whatever is cached in the main process
      useDiagnosticsStore.getState().setDiagnostics([
        ...useDiagnosticsStore.getState().diagnostics.filter(d => d.source === 'LSP'),
        ...(diags as DiagnosticsIssue[])
      ])
    })

    return () => {
      removeProgress()
      removeComplete()
      removeDiagResults()
    }
  }, [invoke])

  // Auto-run when review session completes
  useEffect(() => {
    if (pendingReview) {
      runTsc()
    }
  }, [pendingReview])

  const filteredDiagnostics = useMemo(() => {
    if (activeTab === 'All') return diagnostics
    return diagnostics.filter(d => d.source === activeTab)
  }, [diagnostics, activeTab])

  const errors = filteredDiagnostics.filter(d => d.severity === 'error')
  const warnings = filteredDiagnostics.filter(d => d.severity === 'warning')
  const infos = filteredDiagnostics.filter(d => d.severity === 'info')

  const renderDiagnostic = (d: DiagnosticsIssue, i: number) => {
    const Icon = d.severity === 'error' ? AlertCircle : d.severity === 'warning' ? AlertTriangle : Info
    const color = d.severity === 'error' ? 'text-red-400' : d.severity === 'warning' ? 'text-amber-400' : 'text-blue-400'
    const bgColor = d.severity === 'error' ? 'bg-red-400/5' : d.severity === 'warning' ? 'bg-amber-400/5' : 'bg-blue-400/5'

    return (
      <div 
        key={`${d.file}-${d.line}-${d.col}-${i}`} 
        className={`p-2 border-b border-zinc-800/50 hover:bg-zinc-900/50 cursor-pointer group flex gap-3 ${bgColor}`}
        onClick={() => {
          openFile(d.file)
          invoke<void>('layout:goto-line', { file: d.file, line: d.line, col: d.col })
        }}
      >
        <Icon size={14} className={`${color} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-zinc-300 font-bold truncate">{d.file.split(/[/\\]/).pop()}</span>
            <span className="text-zinc-600 text-[8px] bg-zinc-900 px-1 rounded">L{d.line}:{d.col}</span>
            <span className="text-zinc-500 text-[8px] uppercase border border-zinc-700 px-1 rounded">{d.source}</span>
            <span className="text-zinc-500 text-[8px] uppercase">{d.code}</span>
          </div>
          <div className="text-zinc-400 leading-relaxed break-words">{d.message}</div>
        </div>
      </div>
    )
  }

  const tabs: ('All' | 'LSP' | 'ESLint' | 'Ruff' | 'Audit')[] = ['All', 'LSP', 'ESLint', 'Ruff', 'Audit']

  return (
    <div data-testid="panel-diagnostics" className="flex flex-col h-full bg-[#050505] font-mono text-[10px] text-zinc-300">
      <div className="p-4 border-b border-zinc-800 flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold tracking-widest uppercase">Diagnostics</span>
            <div className="flex items-center gap-1">
              {errors.length > 0 && <span className="bg-red-500 text-[#050505] px-1.5 py-0.5 rounded-none text-[8px] font-bold">{errors.length}</span>}
              {warnings.length > 0 && <span className="bg-amber-500 text-[#050505] px-1.5 py-0.5 rounded-none text-[8px] font-bold">{warnings.length}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => runAudit('npm')} 
              disabled={running}
              className="bg-zinc-900 border border-zinc-800 px-3 py-1 rounded hover:bg-zinc-800 flex items-center gap-2 disabled:opacity-50 text-[9px] font-bold"
              title="Run npm audit"
            >
              <ShieldAlert size={10} />
              NPM AUDIT
            </button>
            <button 
              onClick={() => runAudit('pip')} 
              disabled={running}
              className="bg-zinc-900 border border-zinc-800 px-3 py-1 rounded hover:bg-zinc-800 flex items-center gap-2 disabled:opacity-50 text-[9px] font-bold"
              title="Run pip-audit"
            >
              <ShieldAlert size={10} />
              PIP AUDIT
            </button>
            <button 
              onClick={runTsc} 
              disabled={running}
              className="bg-zinc-900 border border-zinc-800 px-3 py-1 rounded hover:bg-zinc-800 flex items-center gap-2 disabled:opacity-50 text-[9px] font-bold"
            >
              {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={10} />}
              RUN TSC
            </button>
          </div>
        </div>
        
        <div className="flex gap-2">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 uppercase font-bold text-[9px] border ${
                activeTab === tab 
                ? 'bg-copernicus-phosphor text-[#050505] rounded-none border-transparent' 
                : 'text-zinc-500 border-transparent hover:text-zinc-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {running && (
        <div className="px-4 py-2 bg-copernicus-phosphor/5 border-b border-copernicus-phosphor/10 flex items-center gap-3 shrink-0">
          <Loader2 size={12} className="animate-spin text-copernicus-phosphor" />
          <span className="text-copernicus-phosphor text-[8px] truncate">{progress || 'Running diagnostics...'}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {filteredDiagnostics.length === 0 && !running && (
          <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-4 opacity-50">
            <FileText size={48} strokeWidth={1} />
            <div className="text-center">
              <div className="font-bold uppercase tracking-widest mb-1 text-zinc-500">No problems detected</div>
              <div className="text-[8px]">Run TSC, ESLint, Ruff, or Audit to check for errors</div>
            </div>
          </div>
        )}

        {errors.length > 0 && (
          <div className="border-b border-zinc-800">
            <div className="px-4 py-1.5 bg-red-400/5 text-red-400 font-bold uppercase tracking-widest text-[8px] flex items-center justify-between">
              <span>Errors</span>
              <span>{errors.length}</span>
            </div>
            {errors.map(renderDiagnostic)}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="border-b border-zinc-800">
            <div className="px-4 py-1.5 bg-amber-400/5 text-amber-400 font-bold uppercase tracking-widest text-[8px] flex items-center justify-between">
              <span>Warnings</span>
              <span>{warnings.length}</span>
            </div>
            {warnings.map(renderDiagnostic)}
          </div>
        )}

        {infos.length > 0 && (
          <div>
            <div className="px-4 py-1.5 bg-blue-400/5 text-blue-400 font-bold uppercase tracking-widest text-[8px] flex items-center justify-between">
              <span>Info</span>
              <span>{infos.length}</span>
            </div>
            {infos.map(renderDiagnostic)}
          </div>
        )}
      </div>

      <div className="p-2 border-t border-zinc-800 text-[8px] text-zinc-600 flex justify-between shrink-0">
        <span>DIAGNOSTICS</span>
        <span>{filteredDiagnostics.length} PROBLEMS SHOWN</span>
      </div>
    </div>
  )
}
