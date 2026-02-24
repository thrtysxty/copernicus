import { useEffect } from 'react'
import { useLayoutStore, StoryboardView } from './store/layout'
import { StatusBar } from './components/layout/StatusBar'

const ipcRenderer = (window as any).ipcRenderer

function App() {
  const { 
    activeView, 
    setView, 
    isFlipped, 
    toggleFlip, 
    spotlightPane, 
    setSpotlight, 
    setTelemetry,
    activeStoryId
  } = useLayoutStore()

  // Git Branch Polling
  useEffect(() => {
    const pollGit = async () => {
      try {
        const branch = await ipcRenderer.invoke('git:branch')
        if (branch) setTelemetry({ gitBranch: branch })
      } catch (e) {}
    }
    
    pollGit()
    const interval = setInterval(pollGit, 30000)
    return () => clearInterval(interval)
  }, [setTelemetry])

  // Touch Bar Hardware Sync
  useEffect(() => {
    // 1. Listen for View changes from Touch Bar
    const removeViewListener = ipcRenderer.on('layout:set-view', (_event: any, view: StoryboardView) => {
      setView(view)
    })

    // 2. Listen for Flip toggles from Touch Bar
    const removeFlipListener = ipcRenderer.on('layout:toggle-flip', () => {
      // For now, toggle sidebar flip as the primary hardware action
      toggleFlip('sidebar')
    })

    // 3. Listen for Spotlight toggles
    const removeSpotListener = ipcRenderer.on('layout:toggle-spotlight', () => {
      // Toggle spotlight on the editor by default from hardware
      setSpotlight(spotlightPane ? null : 'editor')
    })

    return () => {
      removeViewListener()
      removeFlipListener()
      removeSpotListener()
    }
  }, [setView, toggleFlip, setSpotlight, spotlightPane])

  // Push Telemetry to Touch Bar
  useEffect(() => {
    ipcRenderer.send('telemetry:update-touchbar', {
      storyId: activeStoryId || 'NONE'
    })
  }, [activeStoryId])

  return (
    <div className="flex flex-col h-screen w-screen bg-benway-bg text-zinc-300 overflow-hidden font-mono">
      {/* Surgical Header */}
      <header className="h-[18px] w-full flex items-center justify-between px-2 bg-benway-bg/50 backdrop-blur-[25px] brightness-[0.4] border-b border-hairline border-benway-steel select-none draggable">
        <div className="flex items-center gap-4">
          <div className="text-[10px] font-bold text-benway-phosphor phosphor-glow tracking-widest uppercase">
            BENWAY // IDE
          </div>
          <nav className="flex gap-2 text-[9px] uppercase tracking-tighter text-zinc-500">
            {(['blueprint', 'studio', 'engine-room'] as StoryboardView[]).map((view) => (
              <button
                key={view}
                onClick={() => setView(view)}
                className={`hover:text-benway-phosphor transition-colors ${activeView === view ? 'text-benway-phosphor underline underline-offset-4' : ''}`}
              >
                {view}
              </button>
            ))}
          </nav>
        </div>
        <div className="text-[9px] text-benway-steel">
          v0.1.0 :: {activeView.toUpperCase()} :: SURGICAL_PHOSPHOR
        </div>
      </header>

      {/* Main Content Area - Zero Gap Tiling */}
      <div className="flex-1 flex flex-row overflow-hidden relative">
        
        {/* Sidebar Panel (Flippable: Explorer <-> Command Deck) */}
        {!spotlightPane || spotlightPane === 'explorer' ? (
          <div className={`${spotlightPane === 'explorer' ? 'flex-1' : 'w-64'} border-r border-hairline border-benway-steel flex flex-col relative group`}>
            <div className="h-6 flex items-center justify-between px-2 bg-benway-bg border-b border-hairline border-benway-steel">
              <span className="text-[10px] uppercase text-zinc-500">
                {isFlipped.sidebar ? 'Command Deck' : 'Explorer'}
              </span>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => toggleFlip('sidebar')} className="text-[9px] hover:text-benway-phosphor text-zinc-600">[FLIP]</button>
                <button onClick={() => setSpotlight(spotlightPane === 'explorer' ? null : 'explorer')} className="text-[9px] hover:text-benway-phosphor text-zinc-600">
                  {spotlightPane === 'explorer' ? '[EXIT]' : '[SPOT]'}
                </button>
              </div>
            </div>
            <div className="flex-1 p-2 text-xs overflow-auto">
              {isFlipped.sidebar ? (
                <div className="space-y-2">
                  <div className="text-benway-phosphor border border-benway-steel p-1 text-[10px]">MAKE BUILD</div>
                  <div className="text-benway-phosphor border border-benway-steel p-1 text-[10px]">MAKE TEST</div>
                  <div className="text-benway-phosphor border border-benway-steel p-1 text-[10px]">GIT STATUS</div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-benway-phosphor/80 font-bold italic text-[10px]">/JMThiessen/agentic-platform</div>
                  <div className="pl-2">
                    <div className="text-benway-phosphor/60">benway/</div>
                    <div className="pl-4 text-zinc-500">src/</div>
                    <div className="pl-8 text-zinc-400">App.tsx</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Editor / Main Canvas Panel */}
        {!spotlightPane || spotlightPane === 'editor' ? (
          <div className="flex-1 flex flex-col relative group">
            <div className="h-6 flex items-center justify-between px-2 bg-benway-bg border-b border-hairline border-benway-steel">
              <span className="text-[10px] uppercase text-zinc-500">
                {activeView === 'blueprint' ? 'Technical Architecture' : 'Editor - App.tsx'}
              </span>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setSpotlight(spotlightPane === 'editor' ? null : 'editor')} className="text-[9px] hover:text-benway-phosphor text-zinc-600">
                  {spotlightPane === 'editor' ? '[EXIT]' : '[SPOT]'}
                </button>
              </div>
            </div>
            <div className="flex-1 p-4 font-mono text-sm text-zinc-400 bg-benway-bg overflow-auto">
              {activeView === 'blueprint' ? (
                <div className="text-benway-phosphor/40 italic">-- Blueprint Mode Active: Render Markdown/Mermaid Logic Here --</div>
              ) : (
                <pre className="text-[12px] leading-tight">
                  <code className="text-zinc-500">1  </code><span className="text-purple-400">function</span> <span className="text-yellow-200">App</span>() {'{'}<br/>
                  <code className="text-zinc-500">2  </code>&nbsp;&nbsp;<span className="text-purple-400">return</span> (<br/>
                  <code className="text-zinc-500">3  </code>&nbsp;&nbsp;&nbsp;&nbsp;&lt;<span className="text-blue-400">div</span> <span className="text-green-400">className</span>=<span className="text-orange-300">"benway-os"</span>&gt;<br/>
                  <code className="text-zinc-500">4  </code>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;...<br/>
                  <code className="text-zinc-500">5  </code>&nbsp;&nbsp;&nbsp;&nbsp;&lt;/<span className="text-blue-400">div</span>&gt;<br/>
                  <code className="text-zinc-500">6  </code>&nbsp;&nbsp;)<br/>
                  <code className="text-zinc-500">7  </code>{'}'}
                </pre>
              )}
            </div>
          </div>
        ) : null}

        {/* Telemetry / Kanban / Chat Panel (Flippable) */}
        {!spotlightPane || spotlightPane === 'telemetry' ? (
          <div className={`${spotlightPane === 'telemetry' ? 'flex-1' : 'w-80'} border-l border-hairline border-benway-steel flex flex-col relative group`}>
            <div className="h-6 flex items-center justify-between px-2 bg-benway-bg border-b border-hairline border-benway-steel">
              <span className="text-[10px] uppercase text-zinc-500">
                {isFlipped.chat ? 'Industrial Kanban' : 'Telemetry // Chat'}
              </span>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => toggleFlip('chat')} className="text-[9px] hover:text-benway-phosphor text-zinc-600">[FLIP]</button>
                <button onClick={() => setSpotlight(spotlightPane === 'telemetry' ? null : 'telemetry')} className="text-[9px] hover:text-benway-phosphor text-zinc-600">
                  {spotlightPane === 'telemetry' ? '[EXIT]' : '[SPOT]'}
                </button>
              </div>
            </div>
            <div className="flex-1 p-2 font-mono text-[10px] text-zinc-500 overflow-auto">
              {isFlipped.chat ? (
                <div className="grid grid-cols-2 gap-1 h-full">
                  <div className="border border-benway-steel p-1 h-fit">TODO</div>
                  <div className="border border-benway-steel p-1 h-fit">DOING</div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div>[15:42:01] <span className="text-benway-phosphor">SYSTEM</span> Identity Rebranded to BENWAY</div>
                  <div>[15:42:02] <span className="text-blue-400">AUTH</span> Model Registry Initialized</div>
                  <div className="pt-4 border-t border-benway-steel/20">
                    <span className="text-zinc-400">Jules:</span> Resumed surgery on adaptive views.
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}

      </div>

      <StatusBar />
    </div>
  )
}

export default App
