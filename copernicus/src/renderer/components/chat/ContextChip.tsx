import React from 'react'

interface ContextChipProps {
  label: string
  onRemove?: () => void
}

export const ContextChip: React.FC<ContextChipProps> = ({ label }) => {
  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-copernicus-phosphor border border-copernicus-phosphor/30 rounded text-[11px] text-black font-bold animate-in zoom-in-95 duration-200">
      <span className="uppercase">{label}</span>
    </div>
  )
}
