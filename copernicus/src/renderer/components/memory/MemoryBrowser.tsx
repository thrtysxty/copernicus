import React, { useState, useEffect } from 'react'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc, IpcResult } from '../../types/ipc'
import { RefreshCw, Brain } from 'lucide-react'

interface MemoryEntry {
  id: string
  content: string
  importance: number
  source: string
  created_at: number
}

const importanceBadgeColor = (n: number) =>
  n >= 9 ? 'bg-green-500/20 text-green-400' :
  n >= 7 ? 'bg-amber-500/20 text-amber-400' :
  n >= 4 ? 'bg-blue-500/20 text-blue-400' :
           'bg-zinc-800 text-zinc-500'

const relativeTime = (ts: number) => {
  const diff = Date.now() - ts
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

export const MemoryBrowser: React.FC = () => {
  const invoke = useIpcError()
  const [memories, setMemories] = useState<MemoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMemories = async () => {
    setLoading(true)
    try {
      const res = await invoke<IpcResult<MemoryEntry[]>>('db:search-memory', 20)
      setMemories(unwrapIpc<MemoryEntry[]>(res) ?? [])
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { fetchMemories() }, [])

  return (
    <div className="flex flex-col h-full bg-[#050505] text-zinc-300 font-mono">
      <div className="h-8 flex items-center justify-between px-3 border-b border-white/5 bg-black/20 shrink-0">
        <div className="flex items-center gap-2">
          <Brain size={11} className="text-copernicus-phosphor" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Agent Memory</span>
        </div>
        <button onClick={fetchMemories} className="text-zinc-600 hover:text-zinc-300 transition-colors opacity-60 hover:opacity-100" title="Refresh">
          <RefreshCw size={11} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-zinc-800">
        {loading && <p className="text-[9px] text-zinc-700 italic">Loading...</p>}
        {!loading && memories.length === 0 && (
          <p className="text-[9px] text-zinc-700 italic">No memories yet. Save insights from chat sessions using the "Save to Memory" button.</p>
        )}
        {memories.map(m => (
          <div key={m.id} className="p-2 bg-zinc-900/50 border border-white/5 rounded space-y-1">
            <div className="flex items-center gap-2">
              <span className={`px-1 py-0.5 rounded text-[7px] font-bold ${importanceBadgeColor(m.importance)}`}>{m.importance}</span>
              <span className="text-[8px] text-zinc-600 uppercase">{m.source}</span>
              <span className="ml-auto text-[8px] text-zinc-700">{relativeTime(m.created_at)}</span>
            </div>
            <p className="text-[9px] text-zinc-400 leading-relaxed line-clamp-2">{m.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
