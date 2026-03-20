import React from 'react'
import { UIComponentProps } from '../types'
import { ChevronDown } from 'lucide-react'

export const SelectTile: React.FC<{ props: UIComponentProps }> = ({ props }) => {
  const placeholder = props.placeholder || 'Select option'

  return (
    <div className="w-full h-full overflow-hidden pointer-events-none select-none flex items-center">
      <div className="w-full rounded-md border border-zinc-700/60 bg-zinc-950 px-3 py-2 flex items-center justify-between">
        <span className="text-zinc-500 text-sm truncate pr-2">{placeholder}</span>
        <ChevronDown size={14} className="text-zinc-600 shrink-0" />
      </div>
    </div>
  )
}
