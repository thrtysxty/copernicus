import React from 'react'
import { Type, Square, LayoutTemplate, Image, FormInput } from 'lucide-react'
import { PrimitiveType } from '../../store/designer'

const primitives: { type: PrimitiveType; icon: React.FC<any>; label: string }[] = [
  { type: 'container', icon: Square, label: 'Container' },
  { type: 'text', icon: Type, label: 'Text' },
  { type: 'button', icon: LayoutTemplate, label: 'Button' },
  { type: 'image', icon: Image, label: 'Image' },
  { type: 'input', icon: FormInput, label: 'Input' },
]

export const DesignerPalette: React.FC = () => {
  return (
    <div className="w-48 bg-[#080808] border-r border-zinc-800 flex flex-col h-full shrink-0">
      <div className="p-3 border-b border-zinc-800 bg-[#0A0A0A]">
        <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Primitives</h3>
      </div>
      <div className="p-2 space-y-1 overflow-y-auto no-scrollbar">
        {primitives.map((item) => (
          <div
            key={item.type}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('primitiveType', item.type)
            }}
            className="flex items-center gap-3 p-2.5 rounded hover:bg-zinc-800 cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-200 transition-colors group"
          >
            <item.icon size={14} className="group-hover:text-copernicus-phosphor transition-colors" />
            <span className="text-xs font-medium">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
