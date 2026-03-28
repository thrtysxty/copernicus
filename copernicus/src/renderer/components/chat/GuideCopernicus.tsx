import React from 'react'
import { Send } from 'lucide-react'
import { useLayoutStore } from '../../store/layout'
import { Message } from './useChatPanel'

interface GuideCopernicusProps {
  guideMessages: Message[]
  guideInput: string
  setGuideInput: (v: string) => void
  handleGuideSubmit: () => void
  showClaudeFallback: boolean
  handleAskClaude: () => void
  setShowClaudeFallback: (v: boolean) => void
  guideScrollRef: React.RefObject<HTMLDivElement>
}

export const GuideCopernicus: React.FC<GuideCopernicusProps> = ({
  guideMessages,
  guideInput,
  setGuideInput,
  handleGuideSubmit,
  showClaudeFallback,
  handleAskClaude,
  setShowClaudeFallback,
  guideScrollRef,
}) => {
  const { retakeTour } = useLayoutStore()

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] border border-copernicus-steel/20 rounded overflow-hidden">
      {/* Message Feed */}
      <div 
        ref={guideScrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin scrollbar-thumb-copernicus-steel"
      >
        {guideMessages.length === 0 ? (
           <div className="h-full flex flex-col items-center justify-center p-8 text-center opacity-40">
              <div className="text-copernicus-phosphor font-mono text-lg mb-2 glow-sm tracking-tighter uppercase">© Copernicus</div>
              <div className="text-zinc-500 text-[10px] font-mono uppercase tracking-[0.2em]">Ready_To_Assist</div>
           </div>
        ) : (
          guideMessages.map(m => (
            <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end ml-auto' : 'items-start mr-auto'} max-w-[90%]`}>
              <div className="flex items-center gap-1.5 mb-1 px-1">
                {m.role === 'copernicus' && <span className="text-copernicus-phosphor font-mono text-[10px] font-bold">CP</span>}
                <span className={`text-[8px] uppercase font-bold tracking-widest font-mono ${m.role === 'user' ? 'text-zinc-500' : 'text-copernicus-phosphor'}`}>
                  {m.role === 'user' ? 'DEVELOPER' : 'COPERNICUS'}
                </span>
              </div>
              <div className={`p-3 text-xs border rounded transition-all duration-300 ${
                m.role === 'user' 
                  ? 'bg-copernicus-phosphor border-copernicus-phosphor/20 text-black rounded-l-md rounded-tr-md'
                  : 'bg-zinc-900/50 border-zinc-700 text-zinc-200 rounded-r-md rounded-tl-md'
              }`}>
                <div className="whitespace-pre-wrap">{typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}</div>
                {m.showTourButton && (
                  <button
                    onClick={() => retakeTour()}
                    className="mt-3 w-full py-1.5 bg-copernicus-phosphor text-[#050505] font-bold text-[9px] uppercase tracking-widest hover:opacity-90 transition-opacity"
                  >
                    Start Tour
                  </button>
                )}
              </div>
            </div>
          ))
        )}

        {showClaudeFallback && (
          <div className="bg-zinc-900/80 border border-copernicus-phosphor/30 p-4 rounded animate-in fade-in slide-in-from-bottom-2">
            <div className="text-xs text-zinc-300 mb-3 leading-relaxed">
              I don't have a quick answer for that — but Claude can help.
              Want me to send this question to your active chat session?
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleAskClaude}
                className="flex-1 bg-copernicus-phosphor text-[#050505] text-[9px] font-bold py-2 uppercase tracking-wider"
              >
                Yes, ask Claude
              </button>
              <button 
                onClick={() => setShowClaudeFallback(false)}
                className="flex-1 border border-zinc-700 text-zinc-400 text-[9px] font-bold py-2 uppercase tracking-wider hover:bg-white/5 transition-colors"
              >
                Never mind
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Input Field */}
      <div className="p-2 bg-[#080808] border-t border-copernicus-steel/30">
        <div className="relative flex items-center bg-zinc-900 border border-copernicus-steel focus-within:border-copernicus-phosphor transition-all rounded p-1.5">
          <input
            value={guideInput}
            onChange={e => setGuideInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleGuideSubmit()
            }}
            placeholder="Ask Copernicus..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-xs text-zinc-300 px-2 py-1 font-mono"
          />
          <button 
            onClick={handleGuideSubmit}
            disabled={!guideInput.trim()}
            className="p-1.5 text-zinc-600 hover:text-copernicus-phosphor transition-colors disabled:opacity-30"
          >
            <Send size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}
