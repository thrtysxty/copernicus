import React from 'react'
import { UIComponentProps } from '../types'
import { Image as ImageIcon } from 'lucide-react'

export const ImageTile: React.FC<{ props: UIComponentProps }> = ({ props }) => {
  const label = props.src ? props.src.split('/').pop() : 'image'

  return (
    <div className="w-full h-full overflow-hidden pointer-events-none select-none relative bg-gradient-to-br from-zinc-900 to-zinc-950 flex items-center justify-center">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full border-t border-zinc-800/30"></div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-full border-l border-zinc-800/30"></div>
      </div>

      <ImageIcon size={28} className="text-zinc-700 relative z-10" />

      <span className="text-[9px] text-zinc-600 font-mono absolute bottom-1.5 left-2 z-10 truncate max-w-[90%]">
        {label}
      </span>
    </div>
  )
}
