import log from '../../../utils/logger'
import React, { useState, useEffect } from 'react'
import { useIpcError } from '../../../hooks/useIpcError'
import { useToastStore } from '../../../store/toastStore'
import { 
  Search, 
  Settings, 
  Layers, 
  Zap,
  Save,
  ToggleLeft,
  ToggleRight,
  Play,
  Loader2,
  BarChart2
} from 'lucide-react'
import { unwrapIpc } from '../../../types/ipc'

interface BenchmarkResult {
  fastMRR: number
  deepMRR: number
  delta: number
}

export const RagSection: React.FC = () => {
  const invoke = useIpcError()
  const addToast = useToastStore(s => s.addToast)
  const [budget, setBudget] = useState(4000)
  const [chunkLimit, setChunkLimit] = useState(500)
  const [summariseEnabled, setSummariseEnabled] = useState(true)
  const [loading, setLoading] = useState(true)

  // Benchmark state
  const [isBenchmarking, setIsBenchmarking] = useState(false)
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null)
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null)

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await invoke<any>('settings:load')
        if (settings) {
          if (settings.ragBudget) setBudget(settings.ragBudget)
          if (settings.ragChunkLimit) setChunkLimit(settings.ragChunkLimit)
          if (settings.ragSummariseEnabled !== undefined) setSummariseEnabled(settings.ragSummariseEnabled)
        }
      } catch (err) {
        log.error('Failed to load RAG settings', err)
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [invoke])

  const handleSave = async () => {
    try {
      await invoke('settings:save', {
        ragBudget: budget,
        ragChunkLimit: chunkLimit,
        ragSummariseEnabled: summariseEnabled
      })
      addToast('RAG settings saved', 'success')
    } catch (err) {
      addToast('Failed to save RAG settings', 'error')
    }
  }

  const handleRunBenchmark = async () => {
    setIsBenchmarking(true)
    setBenchmarkError(null)
    setBenchmarkResult(null)

    try {
      const res = await invoke('codebase:run-benchmark') as any
      const data = unwrapIpc<BenchmarkResult>(res)
      if (data) {
        setBenchmarkResult(data)
      }
    } catch (err: unknown) {
      setBenchmarkError((err as Error).message || 'An error occurred during benchmark.')
    } finally {
      setIsBenchmarking(false)
    }
  }

  if (loading) return <div className="text-[10px] font-mono text-zinc-500 animate-pulse">LOADING_RAG_CONFIG...</div>

  return (
    <div className="space-y-10 animate-in fade-in duration-300">
      <section className="space-y-6">
        <div>
          <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-[0.2em] font-mono flex items-center gap-2">
            <Search size={16} className="text-copernicus-phosphor" />
            RAG Tuning
          </h2>
          <p className="text-[10px] text-zinc-500 font-mono mt-1">Configure how codebase context is retrieved and injected.</p>
        </div>

        <div className="space-y-4">
          {/* Injection Budget */}
          <div className="bg-[#0F0F0F] border border-zinc-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-zinc-500" />
                <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">Total Injection Budget</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(parseInt(e.target.value, 10))}
                  className="w-20 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] font-mono text-zinc-300 focus:border-copernicus-phosphor focus:outline-none"
                />
                <span className="text-[9px] font-mono text-zinc-600 uppercase">tokens</span>
              </div>
            </div>
            <p className="text-[10px] text-zinc-500 font-mono leading-relaxed">
              Maximum total tokens allowed for RAG context injection. Results exceeding this budget will be dropped based on relevance.
            </p>
          </div>

          {/* Per-chunk Limit */}
          <div className="bg-[#0F0F0F] border border-zinc-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings size={14} className="text-zinc-500" />
                <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">Per-chunk Limit</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={chunkLimit}
                  onChange={(e) => setChunkLimit(parseInt(e.target.value, 10))}
                  className="w-20 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] font-mono text-zinc-300 focus:border-copernicus-phosphor focus:outline-none"
                />
                <span className="text-[9px] font-mono text-zinc-600 uppercase">tokens</span>
              </div>
            </div>
            <p className="text-[10px] text-zinc-500 font-mono leading-relaxed">
              Chunks larger than this will be automatically summarized before injection to preserve budget.
            </p>
          </div>

          {/* Summarisation Toggle */}
          <div className="bg-[#0F0F0F] border border-zinc-800 rounded-lg p-5 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-zinc-500" />
                <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">JIT Summarisation</label>
              </div>
              <p className="text-[10px] text-zinc-500 font-mono">Enable automatic summarization for oversized codebase snippets.</p>
            </div>
            <button
              onClick={() => setSummariseEnabled(!summariseEnabled)}
              className={`transition-colors ${summariseEnabled ? 'text-copernicus-phosphor' : 'text-zinc-700'}`}
            >
              {summariseEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
            </button>
          </div>

          <button
            onClick={handleSave}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-copernicus-phosphor text-[#050505] rounded-none text-[10px] font-bold uppercase tracking-[0.2em] hover:opacity-90 transition-opacity"
          >
            <Save size={14} />
            Save RAG Configuration
          </button>
        </div>
      </section>

      {/* Benchmark Section */}
      <section className="pt-6 border-t border-zinc-800 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-widest font-mono flex items-center gap-2">
              <BarChart2 size={14} className="text-copernicus-phosphor" />
              Performance Benchmark
            </h3>
            <p className="text-[10px] text-zinc-500 font-mono">Verify RAG quality across different retrieval modes.</p>
          </div>
          <button
            onClick={handleRunBenchmark}
            disabled={isBenchmarking}
            className={`flex items-center gap-2 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
              isBenchmarking
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white border border-indigo-500/20 hover:border-indigo-500'
            }`}
          >
            {isBenchmarking ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            {isBenchmarking ? 'Running...' : 'Run Benchmark'}
          </button>
        </div>

        {benchmarkError && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
            {benchmarkError}
          </div>
        )}

        {benchmarkResult && (
          <div className="overflow-hidden border border-zinc-800 rounded-lg">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="bg-zinc-900 border-b border-zinc-800 text-zinc-400">
                  <th className="px-4 py-3 font-normal uppercase tracking-tighter">Metric</th>
                  <th className="px-4 py-3 font-normal uppercase tracking-tighter text-center">Fast Mode</th>
                  <th className="px-4 py-3 font-normal uppercase tracking-tighter text-center">Deep Mode</th>
                  <th className="px-4 py-3 font-normal uppercase tracking-tighter text-center">Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-[#080808]">
                <tr className="hover:bg-zinc-900/50 transition-colors">
                  <td className="px-4 py-3 text-zinc-300">Mean Reciprocal Rank (MRR)</td>
                  <td className="px-4 py-3 text-white text-center">
                    {benchmarkResult.fastMRR.toFixed(3)}
                  </td>
                  <td className="px-4 py-3 text-white text-center">
                    {benchmarkResult.deepMRR.toFixed(3)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={benchmarkResult.delta > 0 ? 'text-emerald-400' : benchmarkResult.delta < 0 ? 'text-red-400' : 'text-zinc-500'}>
                      {benchmarkResult.delta > 0 ? '+' : ''}{benchmarkResult.delta.toFixed(3)}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
