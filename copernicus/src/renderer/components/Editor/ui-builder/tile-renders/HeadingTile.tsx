import React from 'react'
import { UIComponentProps } from '../types'

export const HeadingTile: React.FC<{ props: UIComponentProps }> = ({ props }) => {
  const size = props.size || 'lg'
  const text = props.text || 'Heading'

  let sizeClass = 'text-2xl'
  if (size === 'md') sizeClass = 'text-xl'
  if (size === 'sm') sizeClass = 'text-lg'

  return (
    <div className="w-full h-full overflow-hidden pointer-events-none select-none flex items-center px-3">
      <span className={`font-bold text-zinc-100 truncate ${sizeClass}`}>
        {text}
      </span>
    </div>
  )
}
