import React from 'react'
import { UIComponentProps } from '../types'

export const InputTile: React.FC<{ props: UIComponentProps }> = ({ props }) => {
  const placeholder = props.placeholder || 'Placeholder text'

  return (
    <div className="w-full h-full overflow-hidden pointer-events-none select-none flex items-center">
      <div className="w-full rounded-md border border-zinc-700/60 bg-zinc-950 px-3 py-2 text-zinc-500 text-sm truncate">
        {placeholder}
      </div>
    </div>
  )
}
