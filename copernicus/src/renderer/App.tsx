import { useEffect, useState } from 'react'
import { useLayoutStore, StoryboardView } from './store/layout'
import { useThemeManager } from './hooks/useThemeManager'
import { StatusBar } from './components/layout/StatusBar'
import { SpotlightContainer } from './components/layout/SpotlightContainer'
import { FlippablePanel } from './components/layout/FlippablePanel'
import { ChatPanel } from './components/chat/ChatPanel'
import { KanbanBoard } from './components/KanbanBoard'
import { CommandDeck } from './components/CommandDeck'
import { MonacoEditor } from './components/Editor/MonacoEditor'
import { HelpPanel } from './components/HelpPanel'
import { GithubDashboard } from './components/github/GithubDashboard'
import { CapexModal } from './components/CapexModal'
import Wizard from './components/wizard/Wizard'
import { FileText, Terminal, Folder, Github } from 'lucide-react'

const ipcRenderer = (window as any).ipcRenderer

// Panel Header Helper
const PanelHeader = ({ title, onSpotlight, onFlip, isSpotlightActive }: any) => (
  <div className="h-6 flex items-center justify-between px-2 bg-copernicus-bg border-b border-hairline border-copernicus-steel select-none group">
     <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest">{title}</span>
     <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
       {onFlip && (
         <button onClick={onFlip} className="text-zinc-500 hover:text-copernicus-phosphor transition-colors" title="Cycle Panel State">
           <Terminal size={10} />
         </button>
       )}
       {onSpotlight && (
         <button onClick={onSpotlight} className="text-zinc-500 hover:text-copernicus-phosphor transition-colors" title="Toggle Spotlight">
           <span className="text-[9px] uppercase font-bold">[{isSpotlightActive ? 'Exit' : 'Spot'}]</span>
         </button>
       )}
     </div>
  </div>
)

const FileNavigator = () => (
  <div className="flex-1 p-2 text-xs font-mono">
     <div className="text-copernicus-phosphor/80">src/</div>
     <div className="pl-4 text-zinc-500">renderer/</div>
     <div className="pl-8 text-zinc-400 flex items-center gap-2"><FileText size={10}/> App.tsx</div>
     <div className="pl-8 text-zinc-400 flex items-center gap-2"><FileText size={10}/> main.tsx</div>
  </div>
)

function App() {
  useThemeManager()
  
  const { 
    activeView, 
    setView, 
    toggleFlip, 
    spotlightPane, 
    setSpotlight, 
    setTelemetry,
    activeStoryId,
    flippedPanes,
    capexTimer,
    setCapexTimer
  } = useLayoutStore()

  const [showWizard, setShowWizard] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<'explorer' | 'github'>('explorer')
  const [isCapexOpen, setIsCapexOpen] = useState(false)
  const [capexType, setCapexType] = useState<'start' | 'close'>('start')
  const [activeSession, setActiveSession] = useState<any>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('window') === 'wizard') {
      setShowWizard(true)
    }

    // Check session status on start
    ipcRenderer.invoke('devtime:status')
        .then((res: any) => {
            if (!res.session) {
                setCapexType('start')
                setIsCapexOpen(true)
            } else {
                setActiveSession(res.session)
            }
        })
        .catch((err: any) => {
            console.error('Failed to fetch devtime status:', err)
        })
  }, [])

  // Timer simulation
  useEffect(() => {
    const interval = setInterval(() => {
      const [hh, mm, ss] = capexTimer.split(':').map(Number)
      let newSS = ss + 1
      let newMM = mm
      let newHH = hh
      if (newSS >= 60) {
        newSS = 0
        newMM++
      }
      if (newMM >= 60) {
        newMM = 0
        newHH++
      }
      const format = (n: number) => n.toString().padStart(2, '0')
      setCapexTimer(`${format(newHH)}:${format(newMM)}:${format(newSS)}`)
    }, 1000)
    return () => clearInterval(interval)
  }, [capexTimer, setCapexTimer])

  // Sync with Touch Bar (Push to Main)
  useEffect(() => {
    if ((window as any).ipcRenderer) {
      (window as any).ipcRenderer.send('layout:update-telemetry', { storyId: activeStoryId, timer: capexTimer })
    }
  }, [activeStoryId, capexTimer])

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
    const removeViewListener = ipcRenderer.on('layout:set-view', (_event: any, view: StoryboardView) => {
      setView(view)
    })
    const removeFlipListener = ipcRenderer.on('layout:toggle-flip', () => {
      toggleFlip('sidebar')
    })
    const removeSpotListener = ipcRenderer.on('layout:toggle-spotlight', () => {
      setSpotlight(spotlightPane ? null : 'editor')
    })

    return () => {
      removeViewListener()
      removeFlipListener()
      removeSpotListener()
    }
  }, [setView, toggleFlip, setSpotlight, spotlightPane])

  if (showWizard) {
    return <Wizard onComplete={() => setShowWizard(false)} />
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-copernicus-bg text-zinc-300 overflow-hidden font-mono">
      {/* Main Header */}
      <header className="h-[18px] w-full flex items-center justify-between px-2 bg-copernicus-bg/50 backdrop-blur-[25px] brightness-[0.4] border-b border-hairline border-copernicus-steel select-none draggable">
        <div className="flex items-center gap-4">
          <div className="text-[10px] font-bold text-copernicus-phosphor phosphor-glow tracking-widest uppercase">
            COPERNICUS // IDE
          </div>
          <nav className="flex gap-2 text-[9px] uppercase tracking-tighter text-zinc-500">
            {(['blueprint', 'studio', 'engine-room'] as StoryboardView[]).map((view) => (
              <button
                key={view}
                onClick={() => setView(view)}
                className={`hover:text-copernicus-phosphor transition-colors ${activeView === view ? 'text-copernicus-phosphor underline underline-offset-4' : ''}`}
              >
                {view}
              </button>
            ))}
          </nav>
        </div>
        <div className="text-[9px] text-copernicus-steel">
          v0.1.0 :: {activeView.toUpperCase()} :: PRODUCTION_READY
        </div>
      </header>

      {/* Main Content Area - Spotlight Container */}
      <div className="flex-1 flex flex-row overflow-hidden">
        {/* Activity Bar */}
        <div className="w-[40px] border-r border-hairline border-copernicus-steel flex flex-col items-center py-2 gap-2 bg-[#0A0A0A]">
            <button 
                onClick={() => setSidebarTab('explorer')}
                className={`p-2 rounded transition-colors ${sidebarTab === 'explorer' ? 'text-copernicus-phosphor bg-copernicus-phosphor/10' : 'text-zinc-500 hover:text-zinc-300'}`}
                title="Explorer"
            >
                <Folder size={18} />
            </button>
            <button 
                onClick={() => setSidebarTab('github')}
                className={`p-2 rounded transition-colors ${sidebarTab === 'github' ? 'text-copernicus-phosphor bg-copernicus-phosphor/10' : 'text-zinc-500 hover:text-zinc-300'}`}
                title="GitHub"
            >
                <Github size={18} />
            </button>
        </div>

        <SpotlightContainer
            sidebar={
            <FlippablePanel 
                id="sidebar"
                front={
                <div className="flex flex-col h-full bg-copernicus-bg">
                    {sidebarTab === 'explorer' ? (
                        <>
                            <PanelHeader 
                                title="EXPLORER" 
                                onSpotlight={() => setSpotlight('explorer')} 
                                onFlip={() => toggleFlip('sidebar')}
                                isSpotlightActive={spotlightPane === 'explorer'}
                            />
                            <FileNavigator />
                        </>
                    ) : (
                        <GithubDashboard />
                    )}
                </div>
                }
                back={
                <div className="flex flex-col h-full bg-copernicus-bg">
                    <PanelHeader 
                    title={flippedPanes.includes('sidebar') ? "HELP // USER GUIDE" : "COMMAND DECK"} 
                    onSpotlight={() => setSpotlight('explorer')} 
                    onFlip={() => toggleFlip('sidebar')}
                    isSpotlightActive={spotlightPane === 'explorer'}
                    />
                    {flippedPanes.includes('sidebar') ? <HelpPanel /> : <CommandDeck />}
                </div>
                }
            />
            }
            center={
            <FlippablePanel 
                id="center"
                front={
                <div className="flex flex-col h-full bg-copernicus-bg">
                    <PanelHeader 
                    title="EDITOR" 
                    onSpotlight={() => setSpotlight('editor')} 
                    onFlip={() => toggleFlip('center')}
                    isSpotlightActive={spotlightPane === 'editor'}
                    />
                    <MonacoEditor />
                </div>
                }
                back={
                <div className="flex flex-col h-full bg-copernicus-bg">
                    <PanelHeader 
                    title="UI CANVAS" 
                    onSpotlight={() => setSpotlight('editor')} 
                    onFlip={() => toggleFlip('center')}
                    isSpotlightActive={spotlightPane === 'editor'}
                    />
                    <div className="flex-1 flex items-center justify-center text-zinc-700 italic text-xs">
                    UI Canvas Rendering Gate Active
                    </div>
                </div>
                }
            />
            }
            right={
            <FlippablePanel 
                id="right"
                front={
                <div className="flex flex-col h-full bg-copernicus-bg">
                    <PanelHeader 
                    title="STRATEGIC_CHAT" 
                    onSpotlight={() => setSpotlight('telemetry')} 
                    onFlip={() => toggleFlip('right')}
                    isSpotlightActive={spotlightPane === 'telemetry'}
                    />
                    <ChatPanel />
                </div>
                }
                back={
                <div className="flex flex-col h-full bg-copernicus-bg">
                    <PanelHeader 
                    title="KANBAN_PIPELINE" 
                    onSpotlight={() => setSpotlight('telemetry')} 
                    onFlip={() => toggleFlip('right')}
                    isSpotlightActive={spotlightPane === 'telemetry'}
                    />
                    <KanbanBoard />
                </div>
                }
            />
            }
        />
      </div>

      <StatusBar />

      <CapexModal 
        type={capexType}
        isOpen={isCapexOpen}
        onClose={() => setIsCapexOpen(false)}
        session={activeSession}
      />
    </div>
  )
}

export default App
