import React from 'react'
import { UIComponentProps } from '../types'

export const ColumnTile: React.FC<{ props: UIComponentProps }> = () => {
  return (
    <div className="w-full h-full overflow-hidden pointer-events-none select-none relative">
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-2">
        <div className="rounded bg-zinc-800/60 border border-zinc-700/40 w-full h-[22%]"></div>
        <div className="rounded bg-zinc-800/60 border border-zinc-700/40 w-full h-[22%]"></div>
        <div className="rounded bg-zinc-800/60 border border-zinc-700/40 w-full h-[22%]"></div>
      </div>
      <span className="absolute bottom-1 right-1 text-[11px] text-zinc-700 font-mono">COL</span>
    </div>
  )
}
