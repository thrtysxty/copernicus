import React, { useState, useEffect } from 'react'
import { AlertCircle, AlertTriangle, Info, Play, Loader2, FileText } from 'lucide-react'
import { useLayoutStore } from '../../store/layout'
import { useIpcError } from '../../hooks/useIpcError'
import { IpcResult, unwrapIpc } from '../../types/ipc'

interface Diagnostic {
  file: string
  line: number
  col: number
  severity: 'error' | 'warning' | 'info'
  code: string
  message: string
}

export const ProblemsPanel: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState('')
  
  const invoke = useIpcError()
  const openFile = useLayoutStore(s => s.openFile)
  const setDiagnosticErrorCount = useLayoutStore(s => s.setDiagnosticErrorCount)
  const pendingReview = useLayoutStore(s => s.pendingReview)

  const runTsc = async () => {
    setRunning(true)
    setProgress('Starting tsc...')
    try {
      const res = await invoke<IpcResult<Diagnostic[]>>('diagnostics:run-tsc')
      const diags = unwrapIpc<Diagnostic[]>(res) ?? []
      setDiagnostics(diags)
      setDiagnosticErrorCount(diags.filter((d: Diagnostic) => d.severity === 'error').length)
    } finally {
      setRunning(false)
      setProgress('')
    }
  }

  useEffect(() => {
    const removeProgress = window.ipcRenderer.on('diagnostics:tsc-progress', (_e, data: string) => {
      setProgress(data.split('\n').pop() || '')
    })
    const removeComplete = window.ipcRenderer.on('diagnostics:tsc-complete', (_e, diags: Diagnostic[]) => {
      setDiagnostics(diags)
      setDiagnosticErrorCount(diags.filter(d => d.severity === 'error').length)
    })
    return () => {
      removeProgress()
      removeComplete()
    }
  }, [])

  // Auto-run when review session completes
  useEffect(() => {
    if (pendingReview) {
      runTsc()
    }
  }, [pendingReview])

  const errors = diagnostics.filter(d => d.severity === 'error')
  const warnings = diagnostics.filter(d => d.severity === 'warning')
  const infos = diagnostics.filter(d => d.severity === 'info')

  const renderDiagnostic = (d: Diagnostic, i: number) => {
    const Icon = d.severity === 'error' ? AlertCircle : d.severity === 'warning' ? AlertTriangle : Info
    const color = d.severity === 'error' ? 'text-red-400' : d.severity === 'warning' ? 'text-amber-400' : 'text-blue-400'
    const bgColor = d.severity === 'error' ? 'bg-red-400/5' : d.severity === 'warning' ? 'bg-amber-400/5' : 'bg-blue-400/5'

    return (
      <div 
        key={i} 
        className={`p-2 border-b border-copernicus-steel/10 hover:bg-zinc-900/50 cursor-pointer group flex gap-3 ${bgColor}`}
        onClick={() => {
          openFile(d.file)
          // We would also emit layout:goto-line here if we had the event listener in Monaco
          window.ipcRenderer.send('layout:goto-line', { file: d.file, line: d.line, col: d.col })
        }}
      >
        <Icon size={14} className={`${color} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-zinc-300 font-bold truncate">{d.file.split('/').pop()}</span>
            <span className="text-zinc-600 text-[8px] bg-zinc-900 px-1 rounded">L{d.line}:{d.col}</span>
            <span className="text-zinc-500 text-[8px] uppercase">{d.code}</span>
          </div>
          <div className="text-zinc-400 leading-relaxed break-words">{d.message}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#050505] font-mono text-[10px] text-zinc-300">
      <div className="p-4 border-b border-copernicus-steel/20 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-bold tracking-widest uppercase">Diagnostics</span>
          <div className="flex items-center gap-1">
            {errors.length > 0 && <span className="bg-red-500/20 text-red-500 px-1.5 py-0.5 rounded-full text-[8px] font-bold">{errors.length}</span>}
            {warnings.length > 0 && <span className="bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded-full text-[8px] font-bold">{warnings.length}</span>}
          </div>
        </div>
        <button 
          onClick={runTsc} 
          disabled={running}
          className="bg-zinc-900 border border-zinc-800 px-3 py-1 rounded hover:bg-zinc-800 flex items-center gap-2 disabled:opacity-50"
        >
          {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={10} />}
          RUN TSC
        </button>
      </div>

      {running && (
        <div className="px-4 py-2 bg-copernicus-phosphor/5 border-b border-copernicus-phosphor/10 flex items-center gap-3 shrink-0">
          <Loader2 size={12} className="animate-spin text-copernicus-phosphor" />
          <span className="text-copernicus-phosphor text-[8px] truncate">{progress || 'Compiling...'}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {diagnostics.length === 0 && !running && (
          <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-4 opacity-50">
            <FileText size={48} strokeWidth={1} />
            <div className="text-center">
              <div className="font-bold uppercase tracking-widest mb-1">No problems detected</div>
              <div className="text-[8px]">Run TSC to check for TypeScript errors</div>
            </div>
          </div>
        )}

        {errors.length > 0 && (
          <div className="border-b border-copernicus-steel/20">
            <div className="px-4 py-1.5 bg-red-400/5 text-red-400 font-bold uppercase tracking-widest text-[8px] flex items-center justify-between">
              <span>Errors</span>
              <span>{errors.length}</span>
            </div>
            {errors.map(renderDiagnostic)}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="border-b border-copernicus-steel/20">
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

      <div className="p-2 border-t border-copernicus-steel/20 text-[8px] text-zinc-600 flex justify-between shrink-0">
        <span>TSC VERSION: 5.x</span>
        <span>{diagnostics.length} TOTAL PROBLEMS</span>
      </div>
    </div>
  )
}
