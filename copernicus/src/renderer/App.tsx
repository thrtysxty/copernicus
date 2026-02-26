import { useEffect, useState, useCallback } from 'react'
import { useLayoutStore, StoryboardView } from './store/layout'
import { useAgentStore } from '../store/agentStore'
import { useThemeManager } from './hooks/useThemeManager'
import { useIpcError } from './hooks/useIpcError'
import { StatusBar } from './components/layout/StatusBar'
import { SpotlightContainer } from './components/layout/SpotlightContainer'
import { FlippablePanel } from './components/layout/FlippablePanel'
import { ChatPanel } from './components/chat/ChatPanel'
import { KanbanBoard } from './components/KanbanBoard'
import { CommandDeck } from './components/CommandDeck'
import { MonacoEditor } from './components/Editor/MonacoEditor'
import { FileTree } from './components/FileTree/FileTree'
import { HelpPanel } from './components/HelpPanel'
import { GithubDashboard } from './components/github/GithubDashboard'
import { CapexModal } from './components/CapexModal'
import { TerminalTabs } from './components/Terminal/TerminalTabs'
import Wizard from './components/wizard/Wizard'
import { Terminal, Folder, Github, Settings, BarChart2, GitBranch } from 'lucide-react'
import { ToastContainer } from './components/layout/ToastContainer'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { CommandPalette } from './components/layout/CommandPalette'
import { CapexDashboard } from './components/capex/CapexDashboard'
import WorkflowCanvas from './components/workflow/WorkflowCanvas'

const ipcRenderer = window.ipcRenderer

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

function App() {
  useThemeManager()
  const invoke = useIpcError()
  
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [paletteMode, setPaletteMode] = useState<'all' | 'commands' | null>(null)

  // Command Palette Listener
  useEffect(() => {
    const removePalette = ipcRenderer.on('layout:open-palette', (_e: any, { mode }: any) => {
      setPaletteMode(mode)
    })
    return () => removePalette()
  }, [])

  // Editor and Filesystem state
  const [rootPath, setRootPath] = useState<string>('')
  const [editorValue, setEditorValue] = useState<string>('// Select a file to open it here.')
  const [editorLanguage, setEditorLanguage] = useState<string>('plaintext')
  const [openFilePath, setOpenFilePath] = useState<string | null>(null)

  // Terminal state
  const [terminalOpen, setTerminalOpen] = useState(false)
  const TERMINAL_HEIGHT = 240

  useEffect(() => {
    // Initialise agent store IPC listeners (agent:input routing)
    useAgentStore.getState().initIPCListeners()

    const params = new URLSearchParams(window.location.search)
    if (params.get('window') === 'wizard') {
      setShowWizard(true)
    }

    // Check session status on start
    invoke<any>('devtime:status')
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

    // Fetch project root path
    invoke<string>('app:get-root-path')
        .then((rp: string) => setRootPath(rp))
        .catch((err: any) => console.error('Failed to get root path:', err))
  }, [invoke])

  // Listen for external "editor:open" commands (e.g. from stories hydration)
  useEffect(() => {
    const removeEditorOpen = ipcRenderer.on(
      'editor:open',
      ({ path: filePath, content }: { path: string; content: string }) => {
        setEditorValue(content)
        setOpenFilePath(filePath)
        const ext = filePath.split('.').pop() ?? ''
        const langMap: Record<string, string> = {
          ts: 'typescript', tsx: 'typescript', js: 'javascript',
          jsx: 'javascript', py: 'python', md: 'markdown',
          json: 'json', css: 'css', html: 'html', sh: 'shell',
        }
        setEditorLanguage(langMap[ext] ?? 'plaintext')
      }
    )
    return () => removeEditorOpen()
  }, [])

  const handleFileOpen = useCallback(
    (filePath: string, content: string, language: string) => {
      setEditorValue(content)
      setEditorLanguage(language)
      setOpenFilePath(filePath)
    },
    []
  )

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
    if (ipcRenderer) {
      ipcRenderer.send('layout:update-telemetry', { storyId: activeStoryId, timer: capexTimer })
    }
  }, [activeStoryId, capexTimer])

  // Git Branch Polling
  useEffect(() => {
    const pollGit = async () => {
      try {
        const branch = await invoke<string>('git:branch')
        if (branch) setTelemetry({ gitBranch: branch })
      } catch { /* git:branch unavailable during startup */ }
    }
    
    pollGit()
    const interval = setInterval(pollGit, 30000)
    return () => clearInterval(interval)
  }, [setTelemetry, invoke])

  // Hardware and Agent UI listeners
  useEffect(() => {
    const removeViewListener = ipcRenderer.on('layout:set-view', (view: StoryboardView) => {
      setView(view)
    })
    const removeFlipListener = ipcRenderer.on('layout:toggle-flip', () => {
      toggleFlip('sidebar')
    })
    const removeSpotListener = ipcRenderer.on('layout:toggle-spotlight', () => {
      setSpotlight(spotlightPane ? null : 'editor')
    })
    const removeActivateTab = ipcRenderer.on('terminal:activate-tab', () => {
      setTerminalOpen(true)
    })

    return () => {
      removeViewListener()
      removeFlipListener()
      removeSpotListener()
      removeActivateTab()
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
            {(['blueprint', 'studio', 'engine-room', 'capex', 'workflow'] as StoryboardView[]).map((view) => (
              <button
                key={view}
                onClick={() => setView(view)}
                className={`hover:text-copernicus-phosphor transition-colors flex items-center gap-1 ${activeView === view ? 'text-copernicus-phosphor underline underline-offset-4' : ''}`}
              >
                {view === 'capex' && <BarChart2 size={10} />}
                {view === 'workflow' && <GitBranch size={10} />}
                {view}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSettingsOpen(prev => !prev)}
            className="text-zinc-500 hover:text-copernicus-phosphor transition-colors"
            title="Settings"
          >
            <Settings size={12} />
          </button>
          <div className="text-[9px] text-copernicus-steel">
            v0.1.0 :: {activeView.toUpperCase()} :: PRODUCTION_READY
          </div>
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

        {activeView === 'capex' ? (
            <CapexDashboard />
        ) : activeView === 'workflow' ? (
            <WorkflowCanvas />
        ) : (
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
                            <FileTree rootPath={rootPath} onFileOpen={handleFileOpen} />
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
                    title={openFilePath ? openFilePath.split('/').slice(-2).join('/') : 'EDITOR'}
                    onSpotlight={() => setSpotlight('editor')} 
                    onFlip={() => toggleFlip('center')}
                    isSpotlightActive={spotlightPane === 'editor'}
                    />
                    <MonacoEditor 
                        value={editorValue}
                        language={editorLanguage}
                        onChange={(v) => { if (v !== undefined) setEditorValue(v) }}
                    />
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
                    <ChatPanel openFilePath={openFilePath} rootPath={rootPath} />
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
        )}
      </div>

      {/* Terminal Panel */}
      <div
        className="w-full border-t border-copernicus-steel overflow-hidden transition-all duration-200 ease-in-out"
        style={{ height: terminalOpen ? `${TERMINAL_HEIGHT}px` : '0px' }}
      >
        <TerminalTabs />
      </div>

      {/* Terminal Toggle Bar */}
      <div
        className="h-5 w-full flex items-center px-3 gap-2 border-t border-copernicus-steel bg-[#0A0A0A] cursor-pointer select-none hover:bg-copernicus-phosphor/5"
        onClick={() => setTerminalOpen(prev => !prev)}
      >
        <span className="text-[9px] uppercase tracking-widest text-zinc-500">
          {terminalOpen ? '▼ TERMINAL' : '▲ TERMINAL'}
        </span>
        <span className="text-[8px] text-zinc-600">claude · gemini · jules</span>
      </div>

      <StatusBar />

      <CapexModal 
        type={capexType}
        isOpen={isCapexOpen}
        onClose={() => setIsCapexOpen(false)}
        session={activeSession}
      />

      {/* Toast Notifications */}
      <ToastContainer />

      {paletteMode && (
        <CommandPalette 
          mode={paletteMode} 
          onClose={() => setPaletteMode(null)} 
          onFileOpen={handleFileOpen}
          rootPath={rootPath}
        />
      )}

      {/* Settings Panel */}
      {settingsOpen && (
        <SettingsPanel onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  )
}

export default App
