import React, { useState } from 'react'

interface ImageViewerProps {
  filePath: string | null
  isSvg?: boolean
  onEditSource?: () => void
}

export function ImageViewer({ filePath, isSvg, onEditSource }: ImageViewerProps) {
  const [zoom, setZoom] = useState(1)
  const [naturalSize, setNaturalSize] = useState<{w:number;h:number} | null>(null)

  const src = filePath ? `file://${filePath}` : null

  const handleWheel = (e: React.WheelEvent) => {
    // Zoom with Ctrl + Wheel or just Wheel? Story says wheel.
    // To prevent interfering with scroll, we'll use a small delta.
    setZoom(prev => Math.min(8, Math.max(0.1, prev - e.deltaY * 0.001)))
  }

  return (
    <div className="flex flex-col h-full bg-copernicus-bg select-none">
      {/* Toolbar */}
      <div className="h-7 flex items-center gap-3 px-3 border-b border-copernicus-steel bg-copernicus-bg text-[11px] font-mono text-zinc-500 flex-shrink-0">
        <span className="truncate max-w-[200px]">{filePath?.split('/').pop()}</span>
        {naturalSize && (
          <span className="text-zinc-600 flex-shrink-0">{naturalSize.w}×{naturalSize.h}</span>
        )}
        <div className="flex items-center gap-1 ml-auto flex-shrink-0">
          <button 
            onClick={() => setZoom(v => Math.min(8, v + 0.25))}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/5 hover:text-copernicus-phosphor transition-colors"
          >+</button>
          <span className="text-zinc-700 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button 
            onClick={() => setZoom(v => Math.max(0.1, v - 0.25))}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/5 hover:text-copernicus-phosphor transition-colors"
          >−</button>
          <button 
            onClick={() => setZoom(1)} 
            className="ml-1 px-1.5 h-5 flex items-center justify-center rounded hover:bg-white/5 hover:text-copernicus-phosphor transition-colors"
          >1:1</button>
          <button 
            onClick={() => setZoom(0.5)} 
            className="px-1.5 h-5 flex items-center justify-center rounded hover:bg-white/5 hover:text-copernicus-phosphor transition-colors"
          >½</button>
        </div>
      </div>

      {/* Image Area */}
      <div 
        className="flex-1 overflow-auto flex items-center justify-center bg-[#050505] cursor-zoom-in relative"
        onWheel={handleWheel}
      >
        {src && (
          <img
            src={src}
            alt={filePath ?? ''}
            onLoad={(e) => {
              const img = e.currentTarget
              setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
            }}
            style={{ 
              transform: `scale(${zoom})`, 
              transformOrigin: 'center', 
              imageRendering: zoom > 2 ? 'pixelated' : 'auto' 
            }}
            className="max-w-none transition-transform duration-100 shadow-2xl"
            draggable={false}
          />
        )}

        {isSvg && onEditSource && (
          <button
            onClick={onEditSource}
            className="absolute bottom-3 right-3 px-3 py-1 rounded text-[11px] font-mono uppercase 
                       tracking-wider bg-zinc-900 border border-copernicus-steel text-zinc-400
                       hover:text-copernicus-phosphor hover:border-copernicus-phosphor/40 transition-colors"
          >
            Edit Source
          </button>
        )}
      </div>
    </div>
  )
}
