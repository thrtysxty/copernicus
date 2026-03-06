import React from 'react'
import { useLayoutStore } from '../../store/layout'

export const ApplicationHeader: React.FC = () => {
  const { workingDir, activeStoryId } = useLayoutStore()
  
  // Extract repo name from workingDir
  const repoName = workingDir.split('/').pop() || 'NO_REPO'

  return (
    <header className="h-8 flex items-center justify-between px-4 bg-[#050505] shrink-0 draggable z-[110] border-b border-copernicus-steel/30 select-none pl-20">
      {/* Left: Stoplights (pl-20) and then repo // story_id */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-tighter font-black italic">Repo //</span>
          <span className="text-[10px] font-mono text-copernicus-phosphor truncate font-bold uppercase tracking-wider">
            {repoName}
          </span>
          <span className="text-zinc-800 mx-1">/</span>
          <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-tighter font-black italic">Story //</span>
          <span className="text-[10px] font-mono text-copernicus-phosphor truncate font-bold uppercase tracking-wider">
            {activeStoryId || 'UNASSIGNED'}
          </span>
        </div>
      </div>

      {/* Center: Copernicus IDE */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center">
        <span className="text-[11px] font-mono font-bold tracking-[0.5em] text-zinc-400 uppercase">
          Copernicus IDE
        </span>
      </div>

      {/* Right: Empty space for symmetry or window controls */}
      <div className="w-40" />
    </header>
  )
}
