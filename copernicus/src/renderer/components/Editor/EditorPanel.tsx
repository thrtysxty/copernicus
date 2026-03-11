import React, { useState, useEffect } from 'react'
import { Ghost, Check, X as CloseIcon } from 'lucide-react'
import { MonacoEditor } from './MonacoEditor'

interface EditorPanelProps {
  filePath: string
  content: string
  language: string
  onChange: (value: string | undefined) => void
}

export const EditorPanel: React.FC<EditorPanelProps> = ({
  filePath,
  content,
  language,
  onChange,
}) => {
  const [ghostMode, setGhostMode] = useState(false)
  const [hasGhost, setHasGhost] = useState(false)
  const [ghostAction, setGhostAction] = useState<'accept' | 'reject' | null>(null)

  // Listen for ghost decorations from MonacoEditor to show/hide controls
  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail.filePath === filePath) {
        setHasGhost(e.detail.hasGhost)
      }
    }
    window.addEventListener('editor:ghost-status', handler)
    return () => window.removeEventListener('editor:ghost-status', handler)
  }, [filePath])

  const handleAcceptAll = () => {
    setGhostAction('accept')
    setTimeout(() => setGhostAction(null), 100)
  }

  const handleRejectAll = () => {
    setGhostAction('reject')
    setTimeout(() => setGhostAction(null), 100)
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#050505] min-w-0 overflow-hidden">
      {/* Editor Sub-header */}
      <div className="h-7 flex items-center justify-between px-2 bg-[#0A0A0A] border-b border-copernicus-steel shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setGhostMode(!ghostMode)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                ghostMode ? 'text-copernicus-phosphor bg-copernicus-phosphor/10' : 'text-zinc-600 hover:text-zinc-400'
              }`}
              title="Toggle Ghost Mode (Shadow Coding)"
            >
              <Ghost size={12} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Ghost</span>
            </button>
          </div>

          {ghostMode && hasGhost && (
            <div className="flex items-center gap-2 border-l border-zinc-800 pl-4 animate-in fade-in slide-in-from-left-2">
              <span className="text-[9px] text-zinc-500 uppercase font-mono tracking-tight">Proposed Changes:</span>
              <button
                onClick={handleAcceptAll}
                className="flex items-center gap-1 px-2 py-0.5 bg-copernicus-phosphor text-[#050505] rounded text-[9px] font-bold uppercase hover:opacity-90 transition-opacity"
              >
                <Check size={10} /> Accept All
              </button>
              <button
                onClick={handleRejectAll}
                className="flex items-center gap-1 px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded text-[9px] font-bold uppercase hover:bg-zinc-700 transition-colors"
              >
                <CloseIcon size={10} /> Reject
              </button>
            </div>
          )}
        </div>
      </div>

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
