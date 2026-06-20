import React, { useState, useEffect, useCallback } from 'react'
import { FolderOpen, Plus, X, Loader2 } from 'lucide-react'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc, type IpcResult } from '../../types/ipc'
import { useWorkspaceStore } from '../../store/layout'

interface FileNode {
  name: string
  path: string
  isDir: boolean
}

interface Props {
  open: boolean
  onClose: () => void
}

const PROJECTS_ROOT = '~/Projects'

export const ProjectSelectorDialog: React.FC<Props> = ({ open, onClose }) => {
  const invoke = useIpcError()
  const { setWorkingDir } = useWorkspaceStore()
  const [tab, setTab] = useState<'workspace' | 'new'>('workspace')
  const [dirs, setDirs] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [workspaceRoot, setWorkspaceRoot] = useState<string>(PROJECTS_ROOT)
  const [usingFallback, setUsingFallback] = useState<boolean>(false)
  const [isSettingsLoaded, setIsSettingsLoaded] = useState<boolean>(false)

  useEffect(() => {
    if (open) {
      setIsSettingsLoaded(false)
      invoke<IpcResult<{ workspace?: string }>>('settings:load')
        .then(result => {
          if (!result.ok) {
            setWorkspaceRoot(PROJECTS_ROOT)
            setUsingFallback(true)
            return
          }
          const settings = unwrapIpc<{ workspace?: string }>(result)
          if (settings?.workspace) {
            setWorkspaceRoot(settings.workspace)
            setUsingFallback(false)
          } else {
            setWorkspaceRoot(PROJECTS_ROOT)
            setUsingFallback(true)
          }
        })
        .catch(() => {
          setWorkspaceRoot(PROJECTS_ROOT)
          setUsingFallback(true)
        })
        .finally(() => {
          setIsSettingsLoaded(true)
        })
    }
  }, [open, invoke])

  const loadDirs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await invoke<IpcResult<FileNode[]>>('fs:list-dir', workspaceRoot)
      if (!result.ok) {
        throw new Error(result.error || 'Failed to load directories')
      }
      const entries: FileNode[] = unwrapIpc<FileNode[]>(result) ?? []
      setDirs(
        entries.filter(
          e => e.isDir && !e.name.startsWith('.') && e.name !== 'node_modules'
        )
      )
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [invoke, workspaceRoot])

  useEffect(() => {
    if (open && tab === 'workspace' && isSettingsLoaded) {
      loadDirs()
    }
  }, [open, tab, loadDirs, workspaceRoot, isSettingsLoaded])

  const selectDir = async (dirPath: string) => {
    setError(null)
    try {
      await invoke<any>('app:set-root-path', dirPath)
      setWorkingDir(dirPath)
      onClose()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setError(message)
    }
  }

  const createProject = async () => {
    if (!newName.trim()) return
    setCreating(true)
    setError(null)
    const newPath = `${PROJECTS_ROOT}/${newName.trim()}`
    try {
      await invoke<any>('fs:make-dir', newPath)
      await invoke<any>('app:set-root-path', newPath)
      setWorkingDir(newPath)
      onClose()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setError(message)
    } finally {
      setCreating(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-copernicus-steel rounded shadow-2xl w-[420px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-10 flex items-center justify-between px-4 border-b border-copernicus-steel shrink-0">
          <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-[0.25em]">SELECT PROJECT</span>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-copernicus-steel shrink-0">
          {(['workspace', 'new'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 h-8 text-[11px] font-mono uppercase tracking-widest transition-all
                ${tab === t
                  ? 'bg-copernicus-phosphor text-[#050505] rounded-none'
                  : 'text-zinc-500 hover:text-zinc-300'
                }`}
            >
              {t === 'workspace' ? 'Workspace' : 'New Project'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0 max-h-72">
          {tab === 'workspace' && (
            <>
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={16} className="animate-spin text-copernicus-phosphor" />
                </div>
              )}
              {usingFallback && (
                <div className="px-4 py-2 bg-yellow-500/10 text-yellow-500 text-[11px] font-mono border-b border-yellow-500/20">
                  No workspace configured in settings. Using fallback ~/Projects.
                </div>
              )}
              {!loading && dirs.length === 0 && !error && (
                <div className="py-8 text-center text-zinc-600 text-[11px] font-mono">
                  No directories found in {workspaceRoot}
                </div>
              )}
              {!loading && dirs.map(d => (
                <button
                  key={d.path}
                  onClick={() => selectDir(d.path)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors border-b border-zinc-800/50 text-left"
                >
                  <FolderOpen size={14} className="text-zinc-500 shrink-0" />
                  <span className="flex-1 text-[12px] font-mono text-zinc-300 truncate">{d.name}</span>
                </button>
              ))}
            </>
          )}

          {tab === 'new' && (
            <div className="p-4 space-y-3">
              <div className="text-[11px] font-mono text-zinc-600 uppercase tracking-widest">
                ~/Projects/
              </div>
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createProject() }}
                placeholder="project-name"
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-[12px] font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-copernicus-phosphor/50 transition-colors"
              />
              <button
                onClick={createProject}
                disabled={!newName.trim() || creating}
                className="w-full flex items-center justify-center gap-2 h-9 bg-copernicus-phosphor text-[#050505] rounded-none text-[11px] font-mono uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                {creating ? 'Creating…' : 'Create & Open'}
              </button>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 text-[11px] font-mono text-red-400">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
