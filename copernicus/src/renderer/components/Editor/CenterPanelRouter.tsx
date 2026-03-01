import { useEffect } from 'react'
import { MonacoEditor } from './MonacoEditor'
import { ImageViewer } from './ImageViewer'
import { BinaryBlocker } from './BinaryBlocker'
import { UICanvas } from './UICanvas'
import { UIBuilderCanvas } from './ui-builder/UIBuilderCanvas'
import { useLayoutStore } from '../../store/layout'

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
    setActiveFileContent
  } = useLayoutStore()

  const filePath = activeFilePath ?? propFilePath ?? null
  const content = activeFilePath ? activeFileContent : (propContent ?? '')
  const language = activeFilePath ? activeFileLanguage : (propLanguage ?? 'typescript')
  const onChange = activeFilePath 
    ? (val: string | undefined) => setActiveFileContent(val ?? '')
    : (propOnChange ?? (() => {}))

  // When language or filePath changes, reset centerMode to a sensible default
  // EXCEPT if we are in builder mode, keep it.
  useEffect(() => {
    if (centerMode === 'builder') return;
    if (!filePath) return;

    if (language === 'svg') setCenterMode('image')
    else if (language === 'image') setCenterMode('image')
    else if (language === 'binary') setCenterMode('binary')
    else setCenterMode('code')
  }, [language, filePath, setCenterMode, centerMode])

  // Builder mode takes precedence if active
  if (centerMode === 'builder') {
    return <UIBuilderCanvas />
  }

  // Agent preview takes precedence when content/url is pushed via IPC
  if (canvasContent || canvasUrl) {
    return <UICanvas />
  }

  if (!filePath && !canvasContent && !canvasUrl) {
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

    case 'image':
      return <ImageViewer filePath={filePath} />

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
