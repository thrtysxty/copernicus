import React from 'react'
import { UIComponentProps } from '../types'

export const ContainerTile: React.FC<{ props: UIComponentProps }> = () => {
  return (
    <div className="w-full h-full overflow-hidden pointer-events-none select-none">
      <div className="w-full h-full rounded-md border border-dashed border-zinc-700/40 bg-zinc-900/10 bg-[radial-gradient(circle,_#3f3f46_1px,_transparent_1px)] bg-[length:12px_12px] opacity-30">
      </div>
    </div>
  )
}
