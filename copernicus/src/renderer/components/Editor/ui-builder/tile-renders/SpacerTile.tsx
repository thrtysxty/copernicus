import React from 'react'
import { UIComponentProps } from '../types'

export const SpacerTile: React.FC<{ props: UIComponentProps }> = () => {
  return (
    <div className="w-full h-full overflow-hidden pointer-events-none select-none">
      <div className="w-full h-full border border-dashed border-zinc-800/40 bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(255,255,255,0.02)_6px,rgba(255,255,255,0.02)_7px)] flex items-center justify-center">
        <span className="text-[11px] text-zinc-700 font-mono tracking-widest">SPACER</span>
      </div>
    </div>
  )
}
