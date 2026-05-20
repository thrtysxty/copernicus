import React, { useState } from 'react'
import { useLayoutStore } from '../../store/layout'
import { ProjectSwitcher } from '../project/ProjectSwitcher'

export const ApplicationHeader: React.FC = () => {
  const { workingDir, activeStoryId } = useLayoutStore()
  const [showSwitcher, setShowSwitcher] = useState(false)
  
  // Extract repo name from workingDir
  const repoName = workingDir.split('/').pop() || 'NO_REPO'

  return (
    <header 
      className="h-10 flex items-center justify-between pl-20 pr-4 bg-[#050505] shrink-0 draggable z-[110] border-b border-zinc-800 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left: stoplights occupy pl-20, nothing else needed here */}
      <div className="w-20" />

      {/* Center: title — absolute so it's always true-centered */}
      <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
        <span className="text-[11px] font-mono font-bold tracking-[0.5em] text-zinc-400 uppercase">
          Copernicus IDE
        </span>
      </div>

      {/* Right: repo_name // story_id — no labels */}
      <div className="flex items-center relative overflow-hidden max-w-[40%]" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={() => setShowSwitcher(!showSwitcher)}
          className="text-[10px] font-mono text-copernicus-phosphor font-bold uppercase tracking-wider cursor-pointer hover:opacity-70 transition-opacity outline-none truncate max-w-[180px]"
        >
          {repoName}
        </button>
        {showSwitcher && (
          <ProjectSwitcher onClose={() => setShowSwitcher(false)} />
        )}
        <span className="text-zinc-600 mx-1.5 font-mono text-[10px]">//</span>
        <span className="text-[10px] font-mono text-copernicus-phosphor font-bold uppercase tracking-wider">
          {activeStoryId ? `#${activeStoryId.match(/\d+/)?.[0] ?? activeStoryId}` : 'UNASSIGNED'}
        </span>
      </div>
    </header>
  )
}
