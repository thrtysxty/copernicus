import { useEffect } from 'react'
import { MonacoEditor } from './MonacoEditor'
import { ImageViewer } from './ImageViewer'
import { BinaryBlocker } from './BinaryBlocker'
import { UICanvas } from './UICanvas'
import { UIBuilderCanvas } from './ui-builder/UIBuilderCanvas'
import { useLayoutStore } from '../../store/layout'

interface CenterPanelRouterProps {
  filePath: string | null
  content: string
  language: string
  onChange: (value: string | undefined) => void
}

export function CenterPanelRouter({ filePath, content, language, onChange }: CenterPanelRouterProps) {
  const { centerMode, setCenterMode, canvasContent, canvasUrl } = useLayoutStore()

  // When language or filePath changes, reset centerMode to a sensible default
  // EXCEPT if we are in builder mode, keep it.
  useEffect(() => {
    if (centerMode === 'builder') return;

    if (language === 'svg') setCenterMode('image')
    else if (language === 'image') setCenterMode('image')
    else if (language === 'binary') setCenterMode('binary')
    else setCenterMode('code')
  }, [language, filePath, setCenterMode])

  // Builder mode takes precedence if active
  if (centerMode === 'builder') {
    return <UIBuilderCanvas />
  }

  // Agent preview takes precedence when content/url is pushed via IPC
  if (canvasContent || canvasUrl) {
    return <UICanvas />
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
