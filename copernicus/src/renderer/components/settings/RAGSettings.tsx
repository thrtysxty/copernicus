import React, { useState } from 'react'
import { Search, Loader2, Play, BarChart2 } from 'lucide-react'
import { useIpcError } from '../../hooks/useIpcError'

interface BenchmarkResult {
  fastMRR: number
  deepMRR: number
  delta: number
}

export const RAGSettings: React.FC = () => {
  const invoke = useIpcError()
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<BenchmarkResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleRunBenchmark = async () => {
    setIsRunning(true)
    setError(null)
    setResult(null)

    try {
      const res = await invoke('codebase:run-benchmark') as any
      if (res.ok) {
        setResult(res.data)
      } else {
        setError(res.error || 'Failed to run benchmark.')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
        <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
          <Search size={16} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-widest">RAG Performance</h2>
          <p className="text-[10px] text-zinc-500 font-mono mt-1">
            Benchmark Vector (Fast) vs Hybrid Vector+LSP (Deep) Retrieval Modes
          </p>
        </div>
      </div>

      <div className="bg-[#050505] border border-zinc-800 rounded p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-white tracking-widest">Run Validation Benchmark</h3>
            <p className="text-[10px] text-zinc-500 font-mono max-w-md leading-relaxed">
              Executes the gold-standard test queries against the codebase index.
              Calculates Mean Reciprocal Rank (MRR) for semantic-only search (Fast)
              and Reciprocal Rank Fusion of semantic and LSP symbol search (Deep).
            </p>
          </div>
          <button
            onClick={handleRunBenchmark}
            disabled={isRunning}
            className={`flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
              isRunning
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white border border-indigo-500/20 hover:border-indigo-500'
            }`}
          >
            {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            {isRunning ? 'Running...' : 'Run Benchmark'}
          </button>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-white tracking-widest">
              <BarChart2 size={14} className="text-indigo-400" />
              Benchmark Results
            </div>

            <div className="overflow-hidden border border-zinc-800 rounded-lg">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="bg-zinc-900 border-b border-zinc-800 text-zinc-400">
                    <th className="px-4 py-3 font-normal">Metric</th>
                    <th className="px-4 py-3 font-normal">Fast Mode (Vector)</th>
                    <th className="px-4 py-3 font-normal">Deep Mode (Hybrid)</th>
                    <th className="px-4 py-3 font-normal">Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 bg-[#080808]">
                  <tr className="hover:bg-zinc-900/50 transition-colors">
                    <td className="px-4 py-3 text-zinc-300">Mean Reciprocal Rank (MRR)</td>
                    <td className="px-4 py-3 text-white">
                      {result.fastMRR.toFixed(3)}
                    </td>
                    <td className="px-4 py-3 text-white">
                      {result.deepMRR.toFixed(3)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={result.delta > 0 ? 'text-emerald-400' : result.delta < 0 ? 'text-red-400' : 'text-zinc-500'}>
                        {result.delta > 0 ? '+' : ''}{result.delta.toFixed(3)}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-[10px] text-zinc-500 font-mono italic">
              * MRR ranges from 0.0 to 1.0 (higher is better). A value of 1.0 means the target file was always the 1st result.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
