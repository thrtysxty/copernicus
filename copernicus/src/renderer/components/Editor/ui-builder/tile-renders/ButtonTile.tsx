import React from 'react'
import { UIComponentProps } from '../types'

export const ButtonTile: React.FC<{ props: UIComponentProps }> = ({ props }) => {
  const variant = props.variant || 'primary'
  const size = props.size || 'md'
  const text = props.text || 'Button'

  let variantClass = ''
  if (variant === 'primary') {
    variantClass = 'bg-copernicus-phosphor text-[#050505]'
  } else if (variant === 'secondary') {
    variantClass = 'bg-zinc-800 text-zinc-200 border border-zinc-700'
  } else if (variant === 'ghost') {
    variantClass = 'bg-transparent text-zinc-300 border border-zinc-700'
  } else if (variant === 'danger') {
    variantClass = 'bg-red-500/20 text-red-400 border border-red-500/40'
  }

  let sizeClass = ''
  if (size === 'sm') {
    sizeClass = 'text-xs px-3 py-1'
  } else if (size === 'md') {
    sizeClass = 'text-sm px-4 py-2'
  } else if (size === 'lg') {
    sizeClass = 'text-base px-5 py-2.5'
  }

  return (
    <div className="w-full h-full overflow-hidden pointer-events-none select-none flex items-center justify-center">
      <div className={`rounded-md font-medium shadow-sm flex items-center justify-center ${variantClass} ${sizeClass}`}>
        {text}
      </div>
    </div>
  )
}
