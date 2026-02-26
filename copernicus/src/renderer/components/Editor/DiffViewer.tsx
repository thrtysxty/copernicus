import React from 'react'
import { DiffEditor } from '@monaco-editor/react'

interface DiffViewerProps {
  original: string
  modified: string
  language: string
  onConfirm: () => void
  onCancel: () => void
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  original,
  modified,
  language,
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col">
      <div className="flex items-center justify-between p-3 bg-[#0A0A0A] border-b border-copernicus-steel">
        <span className="text-xs font-mono text-copernicus-phosphor uppercase tracking-widest">
          DIFF PREVIEW — Review before applying
        </span>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="text-xs px-3 py-1 rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="text-xs px-3 py-1 rounded bg-copernicus-phosphor/20 text-copernicus-phosphor hover:bg-copernicus-phosphor/30 transition-colors"
          >
            Apply Changes
          </button>
        </div>
      </div>
      <div className="flex-1">
        <DiffEditor
          height="100%"
          theme="vs-dark"
          language={language}
          original={original}
          modified={modified}
          options={{
            renderSideBySide: true,
            readOnly: true,
            fontSize: 12,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  )
}
