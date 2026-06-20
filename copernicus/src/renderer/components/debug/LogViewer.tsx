import React, { useEffect, useMemo } from 'react'
import { Search, Trash2, Pause, Play } from 'lucide-react'
import { useLogViewerStore } from '../../store/logViewer'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc } from '../../types/ipc'
import { LogEntry } from '../../../../electron/debug/LogTailer'

export const LogViewer: React.FC = () => {
  const invoke = useIpcError()
  const { 
    entries, addLog, setEntries, sources, enabledSources, toggleSource,
    level, setLevel, search, setSearch,
    paused, setPaused, clearLogs 
  } = useLogViewerStore()
  
  useEffect(() => {
    // Initial fetches
    invoke<any>('log:list-sources').then(res => {
      unwrapIpc<string[]>(res)
      // sources are already initialized in store, but we could update if they changed
    })

    invoke<any>('log:get-history', 200).then(res => {
      const history = unwrapIpc<LogEntry[]>(res)
      if (history) setEntries(history)
    })

    // Listen for new lines (Story 386 push channel log:line)
    const cleanup = window.ipcRenderer.on('log:line', (_e, entry: any) => {
      addLog(entry as LogEntry)
    })

    return () => { cleanup() }
  }, [invoke, addLog, setEntries])

  const filteredLogs = useMemo(() => {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR']
    const minIdx = level ? levels.indexOf(level) : -1
    
    return entries.filter(log => {
      if (!enabledSources.has(log.source)) return false
      if (level && levels.indexOf(log.level) < minIdx) return false
      if (search && !log.message.toLowerCase().includes(search.toLowerCase()) && 
          !log.source.toLowerCase().includes(search.toLowerCase())) {
        return false
      }
      return true
    })
  }, [entries, enabledSources, level, search])

  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return text
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'))
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === highlight.toLowerCase() 
            ? <mark key={i} className="bg-copernicus-phosphor text-[#050505]">{part}</mark> 
            : part
        )}
      </>
    )
  }

  const copyLine = (log: LogEntry) => {
    const text = `[${log.timestamp}] [${log.level}] [${log.source}] ${log.message}`
    navigator.clipboard.writeText(text)
  }

  return (
    <div data-testid="panel-logs" className="flex flex-col h-full bg-[#050505] text-zinc-300 font-mono text-[11px] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 p-2 border-b border-zinc-800 bg-[#0A0A0A] shrink-0">
        <div className="flex items-center gap-1.5 px-2 bg-black/40 border border-zinc-800 rounded h-7 w-48">
          <Search size={12} className="text-zinc-600" />
          <input 
            type="text" 
            placeholder="Search logs..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none w-full text-zinc-300 placeholder:text-zinc-700"
          />
        </div>

        <div className="flex items-center gap-1 border-l border-zinc-800 pl-3">
          {sources.map(src => (
            <button
              key={src}
              onClick={() => toggleSource(src)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider transition-colors ${
                enabledSources.has(src) ? 'bg-copernicus-phosphor text-[#050505] rounded-none' : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              {src}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 border-l border-zinc-800 pl-3">
          {(['INFO', 'WARN', 'ERROR'] as const).map(lvl => (
            <button
              key={lvl}
              onClick={() => setLevel(level === lvl ? null : lvl)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider transition-colors ${
                level === lvl ? 'bg-copernicus-phosphor text-[#050505] rounded-none' : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setPaused(!paused)}
            className={`p-1.5 rounded hover:bg-zinc-800 transition-colors ${paused ? 'text-amber-500 bg-amber-500/10' : 'text-zinc-500'}`}
            title={paused ? "Resume" : "Pause"}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
          <button 
            onClick={clearLogs}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 transition-colors"
            title="Clear Buffer"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Log list - latest on bottom or top? entries are [entry, ...entries] so index 0 is newest. 
          If we want newest at bottom, we need to .reverse() for display or just keep it as is.
          Common log viewers have newest at bottom.
      */}
      <div 
        className="flex-1 overflow-auto p-2 space-y-0.5 scrollbar-thin scrollbar-thumb-zinc-800 flex flex-col-reverse"
      >
        <div className="flex flex-col gap-0.5">
          {filteredLogs.slice().reverse().map((log) => (
            <div 
              key={log.id} 
              className="group flex gap-3 hover:bg-zinc-900/50 px-1 py-0.5 rounded cursor-pointer select-text"
              onContextMenu={(e) => { e.preventDefault(); copyLine(log); }}
              title="Right-click to copy"
            >
              <span className="text-zinc-600 shrink-0 select-none">[{log.timestamp}]</span>
              <span className={`w-12 shrink-0 font-bold ${
                log.level === 'ERROR' ? 'text-red-500' :
                log.level === 'WARN' ? 'text-amber-500' :
                log.level === 'DEBUG' ? 'text-zinc-500' :
                'text-blue-400'
              }`}>[{log.level}]</span>
              <span className="text-zinc-500 shrink-0 w-24 truncate select-none">[{log.source.toUpperCase()}]</span>
              <span className="text-zinc-300 break-all">{highlightText(log.message, search)}</span>
            </div>
          ))}
          {filteredLogs.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center text-zinc-600 italic">
              {entries.length === 0 ? 'No logs captured yet...' : 'No logs match current filters.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
