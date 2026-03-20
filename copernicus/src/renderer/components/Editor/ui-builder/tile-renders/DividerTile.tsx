import React from 'react'
import { UIComponentProps } from '../types'

export const DividerTile: React.FC<{ props: UIComponentProps }> = ({ props }) => {
  return (
    <div className="w-full h-full overflow-hidden pointer-events-none select-none flex items-center justify-center relative px-2">
      <hr className="border-t border-zinc-700/60 w-full" />
      {props.text && (
        <span className="absolute bg-zinc-950 px-2 text-xs text-zinc-500">
          {props.text}
        </span>
      )}
    </div>
  )
}
