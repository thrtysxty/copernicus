import React, { useEffect, useState } from 'react'
import { useIpcError } from '../../hooks/useIpcError'
import { useLayoutStore } from '../../store/layout'
import { unwrapIpc } from '../../types/ipc'

interface FileData {
  path: string
  size: number
  errors: number
  churn: number
  cost: number
}

export const HeatmapView: React.FC = () => {
  const invoke = useIpcError()
  const openFile = useLayoutStore(s => s.openFile)
  const [files, setFiles] = useState<FileData[]>([])
  const [showErrors, setShowErrors] = useState(true)
  const [showChurn, setShowChurn] = useState(true)
  const [showCost, setShowCost] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [fileList, diags, heatmap] = await Promise.all([
          invoke<any>('fs:list-files-recursive'),
          invoke<any>('diagnostics:get-all'),
          invoke<any>('ledger:heatmap-data'),
        ])

        const fl = unwrapIpc<any[]>(fileList) || []
        const dg = unwrapIpc<any[]>(diags) || []
        const hm = unwrapIpc<any>(heatmap) || { churnMap: {}, costMap: {} }

        const errorMap: Record<string, number> = {}
        dg.forEach(d => {
          // Attempt to match by full path or just filename
          const fullPath = d.file
          errorMap[fullPath] = (errorMap[fullPath] || 0) + 1
        })

        const processed: FileData[] = fl.map(f => {
          const fileName = f.path.split('/').pop() || ''
          return {
            path: f.path,
            size: f.size,
            errors: errorMap[f.path] || errorMap[fileName] || 0,
            churn: hm.churnMap[f.path] || hm.churnMap[fileName] || 0,
            cost: hm.costMap[f.path] || hm.costMap[fileName] || 0
          }
        })

        setFiles(processed)
      } catch (err) {
        console.error('Heatmap data fetch failed:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [invoke])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600 font-mono text-[10px] animate-pulse uppercase tracking-widest">
        Synthesizing_Heatmap_Telemetry...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#050505] p-2">
      <header className="flex gap-2 mb-4 shrink-0">
        <button 
          onClick={() => setShowErrors(!showErrors)}
          className={`px-3 py-1 rounded-[2px] text-[9px] font-bold border transition-all uppercase tracking-wider ${showErrors ? 'bg-red-900/30 border-red-500/40 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}
        >
          Errors
        </button>
        <button 
          onClick={() => setShowChurn(!showChurn)}
          className={`px-3 py-1 rounded-[2px] text-[9px] font-bold border transition-all uppercase tracking-wider ${showChurn ? 'bg-orange-900/30 border-orange-500/40 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.1)]' : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}
        >
          Churn
        </button>
        <button 
          onClick={() => setShowCost(!showCost)}
          className={`px-3 py-1 rounded-[2px] text-[9px] font-bold border transition-all uppercase tracking-wider ${showCost ? 'bg-purple-900/30 border-purple-500/40 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.1)]' : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}
        >
          Cost
        </button>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
        <div className="flex flex-wrap gap-2 pb-8">
          {files.map(f => (
            <div 
              key={f.path}
              onClick={() => openFile(f.path)}
              title={`${f.path.split('/').pop()} | errors: ${f.errors} | churn: ${f.churn} | cost: $${f.cost.toFixed(4)}`}
              className="w-[120px] h-[60px] bg-zinc-950 border border-zinc-900 rounded-[2px] p-2 flex flex-col justify-between cursor-pointer hover:border-zinc-700 transition-all relative overflow-hidden group"
            >
              {/* Overlay layers */}
              {showErrors && f.errors > 0 && (
                <div 
                  className="absolute inset-0 bg-red-600/40 pointer-events-none" 
                  style={{ opacity: Math.min(0.8, (f.errors / 5) * 0.6) }}
                />
              )}
              {showChurn && f.churn > 0 && (
                <div 
                  className="absolute inset-0 bg-orange-600/40 pointer-events-none" 
                  style={{ opacity: Math.min(0.8, (f.churn / 10) * 0.6) }}
                />
              )}
              {showCost && f.cost > 0 && (
                <div 
                  className="absolute inset-0 bg-purple-600/40 pointer-events-none" 
                  style={{ opacity: Math.min(0.8, (f.cost * 5) * 0.6) }}
                />
              )}
              
              <div className="z-10 flex flex-col h-full justify-between">
                <span className="text-[9px] font-mono text-zinc-400 group-hover:text-white transition-colors truncate">
                  {f.path.split('/').pop()}
                </span>
                <div className="flex justify-between items-end">
                  <span className="text-[7px] font-mono text-zinc-600 group-hover:text-zinc-500">
                    {(f.size / 1024).toFixed(1)}k
                  </span>
                  {(f.errors > 0 || f.churn > 0 || f.cost > 0) && (
                    <div className="flex gap-1">
                      {f.errors > 0 && <span className="w-1 h-1 rounded-full bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.5)]" />}
                      {f.churn > 0 && <span className="w-1 h-1 rounded-full bg-orange-500 shadow-[0_0_4px_rgba(249,115,22,0.5)]" />}
                      {f.cost > 0 && <span className="w-1 h-1 rounded-full bg-purple-500 shadow-[0_0_4px_rgba(168,85,247,0.5)]" />}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
