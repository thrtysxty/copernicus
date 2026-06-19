import React, { useState, useEffect, useRef } from 'react'
import { Search, CaseSensitive, WholeWord, Regex, FileCode, SearchCode } from 'lucide-react'
import { useWorkspaceStore } from '../../store/layout'
import { useIpcError } from '../../hooks/useIpcError'
import { IpcResult, unwrapIpc } from '../../types/ipc'

interface SearchResult {
  file: string
  line: number
  col: number
  text: string
}

interface SemanticResult {
  path: string
  score: number
  content: string
}

export const SearchPanel: React.FC = () => {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'text' | 'semantic'>('text')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [regex, setRegex] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [semanticResults, setSemanticResults] = useState<SemanticResult[]>([])
  const [loading, setLoading] = useState(false)
  const [replace, setReplace] = useState('')
  
  const invoke = useIpcError()
  const openFile = useWorkspaceStore(s => s.openFile)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSearch = async () => {
    if (!query) return
    setLoading(true)
    try {
      if (mode === 'text') {
        const r = await invoke<IpcResult<SearchResult[]>>('codebase:text-search', {
          query, caseSensitive, regex, wholeWord
        })
        setResults(unwrapIpc(r) ?? [])
      } else {
        const r = await invoke<IpcResult<SemanticResult[]>>('codebase:semantic-search', {
          query, topK: 10
        })
        setSemanticResults(unwrapIpc(r) ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  const groupedResults = results.reduce((acc, curr) => {
    if (!acc[curr.file]) acc[curr.file] = []
    acc[curr.file]!.push(curr)
    return acc
  }, {} as Record<string, SearchResult[]>)

  return (
    <div data-testid="panel-search" className="flex flex-col h-full bg-[#050505] font-mono text-[10px] text-zinc-300">
      <div className="p-4 border-b border-copernicus-steel/20 shrink-0">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex bg-zinc-900 rounded p-0.5">
            <button
              onClick={() => setMode('text')}
              className={`px-3 py-1 rounded text-[9px] uppercase tracking-widest transition-colors ${mode === 'text' ? 'bg-copernicus-phosphor text-[#050505] font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Text
            </button>
            <button
              onClick={() => setMode('semantic')}
              className={`px-3 py-1 rounded text-[9px] uppercase tracking-widest transition-colors ${mode === 'semantic' ? 'bg-copernicus-phosphor text-[#050505] font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Semantic
            </button>
          </div>
        </div>

        <div className="relative mb-2">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={mode === 'text' ? "Search text..." : "Ask codebase..."}
            className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 pr-24 focus:outline-none focus:border-copernicus-phosphor"
          />
          {mode === 'text' && (
            <div className="absolute right-2 top-1.5 flex items-center gap-1">
              <button 
                onClick={() => setCaseSensitive(!caseSensitive)}
                className={`p-1 rounded ${caseSensitive ? 'bg-copernicus-phosphor/20 text-copernicus-phosphor' : 'text-zinc-600 hover:text-zinc-400'}`}
                title="Match Case"
              >
                <CaseSensitive size={12} />
              </button>
              <button 
                onClick={() => setWholeWord(!wholeWord)}
                className={`p-1 rounded ${wholeWord ? 'bg-copernicus-phosphor/20 text-copernicus-phosphor' : 'text-zinc-600 hover:text-zinc-400'}`}
                title="Whole Word"
              >
                <WholeWord size={12} />
              </button>
              <button 
                onClick={() => setRegex(!regex)}
                className={`p-1 rounded ${regex ? 'bg-copernicus-phosphor/20 text-copernicus-phosphor' : 'text-zinc-600 hover:text-zinc-400'}`}
                title="Regex"
              >
                <Regex size={12} />
              </button>
            </div>
          )}
        </div>

        {mode === 'text' && (
          <input
            type="text"
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            placeholder="Replace..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 mb-2 focus:outline-none focus:border-copernicus-phosphor"
          />
        )}

        <button
          onClick={handleSearch}
          disabled={loading || !query}
          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold py-1.5 rounded hover:bg-zinc-800 flex items-center justify-center gap-2"
        >
          {loading ? 'SEARCHING...' : <><Search size={12} /> SEARCH</>}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {mode === 'text' ? (
          <div className="space-y-4">
            {Object.keys(groupedResults).length === 0 && !loading && query && (
              <div className="text-zinc-600 italic">No matches found</div>
            )}
            {Object.entries(groupedResults).map(([file, matches]) => (
              <div key={file} className="space-y-1">
                <div className="flex items-center gap-2 text-zinc-400 font-bold mb-1">
                  <FileCode size={12} className="text-copernicus-phosphor/60" />
                  <span className="truncate">{file}</span>
                  <span className="text-[8px] bg-zinc-900 px-1 rounded text-zinc-600">{matches.length}</span>
                </div>
                {matches.map((m, i) => (
                  <div 
                    key={i} 
                    className="p-1.5 pl-6 hover:bg-zinc-900/50 cursor-pointer rounded flex flex-col gap-1"
                    onClick={() => openFile(m.file)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-600 text-[8px] w-6">L{m.line}</span>
                      <span className="text-zinc-300 truncate">{m.text}</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {semanticResults.length === 0 && !loading && query && (
              <div className="text-zinc-600 italic">No semantic matches found</div>
            )}
            {semanticResults.map((r, i) => (
              <div 
                key={i} 
                className="p-3 border border-zinc-800 rounded hover:border-zinc-700 cursor-pointer group"
                onClick={() => openFile(r.path)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <SearchCode size={12} className="text-copernicus-phosphor" />
                    <span className="text-zinc-300 font-bold">{r.path.split('/').pop()}</span>
                  </div>
                  <span className="text-[8px] text-zinc-600 uppercase tracking-tighter">Similarity: {Math.round(r.score * 100)}%</span>
                </div>
                <div className="text-zinc-500 text-[9px] line-clamp-3 bg-zinc-950 p-2 rounded group-hover:text-zinc-400">
                  {r.content}
                </div>
                <div className="text-[8px] text-zinc-700 mt-2 truncate">{r.path}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-2 border-t border-copernicus-steel/20 text-[8px] text-zinc-600 flex justify-between shrink-0">
        <span>MODE: {mode.toUpperCase()}</span>
        <span>{mode === 'text' ? results.length : semanticResults.length} RESULTS</span>
      </div>
    </div>
  )
}
