import { useEffect, useState } from 'react'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc, IpcResult } from '../../types/ipc'
import { Trophy, ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

interface LeaderboardRow {
  provider: string
  model_id: string
  composite_score: number
  total_calls: number
  avg_latency: number
  total_cost: number
  approval_rate: number
}

type SortField = keyof LeaderboardRow
type SortDir = 'asc' | 'desc'

export function ModelLeaderboard({ days }: { days: number | 'all' }) {
  const [data, setData] = useState<LeaderboardRow[]>([])
  const [sortField, setSortField] = useState<SortField>('composite_score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const invoke = useIpcError()

  useEffect(() => {
    let active = true
    invoke<IpcResult<LeaderboardRow[]>>('ledger:leaderboard', days).then(res => {
      if (active && (res as any).ok && (res as any).data) {
        setData(unwrapIpc<LeaderboardRow[]>(res as any))
      }
    })
    return () => { active = false }
  }, [days, invoke])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const sortedData = [...data].sort((a, b) => {
    let aVal = a[sortField]
    let bVal = b[sortField]
    
    // Sort strings
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      const cmp = aVal.localeCompare(bVal)
      return sortDir === 'asc' ? cmp : -cmp
    }
    
    // Sort numbers
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={10} className="text-zinc-700 inline ml-1" />
    return sortDir === 'asc' ? <ArrowUp size={10} className="text-copernicus-phosphor inline ml-1" /> : <ArrowDown size={10} className="text-copernicus-phosphor inline ml-1" />
  }

  return (
    <div className="flex flex-col h-full bg-[#050505] p-6 pb-2 overflow-hidden gap-6">
      <div className="flex items-center gap-3">
        <Trophy size={18} className="text-copernicus-phosphor" />
        <h2 className="text-sm font-bold tracking-widest text-zinc-200">MODEL LEADERBOARD</h2>
        <span className="text-xs text-zinc-500 font-mono">({sortedData.length} active models)</span>
      </div>

      <div className="flex-1 overflow-auto border border-zinc-800">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-[#0A0A0A] z-10 border-b border-zinc-800">
            <tr>
              {([
                { id: 'provider', label: 'PROVIDER' },
                { id: 'model_id', label: 'MODEL' },
                { id: 'composite_score', label: 'COMPOSITE QS' },
                { id: 'total_calls', label: 'CALLS' },
                { id: 'avg_latency', label: 'AVG LATENCY' },
                { id: 'total_cost', label: 'TOTAL COST' },
                { id: 'approval_rate', label: 'APPROVAL' }
              ] as const).map(col => (
                <th 
                  key={col.id} 
                  className="p-3 text-[10px] tracking-widest text-zinc-500 font-bold uppercase cursor-pointer hover:bg-zinc-900/50 transition-colors whitespace-nowrap"
                  onClick={() => handleSort(col.id as SortField)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    <SortIcon field={col.id as SortField} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {sortedData.map((row, i) => (
              <tr key={row.model_id} className="hover:bg-zinc-900/20 group">
                <td className="p-3 text-xs text-zinc-400 capitalize">{row.provider}</td>
                <td className="p-3">
                  <span className="font-mono text-xs text-zinc-200">{row.model_id}</span>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-sm font-bold ${
                      i === 0 ? 'text-copernicus-phosphor' : 'text-zinc-200'
                    }`}>
                      {row.composite_score}
                    </span>
                    <div className="w-16 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${i === 0 ? 'bg-copernicus-phosphor' : 'bg-zinc-500'}`} 
                        style={{ width: `${Math.max(0, Math.min(100, row.composite_score))}%` }} 
                      />
                    </div>
                  </div>
                </td>
                <td className="p-3 font-mono text-xs text-zinc-400">{row.total_calls.toLocaleString()}</td>
                <td className="p-3 font-mono text-xs text-zinc-400">{row.avg_latency}ms</td>
                <td className="p-3 font-mono text-xs text-zinc-400">${row.total_cost.toFixed(4)}</td>
                <td className="p-3 font-mono text-xs text-zinc-400">{row.approval_rate}%</td>
              </tr>
            ))}
            {sortedData.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-zinc-500 text-xs font-mono">
                  No model calls recorded in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
