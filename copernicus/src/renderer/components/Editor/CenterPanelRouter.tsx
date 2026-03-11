import { useEffect, useMemo } from 'react'
import { X } from 'lucide-react'
import { MonacoEditor } from './MonacoEditor'
import { ImageViewer } from './ImageViewer'
import { BinaryBlocker } from './BinaryBlocker'
import { UICanvas } from './UICanvas'
import { UIBuilderCanvas } from './ui-builder/UIBuilderCanvas'
import DiffPanel from './DiffPanel'
import { useLayoutStore } from '../../store/layout'
import { classifyFile } from '../../utils/fileUtils'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc } from '../../types/ipc'

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

function getLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  return LANGUAGE_MAP[ext] ?? 'plaintext'
}

function TabBar() {
  const { openFiles, activeFilePath, setActiveFile, closeFile, setActiveFileContent, setActiveFileLanguage, setCenterMode } = useLayoutStore()
  const invoke = useIpcError()
  
  if (openFiles.length === 0) return null

  const handleTabClick = async (path: string) => {
    if (path === activeFilePath) return
    setActiveFile(path)
    
    // Load content when switching tabs
    try {
      const result = await invoke<any>('fs:read-file', path)
      const content = unwrapIpc<string>(result) || ''
      setActiveFileContent(content)
      const lang = getLanguage(path)
      setActiveFileLanguage(lang)
      
      const classification = classifyFile(path)
      if (classification === 'canvas' || classification === 'svg') {
        // Designer mode handled by CenterPanelRouter effects, but let's be explicit if needed
      } else if (classification === 'binary') {
        setCenterMode('binary')
      } else {
        setCenterMode('code')
      }
    } catch (err) {
      console.error('[TabBar] Failed to load file:', err)
    }
  }

  return (
    <div className="flex overflow-x-auto bg-[#050505] border-b border-copernicus-steel h-8 no-scrollbar scroll-smooth shrink-0">
      {openFiles.map(file => {
        const isActive = activeFilePath === file.path
        const fileName = file.path.split('/').pop() ?? file.path
        
        return (
          <div
            key={file.path}
            onClick={() => handleTabClick(file.path)}
            className={`
              flex items-center gap-2 px-3 py-1 border-r border-copernicus-steel cursor-pointer transition-all shrink-0 select-none group
              ${isActive ? 'bg-zinc-800 text-zinc-100 border-b-2 border-indigo-500' : 'bg-[#0A0A0A] text-zinc-500 hover:text-zinc-300'}
            `}
          >
            <span className="text-[10px] font-mono truncate max-w-[150px]">
              {fileName}{file.isDirty ? ' •' : ''}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                closeFile(file.path)
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-700 transition-all text-zinc-500 hover:text-zinc-100"
            >
              <X size={10} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export function CenterPanelRouter({ 
  filePath: propFilePath, 
  content: propContent, 
  language: propLanguage, 
  onChange: propOnChange 
}: CenterPanelRouterProps) {
  const { 
    centerMode, setCenterMode, 
    activeView,
    canvasContent, canvasUrl,
    activeFilePath, activeFileContent, activeFileLanguage,
    setActiveFileContent, browserSessionActive,
    reviewMode
  } = useLayoutStore()

  const renderedContent = useMemo(() => {
    if (reviewMode) {
      return <DiffPanel />
    }

    const filePath = activeFilePath ?? propFilePath ?? null
    
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
        return <UICanvas />
      }

      return <UIBuilderCanvas />
    }

    if (centerMode === 'builder') {
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
          ? <MonacoEditor key={filePath} value={content} language="xml" filePath={filePath} onChange={onChange} />
          : <ImageViewer filePath={filePath} isSvg onEditSource={() => setCenterMode('code')} />

      default:
        return <MonacoEditor key={filePath} value={content} language={language} filePath={filePath} onChange={onChange} />
    }
  }, [reviewMode, activeFilePath, propFilePath, activeFileContent, propContent, activeFileLanguage, propLanguage, centerMode, browserSessionActive, canvasContent, canvasUrl, setActiveFileContent, propOnChange, setCenterMode])

  const filePath = activeFilePath ?? propFilePath ?? null
  const language = activeFilePath ? activeFileLanguage : (propLanguage ?? 'typescript')

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
    <div className="flex flex-col h-full w-full overflow-hidden">
      <TabBar />
      <div className="flex-1 overflow-hidden">
        {renderedContent}
      </div>
    </div>
  )
}
