import React, { useState, useEffect, useRef } from 'react'
import { FolderOpen, Clock } from 'lucide-react'
import { useIpcError } from '../../hooks/useIpcError'
import { useLayoutStore } from '../../store/layout'
import { unwrapIpc } from '../../types/ipc'

interface RecentProject {
  name: string
  path: string
  lastOpened: string
}

interface Props {
  onClose: () => void
}

export const ProjectSwitcher: React.FC<Props> = ({ onClose }) => {
  const invoke = useIpcError()
  const setWorkingDir = useLayoutStore(s => s.setWorkingDir)
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadRecent = async () => {
      const result = await invoke<any>('app:get-recent-projects')
      const projects = unwrapIpc<RecentProject[]>(result) || []
      setRecentProjects(projects)
    }
    loadRecent()

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [invoke, onClose])

  const handleSwitch = async (path: string) => {
    await invoke('app:switch-workspace', { path })
    setWorkingDir(path)
    onClose()
  }

  const handleOpenFolder = async () => {
    const result = await invoke<any>('app:open-folder-dialog')
    const folder = unwrapIpc<{ path: string } | null>(result)
    if (folder?.path) {
      await handleSwitch(folder.path)
    }
  }

  return (
    <div 
      ref={containerRef}
      className="absolute top-8 left-4 z-50 bg-[#0d0d0d] border border-copernicus-steel/40 rounded shadow-2xl w-80 flex flex-col font-mono overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-copernicus-steel/20 bg-black/40">
        <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">Recent Projects</span>
      </div>

      <div className="max-h-64 overflow-y-auto py-1">
        {recentProjects.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <span className="text-[10px] text-zinc-600 italic">No recent projects</span>
          </div>
        ) : (
          recentProjects.map((project) => (
            <button
              key={project.path}
              onClick={() => handleSwitch(project.path)}
              className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors group flex flex-col gap-0.5 border-b border-copernicus-steel/5 last:border-0"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-copernicus-phosphor font-bold truncate">
                  {project.name}
                </span>
                <Clock size={10} className="text-zinc-700 shrink-0" />
              </div>
              <span className="text-[9px] text-zinc-600 truncate opacity-60 group-hover:opacity-100 transition-opacity">
                {project.path}
              </span>
              <span className="text-[8px] text-zinc-700">
                {new Date(project.lastOpened).toLocaleString()}
              </span>
            </button>
          ))
        )}
      </div>

      <div className="p-1 bg-black/20 border-t border-copernicus-steel/20">
        <button
          onClick={handleOpenFolder}
          className="w-full flex items-center gap-2 px-3 py-2 hover:text-zinc-300 text-zinc-400 transition-colors rounded"
        >
          <FolderOpen size={12} />
          <span className="text-[10px] uppercase tracking-wider font-bold">Open Folder...</span>
        </button>
      </div>
    </div>
  )
}
