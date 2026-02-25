import React from 'react'
import { X } from 'lucide-react'

interface ContextChipProps {
  label: string
  onRemove: () => void
}

export const ContextChip: React.FC<ContextChipProps> = ({ label, onRemove }) => {
  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-copernicus-phosphor/10 border border-copernicus-phosphor/30 rounded text-[9px] text-copernicus-phosphor font-bold animate-in zoom-in-95 duration-200">
      <span className="uppercase">{label}</span>
      <button 
        onClick={onRemove}
        className="hover:text-white transition-colors"
      >
        <X size={10} />
      </button>
    </div>
  )
}
