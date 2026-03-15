import React, { useEffect } from 'react'
import { MonacoEditor } from './MonacoEditor'

interface EditorPanelProps {
  filePath: string
  content: string
  language: string
  onChange: (value: string | undefined) => void
  ghostMode?: boolean
  ghostAction?: 'accept' | 'reject' | null
  onGhostStatusChange?: (hasGhost: boolean) => void
}

export const EditorPanel: React.FC<EditorPanelProps> = ({
  filePath,
  content,
  language,
  onChange,
  ghostMode = false,
  ghostAction = null,
  onGhostStatusChange
}) => {

  // Listen for ghost decorations from MonacoEditor to show/hide controls
  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail.filePath === filePath) {
        if (onGhostStatusChange) onGhostStatusChange(e.detail.hasGhost)
      }
    }
    window.addEventListener('editor:ghost-status', handler)
    return () => window.removeEventListener('editor:ghost-status', handler)
  }, [filePath])


  return (
    <div className="flex flex-col h-full w-full bg-[#050505] min-w-0 overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <MonacoEditor
          filePath={filePath}
          value={content}
          language={language}
          onChange={onChange}
          ghostMode={ghostMode}
          ghostAction={ghostAction}
        />
      </div>
    </div>
  )
}
