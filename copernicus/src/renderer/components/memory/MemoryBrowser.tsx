import log from '../../utils/logger'
import React, { useState, useEffect } from 'react'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc, IpcResult } from '../../types/ipc'
import { MemoryRow } from '../../types/memory'
import { useLayoutStore } from '../../store/layout'
import { RefreshCw, Brain, File as FileIcon } from 'lucide-react'

const importanceBadgeColor = (n: number) =>
  n >= 9 ? 'bg-green-500/20 text-green-400' :
  n >= 7 ? 'bg-amber-500/20 text-amber-400' :
  n >= 4 ? 'bg-blue-500/20 text-blue-400' :
           'bg-zinc-800 text-zinc-500'

const relativeTime = (ts: number) => {
  const diff = Date.now() - (ts * 1000)
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

const eventTypeBorderColor = (type: string) => {
  switch (type) {
    case 'memory_fact': return 'border-l-copernicus-phosphor'
    case 'file_edit': return 'border-l-amber-500'
    case 'git_commit': return 'border-l-green-500'
    case 'tool_call': return 'border-l-zinc-500'
    case 'decision': return 'border-l-blue-500'
    default: return 'border-l-zinc-700'
  }
}

export const MemoryBrowser: React.FC<{ hideHeader?: boolean }> = ({ hideHeader = false }) => {
  const invoke = useIpcError()
  const [memories, setMemories] = useState<MemoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBankId, setSelectedBankId] = useState<string>('')
  const [expandedFileMenu, setExpandedFileMenu] = useState<string | null>(null)
  
  const activeFilePath = useLayoutStore(s => s.activeFilePath)
  const [fileHistoryMode, setFileHistoryMode] = useState(false)

  const handleOpenFile = async (path: string) => {
    try {
      await invoke('fs:open-file', { path })
    } catch (err) {
      log.error('Failed to open file:', err)
    }
  }

  const handleRowClick = (m: MemoryRow, e: React.MouseEvent) => {
    // Only navigate if clicking on the main row, not within a dropdown menu
    if ((e.target as HTMLElement).closest('.file-menu')) return;

    if (m.eventType === 'file_edit' && m.meta?.file) {
      handleOpenFile(m.meta.file)
    } else if (m.eventType === 'git_commit' && m.meta?.files && Array.isArray(m.meta.files)) {
      if (m.meta.files.length === 1) {
        handleOpenFile(m.meta.files[0])
      } else if (m.meta.files.length > 1) {
        setExpandedFileMenu(expandedFileMenu === m.id ? null : m.id)
      }
    }
  }

  const isRowClickable = (m: MemoryRow) => {
    if (m.eventType === 'file_edit' && m.meta?.file) return true;
    if (m.eventType === 'git_commit' && m.meta?.files?.length > 0) return true;
    return false;
  }

  const fetchMemories = async () => {
    setLoading(true)
    try {
      const rootRes = await invoke<IpcResult<string>>('app:get-root-path')
      const rootPath = unwrapIpc<string>(rootRes) || 'default'
      
      const res = await invoke<IpcResult<MemoryRow[]>>('memory:get-working-set', rootPath, selectedBankId || undefined, 50)
      const fetchedMemories = unwrapIpc<MemoryRow[]>(res) ?? []
      
      let filteredMemories = fetchedMemories.sort((a, b) => b.score - a.score)
      
      if (fileHistoryMode && activeFilePath) {
        filteredMemories = filteredMemories.filter(m => 
          m.meta?.file === activeFilePath || 
          (Array.isArray(m.meta?.files) && m.meta.files.includes(activeFilePath))
        )
      }
      
      setMemories(filteredMemories)
    } catch (err) { console.warn("[Non-critical]", err) } finally { setLoading(false) }
  }

  useEffect(() => { fetchMemories() }, [selectedBankId, fileHistoryMode, activeFilePath])

  return (
    <div className="flex flex-col h-full bg-[#050505] text-zinc-300 font-mono">
      {!hideHeader && (
        <div className="h-8 flex items-center justify-between px-3 border-b border-white/5 bg-black/20 shrink-0">
          <div className="flex items-center gap-2">
            <Brain size={11} className="text-copernicus-phosphor" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Agent Memory</span>
          </div>
          <button onClick={fetchMemories} className="text-zinc-600 hover:text-zinc-300 transition-colors opacity-60 hover:opacity-100" title="Refresh">
            <RefreshCw size={11} />
          </button>
        </div>
      )}

      <div className="px-3 py-2 border-b border-white/5 space-y-2 shrink-0">
        <div className="flex items-center gap-2">
          <select
            value={selectedBankId}
            onChange={(e) => setSelectedBankId(e.target.value)}
            className="bg-zinc-900 border border-white/10 text-[10px] text-zinc-300 rounded px-2 py-1 outline-none focus:border-copernicus-phosphor w-full"
          >
            <option value="">All</option>
            <option value="chat">chat</option>
            <option value="orchestrator">orchestrator</option>
            <option value="workflow:*">workflow:*</option>
            <option value="agent:*">agent:*</option>
          </select>
        </div>
        {activeFilePath && (
          <div className="flex items-center gap-2 pt-1 border-t border-white/5">
            <button
              onClick={() => setFileHistoryMode(!fileHistoryMode)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-bold tracking-wide transition-colors ${
                fileHistoryMode 
                  ? 'bg-copernicus-phosphor text-[#050505] rounded-none' 
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
              }`}
              title={`Show history for ${activeFilePath.split('/').pop()}`}
            >
              <FileIcon size={10} />
              HISTORY FOR THIS FILE
            </button>
            {fileHistoryMode && (
              <span className="text-[8px] text-zinc-500 truncate max-w-[150px]" title={activeFilePath}>
                {activeFilePath.split('/').pop()}
              </span>
            )}
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-zinc-800">
        {loading && <p className="text-[9px] text-zinc-700 italic">Loading...</p>}
        {!loading && memories.length === 0 && (
          <p className="text-[9px] text-zinc-700 italic">No memories yet. Save insights from chat sessions using the "Save to Memory" button.</p>
        )}
        {memories.map(m => (
          <div 
            key={m.id} 
            className={`p-2 bg-zinc-900/50 border border-white/5 border-l-2 ${eventTypeBorderColor(m.eventType)} rounded space-y-1 transition-colors relative group ${isRowClickable(m) ? 'cursor-pointer hover:bg-zinc-800/80' : ''}`}
            onClick={(e) => handleRowClick(m, e)}
          >
            <div className="flex items-center gap-2">
              <span className={`px-1 py-0.5 rounded text-[7px] font-bold ${importanceBadgeColor(m.importance)}`}>{m.importance}</span>
              <span className="text-[8px] text-zinc-400 bg-black/20 px-1 py-0.5 rounded border border-white/5 truncate max-w-[80px]" title={m.bankId}>{m.bankId}</span>
              <span className="ml-auto text-[8px] text-zinc-700">{relativeTime(m.ts)}</span>
            </div>
            <p className="text-[9px] text-zinc-300 leading-relaxed break-words" title={m.content}>
              {m.content.length > 120 ? `${m.content.substring(0, 120)}...` : m.content}
            </p>
            {expandedFileMenu === m.id && m.eventType === 'git_commit' && m.meta?.files && (
              <div className="file-menu mt-2 pt-2 border-t border-white/5 space-y-1">
                <span className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest mb-1 block">Files Changed</span>
                {m.meta.files.map((f: string, i: number) => (
                  <div 
                    key={i} 
                    className="flex items-center gap-2 text-[9px] text-zinc-400 hover:text-zinc-200 hover:bg-white/5 px-2 py-1 rounded cursor-pointer transition-colors"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOpenFile(f)
                    }}
                  >
                    <FileIcon size={10} className="opacity-50" />
                    <span className="truncate">{f}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
