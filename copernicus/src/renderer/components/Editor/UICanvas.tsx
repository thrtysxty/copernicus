import React, { useEffect, useRef } from 'react';
import { useLayoutStore } from '../../store/layout';
import { Globe, Code, ExternalLink, RefreshCcw } from 'lucide-react';
import { useIpcError } from '../../hooks/useIpcError';

export const UICanvas: React.FC = () => {
  const { canvasContent, canvasUrl, setCanvasUrl, setCanvasContent } = useLayoutStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const invoke = useIpcError();

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
        // re-render logic is already in useEffect
        setCanvasContent(canvasContent);
      }
    }
  };

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
      {/* Canvas Header */}
      <div className="h-6 flex items-center justify-between px-2 bg-copernicus-bg border-b border-hairline border-copernicus-steel select-none group">
        <div className="flex items-center gap-2">
          {canvasUrl ? <Globe size={10} className="text-blue-400" /> : <Code size={10} className="text-copernicus-phosphor" />}
          <span className="text-[9px] uppercase text-zinc-500 font-bold tracking-tighter">
            {canvasUrl ? 'Live Preview' : 'Component Preview'}
          </span>
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={handleRefresh} className="text-zinc-500 hover:text-copernicus-phosphor transition-colors" title="Refresh">
            <RefreshCcw size={10} />
          </button>
          {canvasUrl && (
            <button
              onClick={() => invoke('app:open-external', canvasUrl)}
              className="text-zinc-500 hover:text-copernicus-phosphor transition-colors"
              title="Open in Browser"
            >
              <ExternalLink size={10} />
            </button>
          )}
          <button
            onClick={() => { setCanvasUrl(null); setCanvasContent(null); }}
            className="text-zinc-500 hover:text-red-400 transition-colors"
            title="Clear Canvas"
          >
            <X size={10} />
          </button>
        </div>
      </div>

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

// Internal X helper
const X = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);
