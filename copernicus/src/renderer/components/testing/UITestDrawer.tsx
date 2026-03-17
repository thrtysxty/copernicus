import React, { useEffect, useState } from 'react'
import { useIpcError } from '../../hooks/useIpcError'

import { useUIBuilderStore } from '../../store/uiBuilderStore'
import { Play, PlaySquare, X, CheckCircle, XCircle, Clock } from 'lucide-react'
import { unwrapIpc } from '../../types/ipc'

interface TestResult {
  title: string
  status: 'PASS' | 'FAIL'
  duration: number
}

export const UITestDrawer: React.FC = () => {
  const invoke = useIpcError()
  const toggleUITestingDrawer = useUIBuilderStore(s => s.toggleUITestingDrawer)
  const [testFiles, setTestFiles] = useState<string[]>([])
  const [results, setResults] = useState<TestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [runningFile, setRunningFile] = useState<string | null>(null)

  useEffect(() => {
    loadTestFiles()
  }, [])

  const loadTestFiles = async () => {
    try {
      const res = await invoke<any>('fs:list-dir', 'e2e')
      const data = unwrapIpc<any[]>(res)
      if (Array.isArray(data)) {
        const files = data
          .filter((f: any) => !f.isDir && (f.name.endsWith('.spec.ts') || f.name.endsWith('.test.ts')))
          .map((f: any) => f.name)
        setTestFiles(files)
      }
    } catch (err) {
      console.error('Failed to load test files', err)
    }
  }

  const runTests = async (file?: string) => {
    setIsRunning(true)
    setRunningFile(file || 'all')
    try {
      const res = await invoke<any>('devtime:run-playwright', file ? { file } : {})
      const data = res?.data || res
      if (data && data.results) {
        setResults(data.results)
      }
    } catch (err) {
      console.error('Failed to run tests', err)
    } finally {
      setIsRunning(false)
      setRunningFile(null)
    }
  }

  return (
    <div className="absolute top-10 right-0 h-[calc(100%-2.5rem)] w-[200px] bg-[#0A0A0A] border-l border-zinc-800 z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
      <div className="h-10 border-b border-zinc-800 flex justify-between items-center px-3 shrink-0">
        <h2 className="text-[10px] font-mono font-bold text-zinc-400 flex items-center gap-2 tracking-widest uppercase">
          <PlaySquare size={12} className="text-emerald-500" />
          UI TESTING
        </h2>
        <button 
          onClick={toggleUITestingDrawer}
          className="text-zinc-500 hover:text-white transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="p-3 flex flex-col gap-3 flex-1 overflow-y-auto custom-scrollbar">
        <button
          onClick={() => runTests()}
          disabled={isRunning}
          className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-[10px] font-bold rounded transition-colors flex items-center justify-center gap-2 uppercase tracking-wider"
        >
          {isRunning && runningFile === 'all' ? (
            <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : (
            <Play size={10} fill="currentColor" />
          )}
          RUN ALL
        </button>

        <div className="space-y-1.5">
          <h3 className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Test Files</h3>
          {testFiles.length === 0 && <div className="text-[10px] text-zinc-700 italic">No tests found in /e2e</div>}
          {testFiles.map(file => (
            <div key={file} className="flex items-center justify-between p-1.5 bg-zinc-900/50 rounded border border-zinc-800 group">
              <span className="text-[10px] text-zinc-400 truncate mr-2 font-mono" title={file}>{file}</span>
              <button
                onClick={() => runTests(file)}
                disabled={isRunning}
                className="p-1 text-zinc-500 hover:text-emerald-500 disabled:text-zinc-800 transition-colors"
              >
                {isRunning && runningFile === file ? (
                  <div className="w-2.5 h-2.5 border-2 border-zinc-500/20 border-t-emerald-500 rounded-full animate-spin" />
                ) : (
                  <Play size={10} fill="currentColor" />
                )}
              </button>
            </div>
          ))}
        </div>

        {results.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <h3 className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Results</h3>
            <div className="bg-black rounded border border-zinc-800 divide-y divide-zinc-900 overflow-hidden">
              {results.map((res, i) => (
                <div key={i} className="p-1.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {res.status === 'PASS' ? (
                      <CheckCircle size={10} className="text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle size={10} className="text-rose-500 shrink-0" />
                    )}
                    <span className="text-[9px] text-zinc-400 truncate font-mono" title={res.title}>{res.title}</span>
                  </div>
                  <div className="flex items-center gap-1 text-zinc-600 shrink-0">
                    <Clock size={8} />
                    <span className="text-[8px] font-mono">{res.duration}ms</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
