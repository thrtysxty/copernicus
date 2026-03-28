import log from '../../utils/logger'
import React, { useState, useEffect } from 'react'
import { Diff, Terminal, CheckCircle, RotateCcw, AlertTriangle } from 'lucide-react'
import { useLayoutStore } from '../../store/layout'
import { useIpcError } from '../../hooks/useIpcError'
import Editor from '@monaco-editor/react'

interface Story {
  id: number
  title: string
  filesInScope?: string[]
}

export const ReviewPanel: React.FC = () => {
  const { pendingReview, setPendingReview, workingDir } = useLayoutStore()
  const invoke = useIpcError()
  
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [stories, setStories] = useState<Story[]>([])
  const [tscOutput, setTscOutput] = useState<string[]>([])
  const [tscStatus, setTscStatus] = useState<'idle' | 'running' | 'pass' | 'fail'>('idle')
  const [tscErrorCount, setTscErrorCount] = useState(0)
  const [reworkNote, setReworkNote] = useState('')
  const [showReworkInput, setShowReworkInput] = useState(false)

  useEffect(() => {
    if (pendingReview?.changedFiles.length) {
      setSelectedFile(pendingReview.changedFiles[0] || null)
    }
    if (pendingReview?.stories.length) {
      loadStories()
    }
  }, [pendingReview])

  useEffect(() => {
    if (selectedFile) {
      loadFileContent(selectedFile)
    }
  }, [selectedFile])

  const loadStories = async () => {
    try {
      const allStories = await invoke<Story[]>('stories:list')
      const filtered = allStories.filter(s => pendingReview?.stories.includes(s.id))
      setStories(filtered)
    } catch (err) {
      log.error('Failed to load stories:', err)
    }
  }

  const loadFileContent = async (filePath: string) => {
    try {
      const content = await invoke<string>('fs:read-file', filePath)
      setFileContent(content)
    } catch (err) {
      setFileContent(`Error reading file: ${err}`)
    }
  }

  const runTsc = async () => {
    setTscOutput([])
    setTscStatus('running')
    setTscErrorCount(0)

    try {
      const termId = `tsc-${Date.now()}`
      
      const removeListener = window.ipcRenderer.on('terminal-incoming', (_e: any, { id, data }: { id: string, data: string }) => {
        if (id === termId) {
          setTscOutput(prev => [...prev, data])
        }
      })

      const removeExitListener = window.ipcRenderer.on('terminal:remove', (_e: any, { id }: { id: string }) => {
          if (id === termId) {
              setTscStatus(prev => {
                  return prev
              })
              removeListener()
              removeExitListener()
          }
      })

      await invoke('terminal:spawn', {
        command: 'npx tsc --noEmit',
        cwd: workingDir + '/copernicus',
        label: 'TSC Check'
      })

    } catch (err) {
      setTscStatus('fail')
      setTscOutput(prev => [...prev, `Failed to spawn tsc: ${err}`])
    }
  }

  useEffect(() => {
    if (tscStatus === 'running') {
      const output = tscOutput.join('\n')
      if (output.includes('Found 0 errors')) {
        setTscStatus('pass')
      } else if (output.includes('error TS')) {
        const matches = output.match(/error TS\d+/g)
        setTscErrorCount(matches ? matches.length : 0)
        setTscStatus('fail')
      }
    }
  }, [tscOutput, tscStatus])

  const handleApprove = async () => {
    if (!pendingReview) return
    try {
      for (const storyId of pendingReview.stories) {
        await invoke('stories:set-field', { id: storyId, field: 'status', value: 'COMPLETE' })
      }
      setPendingReview(null)
    } catch (err) {
      log.error('Failed to approve:', err)
    }
  }

  const handleRework = async () => {
    if (!reworkNote.trim()) return
    setPendingReview(null)
  }

  if (!pendingReview) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-zinc-500 font-mono">
        <Diff size={48} className="mb-4 opacity-20" />
        <p className="text-sm uppercase tracking-widest">No review pending</p>
      </div>
    )
  }

  const allFilesInScope = new Set(stories.flatMap(s => s.filesInScope || []))

  return (
    <div className="h-full flex flex-col bg-[#050505] font-mono text-zinc-400">
      <header className="h-12 border-b border-copernicus-steel/30 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Diff size={16} className="text-copernicus-phosphor" />
          <h2 className="text-[11px] uppercase tracking-widest font-bold text-zinc-200">Review Session</h2>
          <span className="text-[10px] px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-zinc-500">
            {pendingReview.sessionId}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={runTsc}
            disabled={tscStatus === 'running'}
            className="flex items-center gap-2 px-3 py-1 text-[10px] uppercase tracking-wider border border-copernicus-steel/40 hover:border-copernicus-phosphor/50 transition-colors disabled:opacity-50"
          >
            <Terminal size={12} />
            Run TSC
            {tscStatus === 'pass' && <span className="text-green-500 ml-1">✓ PASS</span>}
            {tscStatus === 'fail' && <span className="text-red-500 ml-1">✗ {tscErrorCount} ERRORS</span>}
          </button>

          <div className="w-px h-4 bg-zinc-800 mx-1" />

          <button 
            onClick={handleApprove}
            className="flex items-center gap-2 px-3 py-1 bg-copernicus-phosphor/10 text-copernicus-phosphor border border-copernicus-phosphor/30 hover:bg-copernicus-phosphor/20 text-[10px] uppercase tracking-wider transition-colors"
          >
            <CheckCircle size={12} />
            Approve & Close
          </button>

          <button 
            onClick={() => setShowReworkInput(!showReworkInput)}
            className="flex items-center gap-2 px-3 py-1 border border-orange-500/30 text-orange-500/80 hover:bg-orange-500/5 text-[10px] uppercase tracking-wider transition-colors"
          >
            <RotateCcw size={12} />
            Request Rework
          </button>
        </div>
      </header>

      {showReworkInput && (
        <div className="p-4 bg-orange-500/5 border-b border-orange-500/20">
          <p className="text-[10px] uppercase mb-2 text-orange-500/70">Rework Instructions</p>
          <textarea 
            value={reworkNote}
            onChange={(e) => setReworkNote(e.target.value)}
            placeholder="What needs to be fixed?"
            className="w-full h-24 bg-zinc-950 border border-orange-500/20 rounded p-2 text-sm focus:outline-none focus:border-orange-500/40 text-zinc-300 mb-2"
          />
          <div className="flex justify-end gap-2">
            <button 
              onClick={() => setShowReworkInput(false)}
              className="px-2 py-1 text-[9px] uppercase border border-zinc-800 hover:border-zinc-700"
            >
              Cancel
            </button>
            <button 
              onClick={handleRework}
              className="px-2 py-1 text-[9px] uppercase bg-orange-500/20 border border-orange-500/40 text-orange-400 hover:bg-orange-500/30"
            >
              Submit Feedback
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className="w-[240px] border-r border-copernicus-steel/30 flex flex-col shrink-0">
          <div className="p-2 border-b border-copernicus-steel/20 bg-zinc-950/50">
            <span className="text-[9px] uppercase tracking-widest text-zinc-500">Changed Files</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {pendingReview.changedFiles.map(file => {
              const parts = file.split('/')
              const basename = parts[parts.length - 1]
              const dirname = parts.slice(0, -1).join('/')
              const outOfScope = allFilesInScope.size > 0 && !allFilesInScope.has(file)
              const isSelected = selectedFile === file

              return (
                <button
                  key={file}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full text-left p-2 border-b border-zinc-900/50 transition-colors ${
                    isSelected ? 'bg-copernicus-phosphor/10' : 'hover:bg-zinc-900/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-[11px] font-bold ${isSelected ? 'text-copernicus-phosphor' : 'text-zinc-300'}`}>
                      {basename}
                    </span>
                    {outOfScope && (
                      <span className="flex items-center gap-1 text-[8px] px-1 py-0.5 bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded-sm">
                        <AlertTriangle size={8} />
                        OUT OF SCOPE
                      </span>
                    )}
                  </div>
                  <div className="text-[9px] text-zinc-600 truncate">
                    {dirname === '' ? '.' : dirname}
                  </div>
                </button>
              )
            })}
          </div>

          {tscOutput.length > 0 && (
            <div className="h-48 border-t border-copernicus-steel/30 bg-[#020202] flex flex-col">
              <div className="p-1 px-2 border-b border-copernicus-steel/20 flex justify-between items-center">
                <span className="text-[9px] uppercase text-zinc-500">TSC Output</span>
                <button onClick={() => setTscOutput([])} className="text-[9px] text-zinc-700 hover:text-zinc-500">Clear</button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 font-mono text-[9px] whitespace-pre-wrap leading-tight text-zinc-500">
                {tscOutput.map((line, i) => (
                  <div key={i} className={line.includes('error TS') ? 'text-red-500/80' : ''}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col bg-[#020202]">
          {selectedFile ? (
            <div className="flex-1 relative">
              <Editor
                height="100%"
                path={selectedFile}
                language={selectedFile.endsWith('.ts') || selectedFile.endsWith('.tsx') ? 'typescript' : 'javascript'}
                value={fileContent}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono, monospace',
                  theme: 'vs-dark',
                  renderLineHighlight: 'all',
                  scrollbar: {
                    verticalScrollbarSize: 8,
                    horizontalScrollbarSize: 8,
                  },
                }}
                theme="copernicus-phosphor"
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-700 italic text-xs">
              Select a file to review
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
