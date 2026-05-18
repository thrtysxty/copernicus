import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { X, RotateCcw, Download, CheckSquare, Maximize2, Minimize2, Ghost, Check, X as CloseIcon, CaseSensitive, WholeWord, Regex, FileCode, SearchCode } from 'lucide-react'
import { EditorPanel } from './EditorPanel'
import { ImageViewer } from './ImageViewer'
import { BinaryBlocker } from './BinaryBlocker'
import { UIBuilderCanvas } from './ui-builder/UIBuilderCanvas'
import DiffPanel from './DiffPanel'
import { ContentPreview } from './ContentPreview'
import { useLayoutStore } from '../../store/layout'
import { classifyFile } from '../../utils/fileUtils'
import { useIpcError } from '../../hooks/useIpcError'
import { SharedPanelHeader } from '../layout/SharedPanelHeader'
import { unwrapIpc, IpcResult } from '../../types/ipc'
import { useMonaco } from '@monaco-editor/react'

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

interface CenterPanelRouterProps {
  filePath?: string | null
  content?: string
  language?: string
  onChange?: (value: string | undefined) => void
}

const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript',
  js: 'javascript', jsx: 'javascript',
  py: 'python', md: 'markdown', json: 'json',
  css: 'css', scss: 'css', less: 'css',
  html: 'html', htm: 'html',
  sh: 'shell', bash: 'shell', zsh: 'shell',
  sql: 'sql', yaml: 'yaml', yml: 'yaml',
  toml: 'plaintext', env: 'plaintext',
  graphql: 'graphql', gql: 'graphql',
  rs: 'rust', go: 'go', java: 'java',
  c: 'c', cpp: 'cpp', h: 'cpp',
  rb: 'ruby', php: 'php', swift: 'swift',
  kt: 'kotlin', dart: 'dart', lua: 'lua',
  xml: 'xml', svg: 'xml',
  dockerfile: 'dockerfile', makefile: 'makefile',
  lock: 'plaintext', patch: 'plaintext', diff: 'plaintext',
  log: 'plaintext', txt: 'plaintext', csv: 'plaintext',
}

const UI_EXTENSIONS = new Set(['.tsx', '.jsx', '.html', '.svg', '.css', '.scss'])
const isUIFile = (path: string | null) => {
  if (!path) return false
  const ext = '.' + path.split('.').pop()?.toLowerCase()
  return UI_EXTENSIONS.has(ext)
}

function getLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  return LANGUAGE_MAP[ext] ?? 'plaintext'
}

function CenterPanelHeader({
  ghostMode,
  setGhostMode,
  hasGhost,
  handleAcceptAll,
  handleRejectAll,
}: {
  ghostMode?: boolean
  setGhostMode?: (val: boolean) => void
  hasGhost?: boolean
  handleAcceptAll?: () => void
  handleRejectAll?: () => void
}) {
  const {
    openFiles, activeFilePath, setActiveFile, closeFile,
    setActiveFileContent, setActiveFileLanguage, setCenterMode,
    spotlightPane, setSpotlight, toggleFlip, activeView, activeStoryId,
    setStitchImportOpen, setStitchVerifyOpen
  } = useLayoutStore()
  const invoke = useIpcError()
  const monacoInstance = useMonaco()




  const isSpotlightActive = spotlightPane === 'editor'
  const showLsp = activeView === 'editor' || activeView === 'designer'

  const emptyTitle = (() => {
    if (!activeFilePath) return activeStoryId ? `STORY // ${activeStoryId.match(/\d+/)?.[0] ?? activeStoryId}` : 'EDITOR'
    const file = openFiles.find(f => f.path === activeFilePath)
    const name = activeFilePath.split('/').pop() ?? activeFilePath
    return file?.isDirty ? `${name} •` : name
  })()

  if (activeView === 'designer') {
    return (
      <SharedPanelHeader
        id="editor"
        name="DESIGNER"
        onRotate={() => toggleFlip('center-panel')}
      >
        <button
          onClick={() => setStitchImportOpen(true)}
          className="flex items-center gap-1.5 px-2 py-1 bg-[#0F0F0F] border border-zinc-800 rounded text-[9px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
        >
          <Download size={12} className="text-copernicus-phosphor" />
          <span className="translate-y-px">Import from Stitch</span>
        </button>
        {activeFilePath && (
          <button
            onClick={() => setStitchVerifyOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1 bg-[#0F0F0F] border border-zinc-800 rounded text-[9px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
          >
            <CheckSquare size={12} className="text-copernicus-phosphor" />
            <span className="translate-y-px">Verify with Stitch</span>
          </button>
        )}
      </SharedPanelHeader>
    )
  }

  return (
    <div className="h-8 flex items-center border-b border-copernicus-steel bg-[#0A0A0A] shrink-0">
      {/* Left: tabs or empty title */}
      <div className="flex-1 flex items-center overflow-x-auto no-scrollbar min-w-0 h-full">
        {openFiles.length > 0 ? (
          openFiles.map(file => {
            const isActive = activeFilePath === file.path
            const fileName = file.path.split('/').pop() ?? file.path
            return (
              <div
                key={file.path}
                onClick={async () => {
                  if (file.path === activeFilePath) return
                
                  // If Monaco already has a model for this file, switch with correct content instantly — no IPC
                  const existingModel = monacoInstance?.editor.getModel(
                    monacoInstance.Uri.parse(`file://${file.path}`)
                  )
                  if (existingModel) {
                    setActiveFileContent(existingModel.getValue())
                    setActiveFileLanguage(getLanguage(file.path))
                    setActiveFile(file.path)
                    const cl = classifyFile(file.path)
                    if (cl === 'binary') setCenterMode('binary')
                    else setCenterMode('code')
                    return
                  }
                
                  // First open — load from IPC, then switch so path and value change in the same render
                  try {
                    const result = await invoke<any>('fs:read-file', file.path)
                    const content = unwrapIpc<string>(result) || ''
                    setActiveFileContent(content)
                    setActiveFileLanguage(getLanguage(file.path))
                    setActiveFile(file.path)
                    const cl = classifyFile(file.path)
                    if (cl === 'binary') setCenterMode('binary')
                    else setCenterMode('code')
                  } catch (err) { console.warn("[Non-critical]", err) }
                }}
                className={`flex items-center gap-2 px-3 h-full border-r border-copernicus-steel cursor-pointer transition-all shrink-0 select-none group ${isActive ? 'bg-zinc-800 text-zinc-100 border-b border-copernicus-phosphor/70' : 'bg-[#0A0A0A] text-zinc-500 hover:text-zinc-300'}`}
              >
                <span className="text-[10px] font-mono truncate max-w-[150px]">
                  {fileName}{file.isDirty ? ' •' : ''}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); closeFile(file.path) }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-700 transition-all text-zinc-500 hover:text-zinc-100"
                >
                  <X size={10} />
                </button>
              </div>
            )
          })
        ) : (
          <span className="px-4 text-[10px] font-mono text-zinc-400 uppercase tracking-widest">{emptyTitle}</span>
        )}
      </div>

      {/* Right: inline search + panel controls */}
      <div className="flex items-center gap-1 px-2 shrink-0">


        {showLsp && setGhostMode && (
          <div className="flex items-center gap-1 border-r border-zinc-800 pr-2 mr-1">
            <button
              onClick={() => setGhostMode(!ghostMode)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                ghostMode ? 'bg-copernicus-phosphor text-[#050505] rounded-none' : 'text-zinc-600 hover:text-zinc-400'
              }`}
              title="Toggle Ghost Mode (Shadow Coding)"
            >
              <Ghost size={12} />
              <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline-block">Ghost</span>
            </button>
            
            {ghostMode && hasGhost && (
              <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2">
                <button
                  onClick={handleAcceptAll}
                  className="flex items-center gap-1 px-1.5 py-0.5 bg-copernicus-phosphor text-[#050505] rounded text-[9px] font-bold uppercase hover:opacity-90 transition-opacity"
                  title="Accept All Changes"
                >
                  <Check size={10} /> <span className="hidden md:inline-block">Accept</span>
                </button>
                <button
                  onClick={handleRejectAll}
                  className="flex items-center gap-1 px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded text-[9px] font-bold uppercase hover:bg-zinc-700 transition-colors"
                  title="Reject All Changes"
                >
                  <CloseIcon size={10} /> <span className="hidden md:inline-block">Reject</span>
                </button>
              </div>
            )}
          </div>
        )}


        <button
          onClick={() => toggleFlip('center-panel')}
          className="p-1.5 text-zinc-400 hover:text-zinc-300 transition-colors focus-visible:ring-2 focus-visible:ring-copernicus-phosphor focus-visible:outline-none"
          title="Flip Panel"
          aria-label="Flip Panel"
        >
          <RotateCcw size={12} />
        </button>
        <button
          onClick={() => setSpotlight(isSpotlightActive ? null : 'editor')}
          aria-pressed={isSpotlightActive}
          className={`p-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-copernicus-phosphor focus-visible:outline-none ${isSpotlightActive ? 'bg-copernicus-phosphor text-[#050505] rounded-none' : 'text-zinc-400 hover:text-zinc-300 rounded'}`}
          title="Spotlight"
          aria-label={isSpotlightActive ? 'Minimize Spotlight' : 'Maximize Spotlight'}
        >
          {isSpotlightActive ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
        </button>
      </div>
    </div>
  )
}

export function CenterPanelRouter({ 
  filePath: propFilePath, 
  content: propContent, 
  language: propLanguage, 
  onChange: propOnChange 
}: CenterPanelRouterProps) {
  const [ghostMode, setGhostMode] = useState(false)
  const [hasGhost, setHasGhost] = useState(false)
  const [ghostAction, setGhostAction] = useState<'accept' | 'reject' | null>(null)

  const activeFilePathForReset = useLayoutStore(s => s.activeFilePath)
  useEffect(() => {
    setGhostMode(false)
    setHasGhost(false)
    setGhostAction(null)
  }, [propFilePath, activeFilePathForReset])

  const handleAcceptAll = () => {
    setGhostAction('accept')
    setTimeout(() => setGhostAction(null), 100)
  }

  const handleRejectAll = () => {
    setGhostAction('reject')
    setTimeout(() => setGhostAction(null), 100)
  }

  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'text' | 'semantic'>('text')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [regex, setRegex] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [semanticResults, setSemanticResults] = useState<SemanticResult[]>([])
  const [loading, setLoading] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const invoke = useIpcError()
  const openFile = useLayoutStore(s => s.openFile)


  const handleSearch = useCallback(async () => {
    if (!query) return
    setLoading(true)
    try {
      if (mode === 'text') {
        const r = await invoke<IpcResult<SearchResult[]>>('codebase:text-search', {
          query, caseSensitive, regex, wholeWord
        })
        const res = unwrapIpc<SearchResult[]>(r) ?? []
        setResults(res)
        setSemanticResults([]) // Clear semantic results when doing text search
      } else {
        const r = await invoke<IpcResult<SemanticResult[]>>('codebase:semantic-search', {
          query, topK: 10
        })
        const res = unwrapIpc<SemanticResult[]>(r) ?? []
        setSemanticResults(res)
        setResults([]) // Clear text results when doing semantic search
      }
    } finally {
      setLoading(false)
    }
  }, [query, mode, caseSensitive, regex, wholeWord, invoke])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const {
    centerMode, setCenterMode, 
    activeView,
    canvasContent, canvasUrl,
    activeFilePath, activeFileContent, activeFileLanguage,
    setActiveFileContent, browserSessionActive,
    reviewMode,
  } = useLayoutStore()

  const filePath = activeFilePath ?? propFilePath ?? null
  const language = activeFilePath ? activeFileLanguage : (propLanguage ?? 'typescript')

  // Use a ref so effects can read centerMode without subscribing to it (prevents update loops)
  const centerModeRef = useRef(centerMode)
  centerModeRef.current = centerMode

  useEffect(() => {
    if (centerModeRef.current === 'builder' && !isUIFile(filePath)) {
      setCenterMode('code')
    }
  }, [filePath, setCenterMode])

  const groupedResults = useMemo(() => {
    return results.reduce((acc, curr) => {
      if (!acc[curr.file]) acc[curr.file] = []
      acc[curr.file]!.push(curr)
      return acc
    }, {} as Record<string, SearchResult[]>)
  }, [results])

  const renderedContent = useMemo(() => {
    if (reviewMode) {
      return <DiffPanel />
    }

    // Memoize these to avoid redundant re-renders of Monaco
    const content = activeFilePath ? activeFileContent : (propContent ?? '')
    const language = activeFilePath ? activeFileLanguage : (propLanguage ?? 'typescript')
    
    const onChange = activeFilePath 
      ? (val: string | undefined) => setActiveFileContent(val ?? '')
      : (propOnChange ?? (() => {}))

    if (centerMode === 'canvas') {
      if (browserSessionActive) {
        return <div className="h-full w-full flex items-center justify-center bg-zinc-900 font-mono text-zinc-400">Playwright: active</div>
      }

      if (filePath && (classifyFile(filePath) === 'canvas' || classifyFile(filePath) === 'svg')) {
         return <ImageViewer filePath={filePath} isSvg={classifyFile(filePath) === 'svg'} onEditSource={classifyFile(filePath) === 'svg' ? () => setCenterMode('code') : undefined} />
      }

      if (canvasContent || canvasUrl) {
        return <ContentPreview />
      }

      return <UIBuilderCanvas />
    }

    if (centerMode === 'builder') {
      if (!isUIFile(filePath)) {
        return (
          <div className="h-full flex items-center justify-center bg-[#050505]">
            <span className="text-[11px] font-mono text-zinc-600">Designer only available for UI files (.tsx, .jsx, .html, .svg, .css)</span>
          </div>
        )
      }
      return <UIBuilderCanvas />
    }

    if (!filePath) {
      return (
        <div className="h-full w-full flex items-center justify-center bg-copernicus-bg font-mono text-[10px] text-zinc-600">
          NO_FILE_SELECTED
        </div>
      )
    }

    switch (language) {
      case 'binary':
        return <BinaryBlocker filePath={filePath} />

      case 'svg':
        return centerMode === 'code'
          ? <EditorPanel key={filePath} content={content} language="xml" filePath={filePath} onChange={onChange} />
          : <ImageViewer filePath={filePath} isSvg onEditSource={() => setCenterMode('code')} />

      default:
        return (
          <EditorPanel 
            key={filePath} 
            content={content} 
            language={language} 
            filePath={filePath} 
            onChange={onChange}
            ghostMode={ghostMode}
            ghostAction={ghostAction}
            onGhostStatusChange={setHasGhost}
          />
        )
    }
  }, [reviewMode, activeFilePath, propFilePath, activeFileContent, propContent, activeFileLanguage, propLanguage, centerMode, browserSessionActive, canvasContent, canvasUrl, setActiveFileContent, propOnChange, setCenterMode, ghostMode, ghostAction])

  // FIX: When switching from Designer/other to Editor view, ensure centerMode is reset correctly
  useEffect(() => {
    if (activeView === 'editor' && (centerModeRef.current === 'canvas' || centerModeRef.current === 'builder')) {
      if (!filePath) {
        setCenterMode('code')
        return
      }
      const fileType = classifyFile(filePath)
      if (fileType === 'canvas') setCenterMode('canvas')
      else if (fileType === 'svg') setCenterMode('canvas')
      else if (fileType === 'binary') setCenterMode('binary')
      else setCenterMode('code')
    }
  }, [activeView, filePath, language, setCenterMode])

  useEffect(() => {
    if (centerModeRef.current === 'builder' || centerModeRef.current === 'canvas') return
    if (!filePath) {
      setCenterMode('code')
      return
    }
    if (language === 'svg') setCenterMode('canvas')
    else if (language === 'image') setCenterMode('canvas')
    else if (language === 'binary') setCenterMode('binary')
    else setCenterMode('code')
  }, [language, filePath, setCenterMode])

  return (
    <div className="flex flex-col h-full w-full overflow-hidden relative">
      <CenterPanelHeader
        ghostMode={ghostMode}
        setGhostMode={setGhostMode}
        hasGhost={hasGhost}
        handleAcceptAll={handleAcceptAll}
        handleRejectAll={handleRejectAll}
      />
      <div className="flex-1 overflow-hidden relative">
        {renderedContent}
      </div>

      {/* Search control row — permanent, replaces old search button position */}
      <div className="shrink-0 flex items-center gap-3 px-2 h-8 border-t border-copernicus-steel bg-[#0A0A0A]">
        {/* Mode toggle */}
        <div className="flex bg-zinc-900 rounded p-0.5 shrink-0">
          <button
            onClick={() => setMode('text')}
            className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-widest transition-colors ${mode === 'text' ? 'bg-copernicus-phosphor text-[#050505] font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}
          >Text</button>
          <button
            onClick={() => setMode('semantic')}
            className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-widest transition-colors ${mode === 'semantic' ? 'bg-copernicus-phosphor text-[#050505] font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}
          >Semantic</button>
        </div>
        {/* Search input */}
        <div className="flex-1 relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={mode === 'text' ? 'Search text…' : 'Ask codebase…'}
            className="w-full bg-zinc-950 border border-zinc-800 text-[10px] font-mono text-zinc-300 px-2 py-0.5 focus:outline-none focus:border-copernicus-phosphor placeholder-zinc-600"
          />
          {mode === 'text' && (
            <div className="absolute right-1 flex items-center gap-0.5">
              <button onClick={() => setCaseSensitive(!caseSensitive)} className={`p-0.5 rounded ${caseSensitive ? 'text-copernicus-phosphor' : 'text-zinc-600 hover:text-zinc-400'}`} title="Case sensitive"><CaseSensitive size={10} /></button>
              <button onClick={() => setWholeWord(!wholeWord)} className={`p-0.5 rounded ${wholeWord ? 'text-copernicus-phosphor' : 'text-zinc-600 hover:text-zinc-400'}`} title="Whole word"><WholeWord size={10} /></button>
              <button onClick={() => setRegex(!regex)} className={`p-0.5 rounded ${regex ? 'text-copernicus-phosphor' : 'text-zinc-600 hover:text-zinc-400'}`} title="Regex"><Regex size={10} /></button>
            </div>
          )}
        </div>
        {loading && <span className="text-[8px] text-zinc-600 animate-pulse shrink-0">searching…</span>}
        {query && <button onClick={() => { setQuery(''); setResults([]); setSemanticResults([]) }} className="text-zinc-600 hover:text-zinc-400 shrink-0"><X size={10} /></button>}
      </div>

      {query && (results.length > 0 || semanticResults.length > 0 || loading) && (
        <div 
          className="border-t border-copernicus-steel bg-[#080808] font-mono text-[10px] text-zinc-300 overflow-y-auto"
          style={{ maxHeight: '260px' }}
        >
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
      )}
    </div>
  )
}
