import React, { useState, useEffect } from 'react'
import {
  Settings as SettingsIcon,
  Layout as LayoutIcon,
  Code,
  Trello,
  Zap,
  Activity,
  GitBranch,
  FolderOpen
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// Stores
import { useLayoutStore, PaneId } from './store/layout'

// Components
import { Header } from './components/layout/Header'
import { ChatPanel } from './components/chat/ChatPanel'
import { FileTree } from './components/FileTree/FileTree'
import { CenterPanelRouter } from './components/Editor/CenterPanelRouter'
import { TelemetryPanel } from './components/telemetry/TelemetryPanel'
import { KanbanBoard } from './components/KanbanBoard'
import { TerminalTabs } from './components/Terminal/TerminalTabs'
import { CommandPalette } from './components/layout/CommandPalette'
import { ToastContainer } from './components/common/Toast'
import Wizard from './components/wizard/Wizard'
import { Splash } from './components/layout/Splash'
import WorkflowCanvas from './components/workflow/WorkflowCanvas'

// Types
const ipcRenderer = (window as any).ipcRenderer

const App: React.FC = () => {
  const {
    activeView, setView,
    spotlightPane, setSpotlight,
    isFlipped, toggleFlip,
    sidebarOpen,
    terminalOpen,
    phosphorColor, workingDir, gitBranch, isGitDirty,
    leftPanelMode, toggleLeftPanelMode,
    rightPanelMode, toggleRightPanelMode,
    setWorkingDir, setGitBranch,
  } = useLayoutStore()

  const [isReady, setIsReady] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  // Initialization
  useEffect(() => {
    // Check if we should show the wizard
    const params = new URLSearchParams(window.location.search)
    if (params.get('window') === 'wizard') {
      setShowWizard(true)
      setIsReady(true)
      return
    }

    // Load initial state
    const init = async () => {
      try {
        const settings = await ipcRenderer.invoke('settings:load')
        if (settings && settings.workspace) {
          setWorkingDir(settings.workspace)
        }
        
        const branch = await ipcRenderer.invoke('git:branch')
        setGitBranch(branch)
        
        // Signal splash we are ready
        setTimeout(() => {
          setIsReady(true)
          ipcRenderer.send('splash-ready')
        }, 1500)
      } catch (err) {
        console.error('Failed to initialize app:', err)
        setIsReady(true)
      }
    }

    init()
  }, [])

  // Global IPC listeners
  useEffect(() => {
    const removeView = ipcRenderer.on('layout:set-view', (_e: any, view: any) => setView(view))
    const removeSpotlight = ipcRenderer.on('layout:toggle-spotlight', (_e: any, pane: PaneId) => setSpotlight(pane))
    const removePalette = ipcRenderer.on('layout:open-palette', () => setCommandPaletteOpen(true))

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'p') { e.preventDefault(); setCommandPaletteOpen(true) }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      removeView()
      removeSpotlight()
      removePalette()
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [setView, setSpotlight])

  if (!isReady) return <Splash />
  if (showWizard) return <Wizard onComplete={() => setShowWizard(false)} />

  return (
    <div className={`flex flex-col h-screen w-screen bg-copernicus-bg text-zinc-300 font-sans select-none phosphor-${phosphorColor}`}>
      <Header />
      
      <main className="flex-1 flex overflow-hidden relative">
        {commandPaletteOpen && (
          <CommandPalette
            mode="all"
            rootPath={workingDir}
            onClose={() => setCommandPaletteOpen(false)}
            onFileOpen={() => setCommandPaletteOpen(false)}
          />
        )}
        <ToastContainer />

        {/* Sidebar Nav */}
        <nav className="w-12 flex-none border-r border-hairline border-copernicus-steel flex flex-col items-center py-4 gap-4 bg-copernicus-bg z-20">
          <NavIcon icon={<Code size={18} />} active={activeView === 'studio'} onClick={() => setView('studio')} tooltip="Studio" />
          <NavIcon icon={<Trello size={18} />} active={activeView === 'blueprint'} onClick={() => setView('blueprint')} tooltip="Blueprint" />
          <NavIcon icon={<Zap size={18} />} active={activeView === 'workflow'} onClick={() => setView('workflow')} tooltip="Workflow" />
          <NavIcon icon={<Activity size={18} />} active={activeView === 'engine-room'} onClick={() => setView('engine-room')} tooltip="Engine Room" />
          
          <div className="mt-auto flex flex-col gap-4 mb-2">
            <NavIcon icon={<SettingsIcon size={18} />} active={activeView === 'capex'} onClick={() => setView('capex')} tooltip="Settings" />
          </div>
        </nav>

        {/* Left Panel (Explorer / Command Deck) */}
        <AnimatePresence initial={false}>
          {sidebarOpen && activeView === 'studio' && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="flex-none border-r border-hairline border-copernicus-steel bg-copernicus-bg flex flex-col overflow-hidden"
            >
              <div className="h-8 flex items-center justify-between px-3 border-b border-hairline border-copernicus-steel shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  {leftPanelMode === 'explorer' ? 'Explorer' : 'Commands'}
                </span>
                <button onClick={toggleLeftPanelMode} className="text-zinc-600 hover:text-copernicus-phosphor transition-colors">
                  <LayoutIcon size={12} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {leftPanelMode === 'explorer' ? (
                  <FileTree rootPath={workingDir} />
                ) : (
                  <div className="p-4 text-[10px] font-mono text-zinc-600 uppercase tracking-tighter">Command_Deck_Offline</div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Center Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#050505] relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {activeView === 'studio' && (
                <div className="flex-1 flex overflow-hidden relative">
                  <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${spotlightPane === 'editor' ? 'z-30 absolute inset-0 bg-[#050505]' : ''}`}>
                    <CenterPanelRouter />
                  </div>
                  
                  {/* Studio Right Panel (Chat / Telemetry / Kanban) */}
                  <div className={`w-80 flex-none border-l border-hairline border-copernicus-steel flex flex-col bg-copernicus-bg transition-all duration-300 ${spotlightPane === 'telemetry' ? 'z-30 absolute inset-0 w-full' : ''}`}>
                    <div className="flex-1 flex flex-col overflow-hidden relative">
                       {/* Contextual Flipping Pane */}
                       <div className="flex-1 relative">
                          <div className={`absolute inset-0 transition-all duration-500 transform-gpu preserve-3d ${isFlipped['chat'] ? 'rotate-y-180' : ''}`}>
                             {/* Front: Chat */}
                             <div className="absolute inset-0 backface-hidden flex flex-col">
                                <ChatPanel rootPath={workingDir} />
                             </div>
                             {/* Back: Telemetry or Kanban */}
                             <div className="absolute inset-0 backface-hidden rotate-y-180 flex flex-col bg-copernicus-bg">
                                <div className="h-6 flex items-center justify-between px-2 bg-copernicus-bg border-b border-hairline border-copernicus-steel shrink-0">
                                   <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest">
                                      {rightPanelMode === 'telemetry' ? 'Telemetry' : 'Kanban'}
                                   </span>
                                   <div className="flex items-center gap-2">
                                      <button onClick={toggleRightPanelMode} className="text-zinc-600 hover:text-copernicus-phosphor">
                                         <LayoutIcon size={10} />
                                      </button>
                                      <button onClick={() => toggleFlip('chat')} className="text-zinc-600 hover:text-copernicus-phosphor">
                                         <RotateCcw size={10} className="transform scale-x-[-1]" />
                                      </button>
                                   </div>
                                </div>
                                <div className="flex-1 overflow-hidden">
                                   {rightPanelMode === 'telemetry' ? <TelemetryPanel /> : <div className="p-4 text-xs font-mono text-zinc-600 uppercase">Contextual_Kanban_v2</div>}
                                </div>
                             </div>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              )}

              {activeView === 'blueprint' && <KanbanBoard />}
              {activeView === 'workflow' && <WorkflowCanvas />}
              {activeView === 'engine-room' && (
                <div className="flex-1 flex items-center justify-center font-mono text-[10px] text-zinc-600 uppercase tracking-[0.2em]">
                   Engine_Room_Nominal // Monitoring_Pipes_Active
                </div>
              )}
              {activeView === 'capex' && (
                <div className="flex-1 flex items-center justify-center font-mono text-[10px] text-zinc-600 uppercase tracking-[0.2em]">
                   CapEx_Dashboard_v2 // Global_Settings_Sync
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Bottom Terminal */}
          <AnimatePresence>
            {terminalOpen && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 200 }}
                exit={{ height: 0 }}
                className="flex-none border-t border-hairline border-copernicus-steel bg-copernicus-bg overflow-hidden relative z-40"
              >
                <TerminalTabs />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Status Bar */}
      <footer className="h-6 flex-none border-t border-hairline border-copernicus-steel bg-copernicus-bg flex items-center justify-between px-3 text-[9px] font-mono text-zinc-500 select-none z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-copernicus-phosphor shadow-[0_0_5px_rgba(74,222,128,0.5)]"></div>
            <span className="uppercase tracking-wider">System_Ready</span>
          </div>
          <div className="flex items-center gap-1.5 hover:text-zinc-300 cursor-pointer transition-colors uppercase">
            <FolderOpen size={10} />
            <span className="max-w-[200px] truncate">{workingDir}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 hover:text-zinc-300 cursor-pointer transition-colors uppercase">
            <GitBranch size={10} className={isGitDirty ? 'text-copernicus-phosphor' : ''} />
            <span>{gitBranch}</span>
            {isGitDirty && <span className="text-[8px] text-copernicus-phosphor font-bold ml-0.5">●</span>}
          </div>
          <div className="uppercase">Phosphor_v0.1.0</div>
        </div>
      </footer>
    </div>
  )
}

const NavIcon: React.FC<{ icon: React.ReactNode, active: boolean, onClick: () => void, tooltip: string }> = ({ 
  icon, active, onClick, tooltip 
}) => (
  <button
    onClick={onClick}
    title={tooltip}
    className={`p-2 rounded-md transition-all duration-200 group relative
      ${active 
        ? 'text-copernicus-phosphor bg-copernicus-phosphor/10 shadow-[inset_0_0_10px_rgba(74,222,128,0.1)] border border-copernicus-phosphor/20' 
        : 'text-zinc-600 hover:text-zinc-300 hover:bg-white/5'
      }`}
  >
    {icon}
    {active && (
      <motion.div 
        layoutId="nav-active" 
        className="absolute left-0 w-0.5 h-4 bg-copernicus-phosphor rounded-r-full" 
        style={{ top: 'calc(50% - 8px)' }}
      />
    )}
  </button>
)

const RotateCcw: React.FC<{ size: number, className?: string }> = ({ size, className }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
)

export default App
