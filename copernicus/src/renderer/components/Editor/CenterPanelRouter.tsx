import { useState, useEffect, useMemo } from 'react'
import { X, RotateCcw, Maximize2, Minimize2, Ghost, Check, X as CloseIcon } from 'lucide-react'
import { EditorPanel } from './EditorPanel'
import { ImageViewer } from './ImageViewer'
import { BinaryBlocker } from './BinaryBlocker'
import { UIBuilderCanvas } from './ui-builder/UIBuilderCanvas'
import DiffPanel from './DiffPanel'
import { ContentPreview } from './ContentPreview'
import { useLayoutStore } from '../../store/layout'
import { SearchDrawer } from '../search/SearchDrawer'
import { Search } from 'lucide-react'
import { classifyFile } from '../../utils/fileUtils'
import { useIpcError } from '../../hooks/useIpcError'
import { SharedPanelHeader } from '../layout/SharedPanelHeader'
import { unwrapIpc, IpcResult, LspStatusResponse } from '../../types/ipc'

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
  handleRejectAll
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
    spotlightPane, setSpotlight, toggleFlip, activeView, activeStoryId
  } = useLayoutStore()
  const invoke = useIpcError()
  const [lspRunning, setLspRunning] = useState(false)
  const [lspPopoverOpen, setLspPopoverOpen] = useState(false)
  const [errorCount, setErrorCount] = useState(0)
  const [warnCount, setWarnCount] = useState(0)

  useEffect(() => {
    invoke<IpcResult<LspStatusResponse>>('lsp:status').then((res) => {
      if (res?.ok && res.data) setLspRunning(res.data.running ?? false)
    }).catch(() => {})
    const removeDiag = window.ipcRenderer.on(
      'lsp:diagnostics-update',
      (_e: any, { uri, diagnostics }: { uri: string; diagnostics: { severity: number }[] }) => {
        if (!activeFilePath || `file://${activeFilePath}` !== uri) return
        let errors = 0, warnings = 0
        diagnostics.forEach((d) => { if (d.severity === 1) errors++; if (d.severity === 2) warnings++ })
        setErrorCount(errors)
        setWarnCount(warnings)
      }
    )
    return () => removeDiag()
  }, [invoke, activeFilePath])

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
        {showLsp && (
          <div className="relative">
            <button
              aria-label="LSP status"
              className="flex items-center gap-1.5 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 cursor-pointer hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-copernicus-phosphor focus-visible:outline-none"
              onClick={() => setLspPopoverOpen(v => !v)}
            >
              <span className={`text-[8px] ${lspRunning ? 'text-green-500' : 'text-red-500'}`}>◉</span>
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">LSP {errorCount}E {warnCount}W</span>
            </button>
            {lspPopoverOpen && (
              <div
                className="absolute top-8 right-0 z-50 bg-[#0d0d0d] border border-copernicus-steel/40 rounded shadow-2xl p-3 w-56 font-mono"
                onMouseLeave={() => setLspPopoverOpen(false)}
              >
                <div className="text-[9px] text-zinc-500 uppercase tracking-wider mb-2">Language Server</div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${lspRunning ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-[10px] text-zinc-300">{lspRunning ? 'Connected' : 'Disconnected'}</span>
                </div>
                <div className="text-[9px] text-zinc-600 mt-2">{errorCount}E · {warnCount}W in active file</div>
              </div>
            )}
          </div>
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
                  setActiveFile(file.path)
                  try {
                    const result = await invoke<any>('fs:read-file', file.path)
                    const content = unwrapIpc<string>(result) || ''
                    setActiveFileContent(content)
                    setActiveFileLanguage(getLanguage(file.path))
                    const cl = classifyFile(file.path)
                    if (cl === 'binary') setCenterMode('binary')
                    else setCenterMode('code')
                  } catch {}
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

      {/* Right: LSP status + panel controls */}
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

        {showLsp && (
          <div className="relative">
            <button
              aria-label="LSP status"
              className="flex items-center gap-1.5 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 cursor-pointer hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-copernicus-phosphor focus-visible:outline-none"
              onClick={() => setLspPopoverOpen(v => !v)}
            >
              <span className={`text-[8px] ${lspRunning ? 'text-green-500' : 'text-red-500'}`}>◉</span>
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">LSP {errorCount}E {warnCount}W</span>
            </button>
            {lspPopoverOpen && (
              <div
                className="absolute top-8 right-0 z-50 bg-[#0d0d0d] border border-copernicus-steel/40 rounded shadow-2xl p-3 w-56 font-mono"
                onMouseLeave={() => setLspPopoverOpen(false)}
              >
                <div className="text-[9px] text-zinc-500 uppercase tracking-wider mb-2">Language Server</div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${lspRunning ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-[10px] text-zinc-300">{lspRunning ? 'Connected' : 'Disconnected'}</span>
                </div>
                <div className="text-[9px] text-zinc-600 mt-2">{errorCount}E · {warnCount}W in active file</div>
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
          className={`p-1.5 rounded transition-colors focus-visible:ring-2 focus-visible:ring-copernicus-phosphor focus-visible:outline-none ${isSpotlightActive ? 'text-copernicus-phosphor bg-copernicus-phosphor/10' : 'text-zinc-400 hover:text-zinc-300'}`}
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

  useEffect(() => {
    setGhostMode(false)
    setHasGhost(false)
    setGhostAction(null)
  }, [propFilePath, useLayoutStore.getState().activeFilePath])

  const handleAcceptAll = () => {
    setGhostAction('accept')
    setTimeout(() => setGhostAction(null), 100)
  }

  const handleRejectAll = () => {
    setGhostAction('reject')
    setTimeout(() => setGhostAction(null), 100)
  }

  const { 
    centerMode, setCenterMode, 
    activeView,
    canvasContent, canvasUrl,
    activeFilePath, activeFileContent, activeFileLanguage,
    setActiveFileContent, browserSessionActive,
    reviewMode,
    searchDrawerOpen,
    setSearchDrawerOpen
  } = useLayoutStore()

  const filePath = activeFilePath ?? propFilePath ?? null
  const language = activeFilePath ? activeFileLanguage : (propLanguage ?? 'typescript')

  useEffect(() => {
    if (centerMode === 'builder' && !isUIFile(filePath)) {
      setCenterMode('code')
    }
  }, [filePath, centerMode, setCenterMode])

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
    if (activeView === 'editor' && (centerMode === 'canvas' || centerMode === 'builder')) {
      if (!filePath) return;
      
      const fileType = classifyFile(filePath)
      if (fileType === 'canvas') setCenterMode('canvas')
      else if (fileType === 'svg') setCenterMode('canvas')
      else if (fileType === 'binary') setCenterMode('binary')
      else setCenterMode('code')
    }
  }, [activeView, filePath, language, setCenterMode, centerMode])

  useEffect(() => {
    if (centerMode === 'builder' || centerMode === 'canvas') return;
    if (!filePath) return;

    if (language === 'svg') setCenterMode('canvas')
    else if (language === 'image') setCenterMode('canvas')
    else if (language === 'binary') setCenterMode('binary')
    else setCenterMode('code')
  }, [language, filePath, setCenterMode, centerMode])

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
        <SearchDrawer />
      </div>

      {/* Editor-Terminal Divider Bar */}
      <div className="h-6 bg-[#050505] border-t border-copernicus-steel flex items-center justify-end px-4 shrink-0 shadow-sm relative z-40">
        <button 
          onClick={() => setSearchDrawerOpen(!searchDrawerOpen)}
          className={`p-1 rounded transition-colors focus-visible:ring-1 focus-visible:ring-copernicus-phosphor focus-visible:outline-none flex items-center gap-1.5 ${searchDrawerOpen ? 'bg-copernicus-phosphor text-[#050505] rounded-none' : 'text-zinc-500 hover:text-zinc-300'}`}
          title="Search Codebase (Cmd+Shift+F)"
          aria-label="Toggle Search Drawer"
          aria-expanded={searchDrawerOpen}
        >
          <Search size={10} />
          <span className="text-[9px] uppercase tracking-widest font-mono">Search</span>
        </button>
      </div>
    </div>
  )
}
