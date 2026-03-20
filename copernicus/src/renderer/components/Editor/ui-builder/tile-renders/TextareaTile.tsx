import React from 'react'
import { UIComponentProps } from '../types'

export const TextareaTile: React.FC<{ props: UIComponentProps }> = ({ props }) => {
  const placeholder = props.placeholder || 'Placeholder text'

  return (
    <div className="w-full h-full overflow-hidden pointer-events-none select-none flex items-center">
      <div className="w-full h-[80%] rounded-md border border-zinc-700/60 bg-zinc-950 flex flex-col relative overflow-hidden">
        <div className="p-2 text-zinc-500 text-sm truncate">{placeholder}</div>
        <div className="flex-1 flex flex-col justify-evenly px-2 pb-2">
          <div className="border-t border-zinc-800/50 w-full"></div>
          <div className="border-t border-zinc-800/50 w-full"></div>
          <div className="border-t border-zinc-800/50 w-full"></div>
        </div>
      </div>
    </div>
  )
}
