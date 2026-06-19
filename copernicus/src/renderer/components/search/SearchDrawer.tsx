import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Search, CaseSensitive, WholeWord, Regex, FileCode, SearchCode, X } from 'lucide-react'
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

export const SearchDrawer: React.FC = () => {
  const { searchDrawerOpen, setSearchDrawerOpen } = useWorkspaceStore()
  const openFile = useWorkspaceStore(s => s.openFile)

  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'text' | 'semantic'>('text')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [regex, setRegex] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [semanticResults, setSemanticResults] = useState<SemanticResult[]>([])
  const [loading, setLoading] = useState(false)
  
  const invoke = useIpcError()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searchDrawerOpen) {
      inputRef.current?.focus()
    }
  }, [searchDrawerOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setSearchDrawerOpen(true)
      }
      if (e.key === 'Escape' && searchDrawerOpen) {
        e.preventDefault()
        setSearchDrawerOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchDrawerOpen, setSearchDrawerOpen])

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return
    setLoading(true)
    try {
      if (mode === 'text') {
        const r = await invoke<IpcResult<SearchResult[]>>('codebase:text-search', {
          query, caseSensitive, regex, wholeWord
        })
        setResults(unwrapIpc<SearchResult[]>(r) ?? [])
      } else {
        const r = await invoke<IpcResult<SemanticResult[]>>('codebase:semantic-search', {
          query, topK: 10
        })
        setSemanticResults(unwrapIpc<SemanticResult[]>(r) ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [query, mode, caseSensitive, regex, wholeWord, invoke])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setSemanticResults([])
      return
    }
    const id = setTimeout(handleSearch, mode === 'text' ? 300 : 600)
    return () => clearTimeout(id)
  }, [query, mode, caseSensitive, regex, wholeWord, handleSearch])

  const groupedResults = results.reduce((acc, curr) => {
    if (!acc[curr.file]) acc[curr.file] = []
    acc[curr.file]!.push(curr)
    return acc
  }, {} as Record<string, SearchResult[]>)

  return (
    <div 
      className={`absolute bottom-0 left-0 right-0 bg-[#080808] border-t border-copernicus-steel z-50 transition-transform duration-200 ease-out flex flex-col font-mono text-[10px] text-zinc-300 shadow-2xl ${
        searchDrawerOpen ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{ height: '300px' }}
    >
      <div className="flex items-center justify-between p-2 border-b border-copernicus-steel/20 bg-[#0A0A0A] shrink-0">
        <div className="flex items-center gap-4 flex-1">
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

          <div className="relative flex-1 max-w-xl flex items-center gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); handleSearch() } }}
                placeholder={mode === 'text' ? "Search text..." : "Ask codebase..."}
                className="w-full bg-zinc-950 border border-zinc-800 rounded p-1.5 pl-2 pr-20 focus:outline-none focus:border-copernicus-phosphor"
              />
              {mode === 'text' && (
                <div className="absolute right-1 top-1 flex items-center gap-0.5">
                  <button 
                    onClick={() => setCaseSensitive(!caseSensitive)}
                    className={`p-1 rounded ${caseSensitive ? 'bg-copernicus-phosphor/20 text-copernicus-phosphor' : 'text-zinc-600 hover:text-zinc-400'}`}
                    title="Match Case"
                  >
                    <CaseSensitive size={10} />
                  </button>
                  <button 
                    onClick={() => setWholeWord(!wholeWord)}
                    className={`p-1 rounded ${wholeWord ? 'bg-copernicus-phosphor/20 text-copernicus-phosphor' : 'text-zinc-600 hover:text-zinc-400'}`}
                    title="Whole Word"
                  >
                    <WholeWord size={10} />
                  </button>
                  <button 
                    onClick={() => setRegex(!regex)}
                    className={`p-1 rounded ${regex ? 'bg-copernicus-phosphor/20 text-copernicus-phosphor' : 'text-zinc-600 hover:text-zinc-400'}`}
                    title="Regex"
                  >
                    <Regex size={10} />
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleSearch}
              disabled={loading || !query}
              className="bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold px-4 py-1.5 rounded hover:bg-zinc-800 flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
            >
              {loading ? 'SEARCHING...' : <><Search size={12} /> SEARCH</>}
            </button>
          </div>
        </div>
        <button 
          onClick={() => setSearchDrawerOpen(false)}
          className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300 ml-4"
          title="Close (Esc)"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {mode === 'text' ? (
          <div className="space-y-2">
            {Object.keys(groupedResults).length === 0 && !loading && query && (
              <div className="text-zinc-600 italic px-2">No matches found</div>
            )}
            {Object.entries(groupedResults).map(([file, matches]) => (
              <div key={file} className="space-y-0.5">
                <div className="flex items-center gap-2 text-zinc-400 font-bold px-2 py-1 bg-zinc-900/50 rounded sticky top-0">
                  <FileCode size={12} className="text-copernicus-phosphor/60" />
                  <span className="truncate">{file}</span>
                  <span className="text-[8px] bg-zinc-800 px-1 rounded text-zinc-500">{matches.length}</span>
                </div>
                {matches.map((m, i) => (
                  <div 
                    key={i} 
                    className="px-2 py-1 pl-6 hover:bg-zinc-900 cursor-pointer rounded flex flex-col gap-1 transition-colors group"
                    onClick={() => openFile(m.file)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-600 text-[8px] w-6 group-hover:text-copernicus-phosphor/70">L{m.line}</span>
                      <span className="text-zinc-300 truncate font-mono">{m.text}</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2 max-w-4xl">
            {semanticResults.length === 0 && !loading && query && (
              <div className="text-zinc-600 italic px-2">No semantic matches found</div>
            )}
            {semanticResults.map((r, i) => (
              <div 
                key={i} 
                className="p-2 border border-zinc-800 rounded hover:border-zinc-700 cursor-pointer group hover:bg-zinc-900/30 transition-colors"
                onClick={() => openFile(r.path)}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <SearchCode size={12} className="text-copernicus-phosphor" />
                    <span className="text-zinc-300 font-bold">{r.path.split('/').pop()}</span>
                    <span className="text-[8px] text-zinc-600 truncate">{r.path}</span>
                  </div>
                  <span className="text-[8px] text-zinc-500 uppercase tracking-tighter">Similarity: {Math.round(r.score * 100)}%</span>
                </div>
                <div className="text-zinc-400 text-[9px] line-clamp-2 pl-5">
                  {r.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-3 py-1 border-t border-copernicus-steel/20 text-[8px] text-zinc-600 flex justify-between shrink-0 bg-[#050505]">
        <span>MODE: {mode.toUpperCase()}</span>
        <span>{mode === 'text' ? results.length : semanticResults.length} RESULTS</span>
      </div>
    </div>
  )
}
