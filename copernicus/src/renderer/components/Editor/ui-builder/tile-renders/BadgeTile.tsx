import React from 'react'
import { UIComponentProps } from '../types'

export const BadgeTile: React.FC<{ props: UIComponentProps }> = ({ props }) => {
  const text = props.text || 'Badge'
  const colorClass = props.color || 'bg-zinc-800 text-zinc-300 border-zinc-700'

  return (
    <div className="w-full h-full overflow-hidden pointer-events-none select-none flex items-center justify-center">
      <div className={`rounded-full px-3 py-1 text-xs font-medium border ${colorClass}`}>
        {text}
      </div>
    </div>
  )
}
