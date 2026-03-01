import { useEffect } from 'react'
import { MonacoEditor } from './MonacoEditor'
import { ImageViewer } from './ImageViewer'
import { BinaryBlocker } from './BinaryBlocker'
import { UICanvas } from './UICanvas'
import { UIBuilderCanvas } from './ui-builder/UIBuilderCanvas'
import { useLayoutStore } from '../../store/layout'
import { classifyFile } from '../../utils/fileUtils'

interface CenterPanelRouterProps {
  filePath?: string | null
  content?: string
  language?: string
  onChange?: (value: string | undefined) => void
}

export function CenterPanelRouter({ 
  filePath: propFilePath, 
  content: propContent, 
  language: propLanguage, 
  onChange: propOnChange 
}: CenterPanelRouterProps) {
  const { 
    centerMode, setCenterMode, 
    canvasContent, canvasUrl,
    activeFilePath, activeFileContent, activeFileLanguage,
    setActiveFileContent, browserSessionActive
  } = useLayoutStore()

  const filePath = activeFilePath ?? propFilePath ?? null
  const content = activeFilePath ? activeFileContent : (propContent ?? '')
  const language = activeFilePath ? activeFileLanguage : (propLanguage ?? 'typescript')
  const onChange = activeFilePath 
    ? (val: string | undefined) => setActiveFileContent(val ?? '')
    : (propOnChange ?? (() => {}))

  // When language or filePath changes, reset centerMode to a sensible default
  // EXCEPT if we are in builder or canvas mode, keep it.
  useEffect(() => {
    if (centerMode === 'builder' || centerMode === 'canvas') return;
    if (!filePath) return;

    if (language === 'svg') setCenterMode('canvas')
    else if (language === 'image') setCenterMode('canvas')
    else if (language === 'binary') setCenterMode('binary')
    else setCenterMode('code')
  }, [language, filePath, setCenterMode, centerMode])

  // AC-2 Designer Canvas Surface
  if (centerMode === 'canvas') {
    if (browserSessionActive) {
      return <div className="flex-1 flex items-center justify-center bg-zinc-900 font-mono text-zinc-400">Playwright: active</div>
    }

    if (filePath && (classifyFile(filePath) === 'canvas' || classifyFile(filePath) === 'svg')) {
       return <ImageViewer filePath={filePath} isSvg={classifyFile(filePath) === 'svg'} onEditSource={classifyFile(filePath) === 'svg' ? () => setCenterMode('code') : undefined} />
    }

    if (canvasContent || canvasUrl) {
      return <UICanvas />
    }

    return <UIBuilderCanvas />
  }

  // Builder mode takes precedence if active
  if (centerMode === 'builder') {
    return <UIBuilderCanvas />
  }

  if (!filePath) {
    return (
      <div className="flex-1 flex items-center justify-center bg-copernicus-bg font-mono text-[10px] text-zinc-600">
        NO_FILE_SELECTED
      </div>
    )
  }

  // Route based on language sentinel and current centerMode
  switch (language) {
    case 'binary':
      return <BinaryBlocker filePath={filePath} />

    case 'svg':
      // SVG allows switching between Image view and Code view
      return centerMode === 'code'
        ? <MonacoEditor value={content} language="xml" filePath={filePath} onChange={onChange} />
        : <ImageViewer filePath={filePath} isSvg onEditSource={() => setCenterMode('code')} />

    default:
      // Default fallback is Monaco for all other code/text files
      return <MonacoEditor value={content} language={language} filePath={filePath} onChange={onChange} />
  }
}
