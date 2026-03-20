import React from 'react'
import { UIComponentProps } from '../types'

export const CardTile: React.FC<{ props: UIComponentProps }> = () => {
  return (
    <div className="w-full h-full overflow-hidden pointer-events-none select-none flex items-center justify-center p-2">
      <div className="rounded-lg border border-zinc-700/60 bg-zinc-900 w-full h-full flex flex-col overflow-hidden">
        <div className="bg-zinc-800/60 px-3 py-2 h-[35%] flex flex-col justify-center">
          <div className="bg-zinc-600/50 rounded h-2.5 w-1/2"></div>
          <div className="bg-zinc-700/40 rounded h-2 w-1/3 mt-1.5"></div>
        </div>
        <div className="flex-1 px-3 py-2 flex flex-col gap-2 justify-center">
          <div className="bg-zinc-800/40 rounded h-1.5 w-full"></div>
          <div className="bg-zinc-800/40 rounded h-1.5 w-5/6"></div>
          <div className="bg-zinc-800/40 rounded h-1.5 w-2/3"></div>
        </div>
      </div>
    </div>
  )
}
