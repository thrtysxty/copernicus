import React, { useEffect, useRef } from 'react';
import { useLayoutStore } from '../../store/layout';
import { Globe } from 'lucide-react';

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

  if (!canvasContent && !canvasUrl) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-700 bg-[#050505]">
        <Globe size={48} className="mb-4 opacity-20" />
        <div className="text-[10px] uppercase tracking-widest font-bold opacity-40">UI_Canvas_Idle</div>
        <div className="text-[9px] mt-2 opacity-30 italic">Awaiting strategic UI broadcast or tool preview...</div>
      </div>
    );
  }

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
};
