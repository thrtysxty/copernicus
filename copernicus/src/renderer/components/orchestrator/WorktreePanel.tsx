import React, { useEffect } from 'react'
import { useWorktreeStore } from '../../store/worktreeStore'
import { GitBranch, Trash2 } from 'lucide-react'
import { AgentWorktree } from '../../types/worktree'
import { useLayoutStore } from '../../store/layout'
import { unwrapIpc } from '../../types/ipc'
import { useIpcError } from '../../hooks/useIpcError'

const timeAgo = (dateString: string) => {
  const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000)
  let interval = seconds / 31536000
  if (interval > 1) return Math.floor(interval) + 'y'
  interval = seconds / 2592000
  if (interval > 1) return Math.floor(interval) + 'mo'
  interval = seconds / 86400
  if (interval > 1) return Math.floor(interval) + 'd'
  interval = seconds / 3600
  if (interval > 1) return Math.floor(interval) + 'h'
  interval = seconds / 60
  if (interval > 1) return Math.floor(interval) + 'm'
  return Math.floor(seconds) + 's'
}

export const WorktreePanel: React.FC = () => {
  const { worktrees, alwaysUseWorktrees, defaultMergeMode, setWorktrees, upsertWorktree, removeWorktree, setAlwaysUseWorktrees, setDefaultMergeMode } = useWorktreeStore()
  const invoke = useIpcError()

  const nonMergedWorktrees = worktrees.filter(wt => wt.status !== 'merged')

  useEffect(() => {
    const fetchWorktrees = async () => {
      try {
        const result = unwrapIpc<AgentWorktree[]>(await invoke<AgentWorktree[]>('worktree:list'))
        setWorktrees(result)
      } catch { /* error toasted by invoke */ }
    }

    fetchWorktrees()

    const handleWorktreeCompleted = (_event: Electron.IpcRendererEvent, worktree: AgentWorktree) => {
      upsertWorktree(worktree)
    }

    const handleWorktreeMerged = (_event: Electron.IpcRendererEvent, worktree: AgentWorktree) => {
      upsertWorktree({ ...worktree, status: 'merged' })
    }

    const removeWorktreeCompletedListener = window.ipcRenderer.on('worktree:completed', handleWorktreeCompleted)
    const removeWorktreeMergedListener = window.ipcRenderer.on('worktree:merged', handleWorktreeMerged)

    return () => {
      removeWorktreeCompletedListener()
      removeWorktreeMergedListener()
    }
  }, [setWorktrees, upsertWorktree, invoke])

  const handleReview = async (id: string) => {
    try {
      const { files, diff } = unwrapIpc<{ files: string[]; diff: string }>(await invoke<{ files: string[]; diff: string }>('worktree:diff', { id }))
      useLayoutStore.getState().setReviewMode(
        files.map((f: string) => ({ path: f, original: '', modified: diff, status: 'modified' as const }))
      )
    } catch { /* error toasted by invoke */ }
  }

  const handleMerge = async (id: string) => {
    try {
      unwrapIpc(await invoke('worktree:merge', { id }))
    } catch { /* error toasted by invoke */ }
  }

  const handleRemove = async (id: string) => {
    try {
      unwrapIpc(await invoke('worktree:remove', { id }))
      removeWorktree(id)
    } catch { /* error toasted by invoke */ }
  }

  return (
    <div data-testid="panel-worktree" className="bg-zinc-950 border-t border-zinc-800">
      <div className="h-9 bg-[#080808] border-t border-zinc-800 flex items-center px-2">
        <GitBranch size={12} className="text-copernicus-phosphor mr-1" />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] font-black text-copernicus-phosphor mr-2">
          Worktrees
        </span>
        {nonMergedWorktrees.length > 0 && (
          <span className="bg-copernicus-phosphor text-[#050505] rounded-full px-1.5 py-0.5 text-[8px] font-bold mr-2">
            {nonMergedWorktrees.length}
          </span>
        )}

        <label className="flex items-center gap-1 cursor-pointer select-none mr-2">
          <input
            type="checkbox"
            checked={alwaysUseWorktrees}
            onChange={(e) => setAlwaysUseWorktrees(e.target.checked)}
            className="accent-copernicus-phosphor w-2.5 h-2.5"
          />
          <span className="text-[9px] font-mono text-zinc-500">Always</span>
        </label>

        <select
          className="inspector-input bg-zinc-900 border border-zinc-700 text-[9px] text-zinc-300 px-1 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-copernicus-phosphor"
          value={defaultMergeMode}
          onChange={(e) => setDefaultMergeMode(e.target.value as 'gated' | 'yolo')}
        >
          <option value="gated">Gated</option>
          <option value="yolo">Yolo</option>
        </select>

      </div>

      <div className="max-h-40 overflow-y-auto custom-scrollbar">
        {worktrees.length === 0 ? (
          <p className="text-zinc-600 text-[10px] p-2 text-center">No worktrees active.</p>
        ) : (
          worktrees.map((wt) => (
              <div key={wt.id} className="flex items-center p-2 border-b border-zinc-800 last:border-b-0">
                <span className={`w-2 h-2 rounded-full mr-2
                  ${wt.status === 'active' ? 'bg-zinc-600 animate-spin' : ''}
                  ${wt.status === 'completed' && wt.mergeMode === 'gated' ? 'bg-copernicus-phosphor animate-pulse' : ''}
                  ${wt.status === 'merged' ? 'text-zinc-600' : ''}
                  ${wt.status === 'failed' ? 'bg-red-400' : ''}
                `}>
                  {wt.status === 'merged' && '✓'}
                  {wt.status === 'failed' && '✗'}
                </span>
                <span className="font-mono text-[10px] text-zinc-300 truncate mr-2 flex-1">
                  {wt.branch}
                </span>
                {wt.storyId && (
                  <span className="text-[9px] text-zinc-600 mr-2">#{wt.storyId}</span>
                )}
                {wt.commitCount > 0 && (
                  <span className="text-[9px] font-mono text-zinc-500 mr-2">{wt.commitCount} commits</span>
                )}
                <span className="text-[9px] font-mono text-zinc-500 mr-2">
                  {timeAgo(wt.createdAt)} ago
                </span>

                {wt.status === 'completed' && wt.mergeMode === 'gated' && (
                  <>
                    <button
                      onClick={() => handleReview(wt.id)}
                      className="text-[9px] font-mono text-copernicus-phosphor border border-copernicus-phosphor/30 px-2 py-0.5 rounded hover:text-zinc-300 mr-2"
                    >
                      Review
                    </button>
                    <button
                      onClick={() => handleMerge(wt.id)}
                      className="text-[9px] font-mono text-copernicus-phosphor border border-copernicus-phosphor/30 px-2 py-0.5 rounded hover:text-zinc-300 mr-2"
                    >
                      Merge
                    </button>
                  </>
                )}
                {(wt.status === 'merged' || wt.status === 'failed') && (
                  <button
                    onClick={() => handleRemove(wt.id)}
                    className="text-zinc-600 hover:text-red-400"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
    </div>
  )
}
