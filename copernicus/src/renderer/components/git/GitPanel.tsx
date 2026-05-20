import React, { useState, useEffect } from 'react'
import { Check, ExternalLink } from 'lucide-react'
import { useLayoutStore } from '../../store/layout'
import { useIpcError } from '../../hooks/useIpcError'
import { IpcResult, unwrapIpc } from '../../types/ipc'
import { BranchSelector } from './BranchSelector'

interface GitFile {
  status: string
  file: string
}

interface PullRequest {
  number: number
  title: string
  author: string
  url: string
  ciStatus: string
}

export const GitPanel: React.FC = () => {
  const [status, setStatus] = useState<GitFile[]>([])
  const [prs, setPrs] = useState<PullRequest[]>([])
  const [commitMessage, setCommitMessage] = useState('')
  const [diff, setDiff] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  
  const invoke = useIpcError()
  const openFile = useLayoutStore(s => s.openFile)

  const refresh = async () => {
    setLoading(true)
    try {
      const s = await invoke<IpcResult<GitFile[]>>('git:status')
      const statusFiles = unwrapIpc(s) as GitFile[] ?? []
      setStatus(statusFiles)
      useLayoutStore.getState().setGitDirty(statusFiles.length > 0)
      
      const p = await invoke<IpcResult<PullRequest[]>>('github:list-prs')
      setPrs(unwrapIpc(p) ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const handleStage = async (file: string) => {
    await invoke('git:stage', { file })
    refresh()
  }

  const handleUnstage = async (file: string) => {
    await invoke('git:unstage', { file })
    refresh()
  }

  const handleCommit = async () => {
    if (!commitMessage) return
    await invoke('git:commit', { message: commitMessage })
    setCommitMessage('')
    refresh()
  }

  const handleFileClick = async (file: string) => {
    setSelectedFile(file)
    const d = await invoke<IpcResult<string>>('git:diff-file', { file })
    setDiff(unwrapIpc(d) ?? '')
  }

  const renderDiff = (rawDiff: string) => {
    return rawDiff.split('\n').map((line, i) => {
      let color = 'text-zinc-500'
      if (line.startsWith('+')) color = 'text-green-400'
      else if (line.startsWith('-')) color = 'text-red-400'
      else if (line.startsWith('@')) color = 'text-blue-400'
      else if (line.startsWith('diff')) color = 'text-zinc-300 font-bold'
      
      return <div key={i} className={`${color} whitespace-pre-wrap break-all`}>{line}</div>
    })
  }

  return (
    <div data-testid="panel-git" className="flex flex-col h-full bg-[#050505] font-mono text-[10px] text-zinc-300">
      <div className="p-4 border-b border-copernicus-steel/20 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <BranchSelector onBranchChange={refresh} />
        </div>
        <button onClick={refresh} className="text-zinc-500 hover:text-zinc-300">
          {loading ? '...' : 'REFRESH'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="uppercase text-zinc-500 mb-2 tracking-widest flex items-center justify-between">
            <span>Changes</span>
            <span className="bg-zinc-900 px-1 rounded">{status.length}</span>
          </div>
          <div className="space-y-1">
            {status.length === 0 && <div className="text-zinc-600 italic">No changes</div>}
            {status.map((item, i) => (
              <div 
                key={i} 
                className={`group flex items-center gap-2 p-1 rounded hover:bg-zinc-900/50 cursor-pointer ${selectedFile === item.file ? 'bg-zinc-900' : ''}`}
                onClick={() => handleFileClick(item.file)}
              >
                <div 
                  className="w-4 h-4 flex items-center justify-center border border-zinc-700 rounded hover:border-copernicus-phosphor"
                  onClick={(e) => {
                    e.stopPropagation()
                    item.status === '??' || item.status === ' M' ? handleStage(item.file) : handleUnstage(item.file)
                  }}
                >
                  {item.status !== '??' && item.status !== ' M' && <Check size={10} className="text-copernicus-phosphor" />}
                </div>
                <span className={`w-4 text-center ${item.status === '??' ? 'text-green-500' : item.status === ' M' ? 'text-amber-500' : 'text-blue-500'}`}>
                  {item.status.trim() || 'M'}
                </span>
                <span className="flex-1 truncate" title={item.file}>{item.file}</span>
                <button 
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-copernicus-phosphor"
                  onClick={(e) => { e.stopPropagation(); openFile(item.file) }}
                >
                  <ExternalLink size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {selectedFile && diff && (
          <div className="border-t border-copernicus-steel/20 p-4">
            <div className="uppercase text-zinc-500 mb-2 tracking-widest flex items-center justify-between">
              <span>Diff: {selectedFile.split('/').pop()}</span>
              <button onClick={() => setSelectedFile(null)} className="hover:text-zinc-300">CLOSE</button>
            </div>
            <pre className="bg-zinc-950 p-2 rounded overflow-x-auto text-[9px] leading-relaxed max-h-96">
              {renderDiff(diff)}
            </pre>
          </div>
        )}

        <div className="p-4 border-t border-copernicus-steel/20">
          <div className="uppercase text-zinc-500 mb-2 tracking-widest">Open Pull Requests</div>
          <div className="space-y-2">
            {prs.length === 0 && <div className="text-zinc-600 italic">No open PRs found</div>}
            {prs.map((pr) => (
              <div 
                key={pr.number} 
                className="p-2 border border-zinc-800 rounded hover:border-zinc-700 cursor-pointer"
                onClick={() => invoke('app:open-external', pr.url)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-copernicus-phosphor">#{pr.number}</span>
                  <span className="text-zinc-500 text-[8px]">{pr.author}</span>
                </div>
                <div className="text-zinc-300 line-clamp-2">{pr.title}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-copernicus-steel/20 shrink-0 bg-[#080808]">
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="Commit message..."
          className="w-full h-16 bg-zinc-950 border border-zinc-800 rounded p-2 mb-2 focus:outline-none focus:border-copernicus-phosphor resize-none"
        />
        <button
          onClick={handleCommit}
          disabled={!commitMessage || status.length === 0}
          className="w-full bg-copernicus-phosphor text-[#050505] font-bold py-2 rounded hover:bg-copernicus-phosphor/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          COMMIT CHANGES
        </button>
      </div>
    </div>
  )
}
