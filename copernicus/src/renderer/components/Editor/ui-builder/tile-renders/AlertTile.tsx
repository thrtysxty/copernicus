import React from 'react'
import { UIComponentProps } from '../types'
import { AlertTriangle } from 'lucide-react'

export const AlertTile: React.FC<{ props: UIComponentProps }> = ({ props }) => {
  const text = props.text || 'Alert message'
  const colorClass = props.color || 'bg-amber-500/10 border-amber-500/30 text-amber-300'

  return (
    <div className="w-full h-full overflow-hidden pointer-events-none select-none flex items-center p-2">
      <div className={`rounded-md border px-3 py-2.5 flex items-start gap-2.5 w-full ${colorClass}`}>
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <div className="flex flex-col">
          <span className="text-sm font-medium">{text}</span>
          <span className="text-xs text-zinc-400 mt-0.5">This action may have consequences.</span>
        </div>
      </div>
    </div>
  )
}
