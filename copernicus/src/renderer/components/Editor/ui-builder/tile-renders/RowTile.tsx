import React from 'react'
import { UIComponentProps } from '../types'

export const RowTile: React.FC<{ props: UIComponentProps }> = () => {
  return (
    <div className="w-full h-full overflow-hidden pointer-events-none select-none relative">
      <div className="w-full h-full flex flex-row items-center justify-center gap-2 p-2">
        <div className="rounded bg-zinc-800/60 border border-zinc-700/40 w-[28%] h-[60%]"></div>
        <div className="rounded bg-zinc-800/60 border border-zinc-700/40 w-[28%] h-[60%]"></div>
        <div className="rounded bg-zinc-800/60 border border-zinc-700/40 w-[28%] h-[60%]"></div>
      </div>
      <span className="absolute bottom-1 right-1 text-[8px] text-zinc-700 font-mono">ROW</span>
    </div>
  )
}
