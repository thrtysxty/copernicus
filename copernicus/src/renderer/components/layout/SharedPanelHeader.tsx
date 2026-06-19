import React from 'react'
import { ChevronLeft, ChevronRight, RotateCcw, MinusSquare, Maximize2 } from 'lucide-react'
import { useWorkspaceStore, PaneId } from '../../store/layout'

interface SharedPanelHeaderProps {
  id: PaneId
  name: string
  direction?: 'left' | 'right' | 'center'
  onChevron?: () => void
  onRotate?: () => void
  children?: React.ReactNode
}

export const SharedPanelHeader: React.FC<SharedPanelHeaderProps> = ({ 
  id, name, direction = 'center', onChevron, onRotate, children 
}) => {
  const { spotlightPane, setSpotlight } = useWorkspaceStore()
  const isSpotlit = spotlightPane === id

  return (
    <header className="h-8 flex items-center justify-between px-3 border-b border-white/5 bg-black/40 shrink-0 group/header select-none">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-mono">
          {name}
        </span>
        
        {direction === 'left' && onChevron && (
          <button onClick={onChevron} className="p-1 text-zinc-600 hover:text-copernicus-phosphor transition-colors" title="Shrink Panel">
            <ChevronLeft size={14} />
          </button>
        )}
        
        {direction === 'right' && onChevron && (
          <button onClick={onChevron} className="p-1 text-zinc-600 hover:text-copernicus-phosphor transition-colors" title="Shrink Panel">
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        {children}

        <div className="flex items-center gap-1.5 opacity-60 group-hover/header:opacity-100 transition-opacity">
          {onRotate && (
            <button 
              onClick={onRotate} 
              className="p-1 text-zinc-600 hover:text-copernicus-phosphor transition-colors"
              title="Rotate Panel"
            >
              <RotateCcw size={12} />
            </button>
          )}
          <button 
            onClick={() => setSpotlight(isSpotlit ? null : id)}
            className={`p-1 transition-colors ${isSpotlit ? 'text-copernicus-phosphor' : 'text-zinc-600 hover:text-zinc-300'}`}
            title={isSpotlit ? "Restore Layout" : "Maximize Panel"}
          >
            {isSpotlit ? <MinusSquare size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>
    </header>
  )
}
