import { useState } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import { MemoryBrowser } from '../memory/MemoryBrowser'
import { ReplayPanel } from '../debug/ReplayPanel'

export function MemoryReplayView() {
  const [spotlightedSection, setSpotlightedSection] = useState<string | null>(null)

  const toggleSpotlight = (id: string) => {
    setSpotlightedSection(spotlightedSection === id ? null : id)
  }

  const renderHeader = (title: string, id: string) => (
    <h3 className="text-[10px] uppercase font-mono tracking-widest text-zinc-400 p-2 border-b border-copernicus-steel border-l-2 border-l-copernicus-phosphor bg-zinc-900 shrink-0 flex items-center justify-between">
      <span>{title}</span>
      <button
        onClick={() => toggleSpotlight(id)}
        className={`p-1 transition-colors ${spotlightedSection === id ? 'text-copernicus-phosphor' : 'hover:text-copernicus-phosphor'}`}
        title={spotlightedSection === id ? 'Exit Spotlight' : 'Spotlight Pane'}
      >
        {spotlightedSection === id ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
      </button>
    </h3>
  )

  const renderBookmark = (title: string, id: string) => (
    <section
      className="w-10 shrink-0 flex flex-col items-center border border-copernicus-steel bg-[#0A0A0A] overflow-hidden h-full cursor-pointer hover:border-zinc-600 transition-colors"
      onClick={() => toggleSpotlight(id)}
      title={`Expand ${title}`}
    >
      <div className="flex flex-col items-center pt-2 pb-2 h-full gap-2">
        <Maximize2 size={10} className="text-zinc-500 shrink-0" />
        <span className="flex-1 flex items-center [writing-mode:vertical-rl] rotate-180 text-[10px] uppercase font-mono tracking-widest text-zinc-500 select-none">
          {title}
        </span>
      </div>
    </section>
  )

  return (
    <div className="flex flex-col h-full w-full bg-[#050505] text-zinc-300 overflow-hidden font-sans">
      <header className="h-8 flex items-center justify-between px-3 border-b border-white/5 shrink-0 bg-black/20">
        <h2 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
          Memory & Replay
        </h2>
      </header>

      <div className="flex-1 flex gap-4 p-4 overflow-hidden w-full">

        {spotlightedSection === 'replay' ? renderBookmark('Agent Memory', 'memory') : (
          <section className="flex-1 flex flex-col border border-copernicus-steel bg-[#0A0A0A] overflow-hidden h-full">
            {renderHeader('Agent Memory', 'memory')}
            <div className="flex-1 overflow-auto min-h-0">
              <MemoryBrowser hideHeader />
            </div>
          </section>
        )}

        {spotlightedSection === 'memory' ? renderBookmark('Session Replay', 'replay') : (
          <section className="flex-1 flex flex-col border border-copernicus-steel bg-[#0A0A0A] overflow-hidden h-full">
            {renderHeader('Session Replay', 'replay')}
            <div className="flex-1 overflow-auto min-h-0">
              <ReplayPanel />
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
