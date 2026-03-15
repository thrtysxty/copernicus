import React, { useEffect, useRef, useMemo } from 'react'
import { Search, Trash2, Pause, Play } from 'lucide-react'
import { useLogViewerStore } from '../../store/logViewer'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc } from '../../types/ipc'
import { LogLine } from '../../../../electron/debug/LogTailer'

export const LogViewer: React.FC = () => {
  const invoke = useIpcError()
  const { 
    logs, addLog, setLogs, sources, enabledSources, toggleSource,
    minLevel, setMinLevel, searchQuery, setSearchQuery,
    isPaused, setPaused, clearLogs 
  } = useLogViewerStore()
  
  const scrollRef = useRef<HTMLDivElement>(null)
  const [shouldAutoScroll, setShouldAutoScroll] = React.useState(true)

  useEffect(() => {
    // Initial fetch
    invoke<any>('log:get-history').then(res => {
      const history = unwrapIpc<LogLine[]>(res)
      if (history) setLogs(history)
    })

    // Listen for new lines
    const cleanup = window.ipcRenderer.on('log:new-line', (_e, line: any) => {
      addLog(line as LogLine)
    })

    return () => { cleanup() }
  }, [invoke, addLog, setLogs])

  useEffect(() => {
    if (shouldAutoScroll && scrollRef.current && !isPaused) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, shouldAutoScroll, isPaused])

  const filteredLogs = useMemo(() => {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR']
    const minIdx = levels.indexOf(minLevel)
    
    return logs.filter(log => {
      if (!enabledSources.has(log.source)) return false
      if (levels.indexOf(log.level) < minIdx) return false
      if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !log.source.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }
      return true
    })
  }, [logs, enabledSources, minLevel, searchQuery])

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const atBottom = scrollHeight - scrollTop - clientHeight < 20
    setShouldAutoScroll(atBottom)
  }

  const copyLine = (log: LogLine) => {
    const text = `[${log.timestamp}] [${log.level}] [${log.source}] ${log.message}`
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="flex flex-col h-full bg-[#050505] text-zinc-300 font-mono text-[11px] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 p-2 border-b border-copernicus-steel bg-[#0A0A0A] shrink-0">
        <div className="flex items-center gap-1.5 px-2 bg-black/40 border border-zinc-800 rounded h-7 w-48">
          <Search size={12} className="text-zinc-600" />
          <input 
            type="text" 
            placeholder="Search logs..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none w-full text-zinc-300 placeholder:text-zinc-700"
          />
        </div>

        <div className="flex items-center gap-1 border-l border-zinc-800 pl-3">
          {sources.map(src => (
            <button
              key={src}
              onClick={() => toggleSource(src)}
              className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-colors ${
                enabledSources.has(src) ? 'bg-zinc-800 text-copernicus-phosphor' : 'text-zinc-600 hover:text-zinc-400'
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
              onClick={() => setMinLevel(lvl)}
              className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-colors ${
                minLevel === lvl ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setPaused(!isPaused)}
            className={`p-1.5 rounded hover:bg-zinc-800 transition-colors ${isPaused ? 'text-amber-500 bg-amber-500/10' : 'text-zinc-500'}`}
            title={isPaused ? "Resume" : "Pause"}
          >
            {isPaused ? <Play size={14} /> : <Pause size={14} />}
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

      {/* Log list */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto p-2 space-y-0.5 scrollbar-thin scrollbar-thumb-zinc-800"
      >
        {filteredLogs.map((log, i) => (
          <div 
            key={i} 
            className="group flex gap-3 hover:bg-zinc-900/50 px-1 py-0.5 rounded cursor-pointer select-text"
            onContextMenu={(e) => { e.preventDefault(); copyLine(log); }}
            title="Right-click to copy"
          >
            <span className="text-zinc-600 shrink-0 select-none">[{log.timestamp}]</span>
            <span className={`w-12 shrink-0 font-bold ${
              log.level === 'ERROR' ? 'text-red-500' :
              log.level === 'WARN' ? 'text-amber-500' :
              'text-blue-400'
            }`}>[{log.level}]</span>
            <span className="text-zinc-500 shrink-0 w-24 truncate select-none">[{log.source.toUpperCase()}]</span>
            <span className="text-zinc-300 break-all">{log.message}</span>
          </div>
        ))}
        {filteredLogs.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-zinc-600 italic">
            {logs.length === 0 ? 'No logs captured yet...' : 'No logs match current filters.'}
          </div>
        )}
      </div>
    </div>
  )
}
