import React, { useEffect, useRef } from 'react';
import { useLayoutStore } from '../../store/layout';
import { Globe } from 'lucide-react';
import { DesignerPalette } from '../designer/DesignerPalette';
import { CanvasObject } from '../designer/CanvasObject';
import { useDesignerStore, PrimitiveType, CanvasObjectData } from '../../store/designer';

// Simple UUID generator to avoid introducing external dependencies
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export const UICanvas: React.FC = () => {
  const { canvasContent, canvasUrl, setCanvasUrl, setCanvasContent } = useLayoutStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (canvasContent && iframeRef.current) {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <script src="https://cdn.tailwindcss.com"></script>
              <style>
                body { background: #050505; color: #e4e4e7; font-family: sans-serif; margin: 0; padding: 1rem; }
                ::-webkit-scrollbar { width: 6px; height: 6px; }
                ::-webkit-scrollbar-track { background: #050505; }
                ::-webkit-scrollbar-thumb { background: #3F3F46; }
              </style>
            </head>
            <body>
              <div id="root">${canvasContent}</div>
            </body>
          </html>
        `);
        doc.close();
      }
    }
  }, [canvasContent]);

  const handleRefresh = () => {
    if (iframeRef.current) {
      if (canvasUrl) {
        iframeRef.current.src = canvasUrl;
      } else if (canvasContent) {
        setCanvasContent(canvasContent);
      }
    }
  };

  useEffect(() => {
    const removeRefresh = window.ipcRenderer.on('canvas:refresh', () => {
      handleRefresh();
    });
    const removeClear = window.ipcRenderer.on('canvas:clear', () => {
      setCanvasUrl(null);
      setCanvasContent(null);
    });
    return () => {
      removeRefresh();
      removeClear();
    };
  }, [canvasUrl, canvasContent]);

  const { objects, selectedId, addObject, updateObject, setSelectedId } = useDesignerStore();
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const primitiveType = e.dataTransfer.getData('primitiveType') as PrimitiveType;
    if (!primitiveType) return;

    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let width = 100;
    let height = 40;
    
    if (primitiveType === 'container') {
      width = 200;
      height = 200;
    } else if (primitiveType === 'image') {
      width = 150;
      height = 150;
    }

    const newObject: CanvasObjectData = {
      id: uuidv4(),
      type: primitiveType,
      x,
      y,
      width,
      height,
      label: primitiveType.charAt(0).toUpperCase() + primitiveType.slice(1),
    };

    addObject(newObject);
    setSelectedId(newObject.id);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const selectedObject = objects.find((o) => o.id === selectedId);

  // If there is content/url, show the iframe. Otherwise, show the interactive designer canvas.
  if (canvasContent || canvasUrl) {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#050505]">
        {/* Content Area */}
        <div className="flex-1 relative bg-white rounded-sm m-2 overflow-hidden shadow-2xl">
          <iframe
            ref={iframeRef}
            src={canvasUrl || 'about:blank'}
            className="w-full h-full border-none"
            sandbox="allow-scripts allow-forms allow-same-origin"
            title="UI Canvas Preview"
          />
        </div>

        {canvasUrl && (
          <div className="h-4 px-2 border-t border-hairline border-copernicus-steel flex items-center bg-[#0A0A0A]">
            <span className="text-[8px] text-zinc-600 font-mono truncate">{canvasUrl}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex h-full bg-[#050505] overflow-hidden">
      <DesignerPalette />
      
      <div className="flex-1 flex flex-col min-w-0">
        <div 
          ref={canvasRef}
          className="flex-1 relative bg-[#0a0a0a] m-2 rounded-sm border border-zinc-800 shadow-inner overflow-hidden"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => setSelectedId(null)}
        >
          {objects.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-700 pointer-events-none">
              <Globe size={48} className="mb-4 opacity-20" />
              <div className="text-[10px] uppercase tracking-widest font-bold opacity-40">Designer Canvas</div>
              <div className="text-[9px] mt-2 opacity-30 italic">Drag primitives from the palette to start building</div>
            </div>
          )}

          {objects.map((obj) => (
            <CanvasObject key={obj.id} object={obj} />
          ))}
        </div>
      </div>
      
      {/* Properties Inspector */}
      {selectedObject && (
        <div className="w-64 bg-[#080808] border-l border-zinc-800 flex flex-col shrink-0">
          <div className="p-3 border-b border-zinc-800 bg-[#0A0A0A]">
            <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Properties</h3>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-1">Type</label>
              <div className="text-sm text-zinc-300 font-medium capitalize">{selectedObject.type}</div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-1">X</label>
                <input 
                  type="number" 
                  value={Math.round(selectedObject.x)}
                  onChange={(e) => updateObject(selectedObject.id, { x: Number(e.target.value) })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm text-zinc-300 font-mono focus:border-copernicus-phosphor focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-1">Y</label>
                <input 
                  type="number" 
                  value={Math.round(selectedObject.y)}
                  onChange={(e) => updateObject(selectedObject.id, { y: Number(e.target.value) })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm text-zinc-300 font-mono focus:border-copernicus-phosphor focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-1">Width</label>
                <input 
                  type="number" 
                  value={Math.round(selectedObject.width)}
                  onChange={(e) => updateObject(selectedObject.id, { width: Number(e.target.value) })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm text-zinc-300 font-mono focus:border-copernicus-phosphor focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-1">Height</label>
                <input 
                  type="number" 
                  value={Math.round(selectedObject.height)}
                  onChange={(e) => updateObject(selectedObject.id, { height: Number(e.target.value) })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm text-zinc-300 font-mono focus:border-copernicus-phosphor focus:outline-none"
                />
              </div>
            </div>

            {['text', 'button', 'input'].includes(selectedObject.type) && (
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-1">Label</label>
                <input 
                  type="text" 
                  value={selectedObject.label || ''}
                  onChange={(e) => updateObject(selectedObject.id, { label: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm text-zinc-300 focus:border-copernicus-phosphor focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
