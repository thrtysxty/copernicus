import { useEffect, useState } from 'react'
import { useCommandStore, LspState, AgentSwarmEntry, ActiveTaskEntry } from '../../store/commandStore'
import { useIpcError } from '../../hooks/useIpcError'
import { Maximize2, Minimize2, RefreshCw } from 'lucide-react'

export function CommandCenter() {
  const store = useCommandStore()
  const invoke = useIpcError()
  const [spotlightedSection, setSpotlightedSection] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const refreshData = async () => {
    setLoading(true)
    try {
      const result = await invoke<any>('lsp:status')
      if (result && result.ok && result.data) {
        store.setLspState(result.data as LspState)
      }
    } catch (err) { /* ignore */ }

    try {
      await invoke<any>('command:request-telemetry')
    } catch (err) { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => {
    const removeListener = window.ipcRenderer.on('command:telemetry-update', (_e, payload: any) => {
      store.pushTelemetry(payload)
    })
    refreshData()
    return () => { removeListener() }
  }, [invoke])

  const formatElapsed = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const formatStartedAt = (timestamp?: number) => {
    if (!timestamp) return ''
    const elapsedMs = Date.now() - timestamp
    return formatElapsed(elapsedMs)
  }

  const renderAgentStatusBadge = (status: AgentSwarmEntry['status']) => {
    const colors = {
      RUNNING: 'text-green-400',
      IDLE: 'text-zinc-500',
      STALLED: 'text-amber-400',
      ERROR: 'text-red-400'
    }
    return <span className={`text-[11px] font-mono ${colors[status]}`}>{status}</span>
  }

  const renderTaskStatusBadge = (status: ActiveTaskEntry['status']) => {
    const colors = {
      RUNNING: 'text-green-400',
      PAUSED: 'text-amber-400',
      COMPLETE: 'text-blue-400',
      FAILED: 'text-red-400'
    }
    return <span className={`text-[11px] font-mono ${colors[status]}`}>{status}</span>
  }

  const toggleSpotlight = (id: string) => {
    setSpotlightedSection(spotlightedSection === id ? null : id)
  }

  const isVisible = (id: string) => spotlightedSection === null || spotlightedSection === id

  const renderHeader = (title: string, id: string) => (
    <h3 className="text-[11px] uppercase font-mono tracking-widest text-zinc-400 p-2 border-b border-copernicus-steel border-l-2 border-l-copernicus-phosphor bg-zinc-900 shrink-0 flex items-center justify-between">
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
    <div data-testid="panel-command-center" className="flex flex-col h-full w-full bg-[#050505] text-zinc-300 overflow-hidden font-sans">
      <header className="h-8 flex items-center justify-between px-3 border-b border-white/5 shrink-0 bg-black/20">
        <h2 className="text-[11px] uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-2">
          Telemetry
        </h2>
        <button
          onClick={refreshData}
          disabled={loading}
          className="p-1 hover:text-copernicus-phosphor transition-colors disabled:opacity-50"
          title="Refresh Data"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      <div className={`flex-1 grid gap-4 p-4 overflow-hidden w-full ${spotlightedSection ? 'grid-cols-1 grid-rows-1' : 'grid-cols-2 grid-rows-2'}`}>
        
        {/* Agent Swarms */}
        {isVisible('swarms') && (
          <section className="flex flex-col border border-copernicus-steel bg-[#0A0A0A] overflow-hidden w-full h-full">
            {renderHeader('Agent Swarms', 'swarms')}
            <div className="flex-1 overflow-auto p-2">
              {store.agentSwarms.length === 0 ? (
                <div className="text-zinc-500 text-sm font-mono p-2">&mdash;</div>
              ) : (
                <ul className="space-y-2">
                  {store.agentSwarms.map((agent, i) => (
                    <li key={i} className="flex items-center justify-between text-xs p-2 bg-zinc-900/50 rounded border border-zinc-800">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{agent.name}</span>
                        {renderAgentStatusBadge(agent.status)}
                      </div>
                      {agent.status === 'RUNNING' && <span className="font-mono text-zinc-500">{formatStartedAt(agent.startedAt)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {/* Active Tasks */}
        {isVisible('tasks') && (
          <section className="flex flex-col border border-copernicus-steel bg-[#0A0A0A] overflow-hidden w-full h-full">
            {renderHeader('Active Tasks', 'tasks')}
            <div className="flex-1 overflow-auto p-2">
              {store.activeTasks.length === 0 ? (
                <div className="text-zinc-500 text-sm font-mono p-2">&mdash;</div>
              ) : (
                <ul className="space-y-2">
                  {store.activeTasks.map((task) => (
                    <li key={task.id} className="flex flex-col text-xs p-2 bg-zinc-900/50 rounded border border-zinc-800 gap-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-zinc-300 truncate" title={task.label}>{task.label}</span>
                        {renderTaskStatusBadge(task.status)}
                      </div>
                      <div className="flex items-center justify-between font-mono text-[11px] text-zinc-500">
                        <span>{task.currentNode || 'N/A'}</span>
                        <span>{formatElapsed(task.elapsedMs)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {/* LSP State */}
        {isVisible('lsp') && (
          <section className="flex flex-col border border-copernicus-steel bg-[#0A0A0A] overflow-hidden w-full h-full">
            {renderHeader('LSP State', 'lsp')}
            <div className="flex-1 overflow-auto p-2">
              {!store.lspState ? (
                <div className="text-zinc-500 text-sm font-mono p-2">&mdash;</div>
              ) : (
                <div className="flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between p-2 bg-zinc-900/50 rounded border border-zinc-800">
                    <span className="font-bold">{store.lspState.serverName}</span>
                    <div className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${store.lspState.running ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="font-mono text-[11px] text-zinc-500">{store.lspState.running ? 'Running' : 'Stopped'}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 bg-zinc-900/50 rounded border border-zinc-800 flex flex-col items-center">
                      <span className="text-[11px] font-mono text-zinc-500 uppercase">Files</span>
                      <span className="font-bold text-sm">{store.lspState.openFiles}</span>
                    </div>
                    <div className="p-2 bg-zinc-900/50 rounded border border-zinc-800 flex flex-col items-center">
                      <span className="text-[11px] font-mono text-zinc-500 uppercase">Errors</span>
                      <span className="font-bold text-sm text-red-400">{store.lspState.errorCount}</span>
                    </div>
                    <div className="p-2 bg-zinc-900/50 rounded border border-zinc-800 flex flex-col items-center">
                      <span className="text-[11px] font-mono text-zinc-500 uppercase">Warnings</span>
                      <span className="font-bold text-sm text-amber-400">{store.lspState.warningCount}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Agent Stalls */}
        {isVisible('stalls') && (
          <section className="flex flex-col border border-copernicus-steel bg-[#0A0A0A] overflow-hidden w-full h-full">
            {renderHeader('Agent Stalls', 'stalls')}
            <div className="flex-1 overflow-auto p-2">
              {store.agentStalls.length === 0 ? (
                <div className="text-zinc-500 text-sm font-mono p-2">&mdash;</div>
              ) : (
                <ul className="space-y-2">
                  {store.agentStalls.map((agent, i) => (
                    <li key={i} className="flex items-center justify-between text-xs p-2 bg-zinc-900/50 rounded border border-zinc-800">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{agent.name}</span>
                        {renderAgentStatusBadge(agent.status)}
                      </div>
                      <button className="text-[11px] font-mono uppercase tracking-widest px-2 py-1 rounded border border-zinc-700 hover:border-copernicus-phosphor hover:text-copernicus-phosphor transition-colors">
                        [Resume]
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
