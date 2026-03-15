import React, { useEffect } from 'react'
import { Rnd } from 'react-rnd'
import { CanvasObjectData, useDesignerStore } from '../../store/designer'

interface CanvasObjectProps {
  object: CanvasObjectData
}

export const CanvasObject: React.FC<CanvasObjectProps> = ({ object }) => {
  const { selectedId, setSelectedId, updateObject, removeObject } = useDesignerStore()
  const isSelected = selectedId === object.id

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSelected && (e.key === 'Delete' || e.key === 'Backspace')) {
        // Only delete if not currently typing in an input
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
           removeObject(object.id)
        }
      }
    }
    
    if (isSelected) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isSelected, object.id, removeObject])

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedId(object.id)
  }

  const renderContent = () => {
    switch (object.type) {
      case 'container':
        return <div className="w-full h-full bg-zinc-800/50 border border-zinc-700/50 rounded" />
      case 'text':
        return <div className="w-full h-full flex items-center justify-center text-zinc-300 font-sans text-sm">{object.label || 'Text'}</div>
      case 'button':
        return <button className="w-full h-full bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium text-sm transition-colors">{object.label || 'Button'}</button>
      case 'image':
        return (
          <div className="w-full h-full bg-zinc-800 border border-zinc-700 rounded flex items-center justify-center overflow-hidden">
             <span className="text-zinc-500 text-xs font-mono">Image</span>
          </div>
        )
      case 'input':
        return <input type="text" placeholder={object.label || 'Input'} className="w-full h-full bg-zinc-900 border border-zinc-700 text-zinc-300 px-3 rounded text-sm focus:outline-none focus:border-indigo-500" readOnly />
      default:
        return null
    }
  }

  return (
    <Rnd
      position={{ x: object.x, y: object.y }}
      size={{ width: object.width, height: object.height }}
      onDragStop={(_e, d) => {
        updateObject(object.id, { x: d.x, y: d.y })
      }}
      onResizeStop={(_e, _dir, ref, _delta, pos) => {
        updateObject(object.id, {
          width: ref.offsetWidth,
          height: ref.offsetHeight,
          x: pos.x,
          y: pos.y,
        })
      }}
      onClick={handleSelect}
      bounds="parent"
      className={`absolute ${isSelected ? 'ring-2 ring-copernicus-phosphor ring-offset-1 ring-offset-[#050505] z-50' : 'z-10 hover:ring-1 hover:ring-zinc-500'}`}
      dragHandleClassName="drag-handle"
    >
      <div className="w-full h-full relative group drag-handle">
        {renderContent()}
        {isSelected && (
          <div className="absolute -top-6 left-0 bg-copernicus-phosphor text-[#050505] text-[10px] font-bold px-1.5 py-0.5 rounded-sm whitespace-nowrap z-50 pointer-events-none uppercase tracking-wider">
            {object.type}
          </div>
        )}
      </div>
    </Rnd>
  )
}
