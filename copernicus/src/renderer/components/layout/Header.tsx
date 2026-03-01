import React from 'react'
import { useLayoutStore } from '../../store/layout'

export const Header: React.FC = () => {
  const { workingDir, gitBranch } = useLayoutStore()

  return (
    <header className="h-9 flex-none pl-20 pr-3 flex items-center justify-between bg-copernicus-bg border-b border-copernicus-steel select-none z-50 drag-region">
      <span className="text-[10px] font-mono font-bold text-copernicus-phosphor/60 uppercase tracking-[0.3em]">
        COPERNICUS
      </span>
      <div className="flex items-center gap-4 text-[9px] font-mono text-zinc-600 uppercase">
        <span className="truncate max-w-[200px]">{workingDir}</span>
        <span>{gitBranch}</span>
      </div>
    </header>
  )
}
