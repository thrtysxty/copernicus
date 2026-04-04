import log from '../../utils/logger'
import { useState, useEffect } from 'react'
import { DiffEditor, useMonaco } from '@monaco-editor/react'
import { Check, X, CheckCheck, Trash2, Sidebar, LayoutList } from 'lucide-react'
import { useLayoutStore } from '../../store/layout'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc } from '../../types/ipc'

export default function DiffPanel() {
  const { pendingDiff, clearReviewMode, setReviewMode } = useLayoutStore()
  const [activeFileIndex, setActiveFileIndex] = useState(0)
  const [isSideBySide, setIsSideBySide] = useState(true)
  const invoke = useIpcError()
  const monaco = useMonaco()

  useEffect(() => {
    if (monaco) {
      monaco.editor.defineTheme('copernicus-phosphor', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: '', foreground: 'd4d4d8' },
          { token: 'invalid', foreground: 'ff5555' },
          { token: 'emphasis', fontStyle: 'italic' },
          { token: 'strong', fontStyle: 'bold' },

          { token: 'variable', foreground: 'd4d4d8' },
          { token: 'variable.predefined', foreground: 'bd93f9' },
          { token: 'constant', foreground: 'bd93f9' },
          { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
          { token: 'number', foreground: 'bd93f9' },
          { token: 'number.hex', foreground: 'bd93f9' },
          { token: 'regexp', foreground: 'f1fa8c' },
          { token: 'annotation', foreground: 'bd93f9' },
          { token: 'type', foreground: '8be9fd' },

          { token: 'delimiter', foreground: 'd4d4d8' },
          { token: 'delimiter.html', foreground: 'd4d4d8' },
          { token: 'delimiter.xml', foreground: 'd4d4d8' },

          { token: 'tag', foreground: '4ade80' },
          { token: 'tag.id.html', foreground: '4ade80' },
          { token: 'tag.class.html', foreground: '4ade80' },
          { token: 'meta.tag', foreground: '4ade80' },
          { token: 'metatag', foreground: '4ade80' },
          { token: 'metatag.content.html', foreground: 'f1fa8c' },
          { token: 'metatag.html', foreground: '4ade80' },
          { token: 'metatag.xml', foreground: '4ade80' },
          { token: 'metatag.php', foreground: '4ade80' },

          { token: 'key', foreground: '50fa7b' },
          { token: 'string', foreground: 'f1fa8c' },
          { token: 'string.html', foreground: 'f1fa8c' },
          { token: 'string.sql', foreground: 'f1fa8c' },
          { token: 'string.yaml', foreground: 'f1fa8c' },

          { token: 'keyword', foreground: '4ade80' },
          { token: 'keyword.json', foreground: '50fa7b' },
          { token: 'keyword.php', foreground: '4ade80' },
          { token: 'keyword.sql', foreground: '4ade80' },
          { token: 'keyword.yaml', foreground: '50fa7b' },

          { token: 'operator', foreground: '4ade80' },
          { token: 'operator.sql', foreground: '4ade80' },
          { token: 'operator.php', foreground: '4ade80' },
          { token: 'operator.yaml', foreground: '4ade80' },

          { token: 'attribute.name', foreground: '50fa7b' },
          { token: 'attribute.value', foreground: 'f1fa8c' },
          { token: 'attribute.value.number', foreground: 'bd93f9' },
          { token: 'attribute.value.unit', foreground: 'bd93f9' },
          { token: 'attribute.value.html', foreground: 'f1fa8c' },
          { token: 'attribute.value.xml', foreground: 'f1fa8c' },

          { token: 'string.key.json', foreground: '50fa7b' },
          { token: 'string.value.json', foreground: 'f1fa8c' },
        ],
        colors: {
          'editor.background': '#050505',
          'editor.foreground': '#d4d4d8',
          'editorCursor.foreground': '#4ade80',
          'editor.lineHighlightBackground': '#3f3f4633',
          'editorLineNumber.foreground': '#3f3f46',
          'editor.selectionBackground': '#4ade8033',
          'editor.inactiveSelectionBackground': '#3f3f4633',
          'editorIndentGuide.background': '#3f3f4633',
          'editorIndentGuide.activeBackground': '#4ade8066',
        },
      })
      monaco.editor.setTheme('copernicus-phosphor')
    }
  }, [monaco])

  const files = pendingDiff?.files || []
  const currentFile = files[activeFileIndex]

  useEffect(() => {
    if (files.length === 0) {
      clearReviewMode()
    } else if (activeFileIndex >= files.length) {
      setActiveFileIndex(files.length - 1)
    }
  }, [files.length, activeFileIndex, clearReviewMode])

  const handleAccept = async (index: number) => {
    const file = files[index]
    if (!file) return

    try {
      if (file.status !== 'deleted') {
        const result = await invoke<any>('fs:save-file', {
          filePath: file.path,
          content: file.modified
        })
        unwrapIpc(result)
      }
      
      const newFiles = [...files]
      newFiles.splice(index, 1)
      if (newFiles.length === 0) {
        clearReviewMode()
      } else {
        setReviewMode(newFiles)
      }
    } catch (err) {
      log.error('Failed to accept change:', err)
    }
  }

  const handleReject = (index: number) => {
    const newFiles = [...files]
    newFiles.splice(index, 1)
    if (newFiles.length === 0) {
      clearReviewMode()
    } else {
      setReviewMode(newFiles)
    }
  }

  const handleAcceptAll = async () => {
    // We need to work on a copy because handleAccept modifies the store/state
    const filesToAccept = [...files]
    for (let i = filesToAccept.length - 1; i >= 0; i--) {
      await handleAccept(i)
    }
  }

  const handleRejectAll = () => {
    clearReviewMode()
  }

  if (files.length === 0) return null

  return (
    <div className="flex h-full w-full bg-[#050505] overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-copernicus-steel flex flex-col shrink-0">
        <div className="h-10 border-b border-copernicus-steel flex items-center px-4 justify-between bg-[#0A0A0A]">
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Modified Files</span>
          <span className="text-[10px] font-mono text-black bg-copernicus-phosphor px-1.5 py-0.5 rounded">
            {files.length}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {files.map((file, idx) => (
            <button
              key={file.path}
              onClick={() => setActiveFileIndex(idx)}
              className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors ${
                activeFileIndex === idx ? 'bg-copernicus-phosphor text-[#050505] rounded-none border-l-2 border-copernicus-phosphor' : 'hover:bg-white/5 border-l-2 border-transparent'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                file.status === 'added' ? 'bg-green-500' : 
                file.status === 'deleted' ? 'bg-red-500' : 'bg-yellow-500'
              }`} />
              <div className="flex-1 min-w-0">
                <div className={`text-[11px] font-mono truncate ${activeFileIndex === idx ? 'text-copernicus-phosphor' : 'text-zinc-400'}`}>
                  {file.path.split('/').pop()}
                </div>
                <div className="text-[9px] text-zinc-600 truncate">{file.path}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="p-2 border-t border-copernicus-steel bg-[#0A0A0A] flex gap-2">
          <button 
            onClick={handleAcceptAll}
            className="flex-1 h-8 flex items-center justify-center gap-2 bg-copernicus-phosphor text-[#050505] rounded text-[10px] font-mono font-bold hover:brightness-110 transition-all"
          >
            <CheckCheck size={14} /> ACCEPT_ALL
          </button>
          <button 
            onClick={handleRejectAll}
            className="flex-1 h-8 flex items-center justify-center gap-2 bg-zinc-800 text-zinc-400 rounded text-[10px] font-mono hover:bg-zinc-700 transition-all"
          >
            <Trash2 size={14} /> REJECT_ALL
          </button>
        </div>
      </div>

      {/* Main Diff Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-10 border-b border-copernicus-steel flex items-center px-4 justify-between bg-[#0A0A0A]">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
              Reviewing: <span className="text-zinc-300">{currentFile?.path}</span>
            </span>
            <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded border ${
              currentFile?.status === 'added' ? 'border-green-500/30 text-green-500 bg-green-500/5' :
              currentFile?.status === 'deleted' ? 'border-red-500/30 text-red-500 bg-red-500/5' :
              'border-yellow-500/30 text-yellow-500 bg-yellow-500/5'
            }`}>
              {currentFile?.status?.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSideBySide(!isSideBySide)}
              className={`p-1.5 transition-colors ${isSideBySide ? 'bg-copernicus-phosphor text-[#050505] rounded-none' : 'text-zinc-500 hover:text-zinc-300 rounded'}`}
              title={isSideBySide ? "Switch to Inline View" : "Switch to Side-by-Side View"}
            >
              {isSideBySide ? <Sidebar size={14} /> : <LayoutList size={14} />}
            </button>
            <div className="w-px h-4 bg-copernicus-steel mx-1" />
            <button
              onClick={() => handleAccept(activeFileIndex)}
              className="h-7 px-3 flex items-center gap-2 bg-copernicus-phosphor/20 text-copernicus-phosphor border border-copernicus-phosphor/30 rounded text-[10px] font-mono hover:bg-copernicus-phosphor/30 transition-all"
            >
              <Check size={14} /> ACCEPT
            </button>
            <button
              onClick={() => handleReject(activeFileIndex)}
              className="h-7 px-3 flex items-center gap-2 bg-red-500/10 text-red-500 border border-red-500/30 rounded text-[10px] font-mono hover:bg-red-500/20 transition-all"
            >
              <X size={14} /> REJECT
            </button>
          </div>
        </div>

        <div className="flex-1 relative">
          <DiffEditor
            original={currentFile?.original || ''}
            modified={currentFile?.modified || ''}
            language={currentFile?.path.split('.').pop() === 'tsx' ? 'typescript' : currentFile?.path.split('.').pop() === 'ts' ? 'typescript' : 'javascript'}
            theme="copernicus-phosphor"
            options={{
              renderSideBySide: isSideBySide,
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 12,
              fontFamily: '"JetBrains Mono", monospace',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              scrollbar: {
                verticalScrollbarSize: 6,
                horizontalScrollbarSize: 6,
                useShadows: false,
              },
            }}
          />
        </div>
      </div>
    </div>
  )
}
