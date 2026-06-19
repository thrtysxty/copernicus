import { useState } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import { DiagnosticsPanel } from '../debug/DiagnosticsPanel'
import { TestExplorer } from '../debug/TestExplorer'
import { LogViewer } from '../debug/LogViewer'
import { useWorkspaceStore } from '../../store/layout'

export function OutputView() {
  const [spotlightedSection, setSpotlightedSection] = useState<string | null>(null)
  const diagnosticErrorCount = useWorkspaceStore(s => s.diagnosticErrorCount)

  const toggleSpotlight = (id: string) => {
    setSpotlightedSection(spotlightedSection === id ? null : id)
  }

  const gridClass = (() => {
    if (spotlightedSection === 'problems') return 'grid-cols-[3fr_1fr] grid-rows-[3fr_1fr]'
    if (spotlightedSection === 'tests')    return 'grid-cols-[1fr_3fr] grid-rows-[3fr_1fr]'
    if (spotlightedSection === 'logs')     return 'grid-cols-2 grid-rows-[1fr_3fr]'
    return 'grid-cols-2 grid-rows-2'
  })()

  const renderHeader = (title: string, id: string) => (
    <h3 className="text-[10px] uppercase font-mono tracking-widest text-zinc-400 p-2 border-b border-copernicus-steel border-l-2 border-l-copernicus-phosphor bg-zinc-900 shrink-0 flex items-center justify-between">
      <span>{title}</span>
      <button
        onClick={() => toggleSpotlight(id)}
        className={`p-1 transition-colors ${spotlightedSection === id ? 'text-copernicus-phosphor' : 'hover:text-copernicus-phosphor'}`}
        title={spotlightedSection === id ? "Exit Spotlight" : "Spotlight Pane"}
      >
        {spotlightedSection === id ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
      </button>
    </h3>
  )

  return (
    <div data-testid="panel-output" className="flex flex-col h-full w-full bg-[#050505] text-zinc-300 overflow-hidden font-sans">
      <header className="h-8 flex items-center justify-between px-3 border-b border-white/5 shrink-0 bg-black/20">
        <h2 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-2">
          Output
          {diagnosticErrorCount > 0 && (
            <span className="text-copernicus-phosphor font-mono">{diagnosticErrorCount}</span>
          )}
        </h2>
      </header>

      <div className={`flex-1 grid gap-4 p-4 overflow-hidden w-full ${gridClass}`}>

        {/* Problems Panel */}
        <section className="flex flex-col border border-copernicus-steel bg-[#0A0A0A] overflow-hidden w-full h-full">
          {renderHeader('Problems', 'problems')}
          <div className="flex-1 overflow-auto min-h-0">
            <DiagnosticsPanel />
          </div>
        </section>

        {/* Test Runner Panel */}
        <section className="flex flex-col border border-copernicus-steel bg-[#0A0A0A] overflow-hidden w-full h-full">
          {renderHeader('Test Runner', 'tests')}
          <div className="flex-1 overflow-auto min-h-0">
            <TestExplorer />
          </div>
        </section>

        {/* Logs Panel — always spans full width */}
        <section className="col-span-2 flex flex-col border border-copernicus-steel bg-[#0A0A0A] overflow-hidden w-full h-full">
          {renderHeader('Logs', 'logs')}
          <div className="flex-1 overflow-auto min-h-0">
            <LogViewer />
          </div>
        </section>
      </div>
    </div>
  )
}
