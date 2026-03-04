import { useState, useEffect } from 'react'
import {
  Github, Settings, BarChart2,
  Loader2, Maximize2, Minimize2, RotateCcw, Layout, Activity, Brain,
  ChevronLeft, ChevronRight, Beaker, Menu, MessageSquare,
  Palette, Code, Cpu, Workflow, Layers, Kanban, Monitor, Plus
} from 'lucide-react'
import { useLayoutStore, StoryboardView } from './store/layout'
import { CommandCenter } from './components/command/CommandCenter'
import { useIpcError } from './hooks/useIpcError'
import { FileTree } from './components/FileTree/FileTree'
import { ChatPanel } from './components/chat/ChatPanel'
import { StatusBar } from './components/layout/StatusBar'
import { FlippablePanel } from './components/layout/FlippablePanel'
import { CenterPanelRouter } from './components/Editor/CenterPanelRouter'
import { TerminalTabs } from './components/Terminal/TerminalTabs'
import { KanbanBoard } from './components/KanbanBoard'
import { CapexDashboard } from './components/capex/CapexDashboard'
import WorkflowCanvas from './components/workflow/WorkflowCanvas'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { CommandPalette } from './components/layout/CommandPalette'
import { GithubDashboard } from './components/github/GithubDashboard'
import { CommandDeck } from './components/CommandDeck'
import Wizard from './components/wizard/Wizard'
import SplashScreen from './components/layout/SplashScreen'
import { UITestDrawer } from './components/testing/UITestDrawer'
import { unwrapIpc } from './types/ipc'

const TERMINAL_HEIGHT = 200

export default function App() {
  const invoke = useIpcError()
  const {
    activeView,
    setView,
    sidebarOpen,
    setSidebarOpen,
    terminalOpen,
    setTerminalOpen,
    spotlightPane,
    setSpotlight,
    toggleFlip,
    workingDir,
    setWorkingDir,
    gitBranch,
    setGitBranch,
    activeStoryId,
    capexSessionTime,
    capexTotal,
    terminals,
    addTerminal,
    removeTerminal,
    setTerminalBusy,
    uiBuilderOpen,
    uiTestingDrawerOpen,
    toggleUIBuilder,
    toggleUITestingDrawer,
    activeFilePath,
    setActiveFilePath,
    setCenterMode,
    hasCompletedTour,
    tourHighlight,
    setTourHighlight,
    setChatPanelTab,
    activityBarCollapsed,
    setActivityBarCollapsed,
    setInProgressCount,
    chatPanelOpen,
    setChatPanelOpen,
  } = useLayoutStore()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [isWizard, setIsWizard] = useState(false)
  const [showSplash, setShowSplash] = useState(true)

  const anyTerminalBusy = terminals.some(t => t.isBusy)

  // Initial setup and IPC listeners
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('window') === 'wizard') {
      setIsWizard(true)
    }

    const removeWorkspaceChanged = (window as any).ipcRenderer.on('app:workspace-changed', (_e: any, { path }: any) => {
      setWorkingDir(path)
    })

    const removeActivateTab = (window as any).ipcRenderer.on('terminal:activate-tab', (_e: any, { agentId }: any) => {
      addTerminal(`terminal-${agentId}`, agentId.toUpperCase())
    })

    const removeSpawnTerminal = (window as any).ipcRenderer.on('terminal:spawn', (_e: any, { id, label, ephemeral }: any) => {
      addTerminal(id, label, ephemeral ?? false)
    })

    const removeBusyState = (window as any).ipcRenderer.on('terminal:set-busy', (_e: any, { id, busy }: any) => {
      setTerminalBusy(id, busy)
    })

    const removeTerminalClosed = (window as any).ipcRenderer.on('terminal-closed', (_e: any, { id }: { id: string }) => {
      removeTerminal(id)
    })

    const removeTerminalRemove = (window as any).ipcRenderer.on('terminal:remove', (_e: any, { id }: { id: string }) => {
      removeTerminal(id)
    })

    const removeFlipListener = (window as any).ipcRenderer.on('layout:toggle-flip', () => {
      toggleFlip('center-panel')
    })

    const removeSpotListener = (window as any).ipcRenderer.on('layout:toggle-spotlight', () => {
      setSpotlight(spotlightPane ? null : 'editor')
    })

    const removeUiBuilderListener = (window as any).ipcRenderer.on('layout:toggle-ui-builder', () => {
      toggleUIBuilder()
    })

    const removePaletteListener = (window as any).ipcRenderer.on('layout:open-palette', () => {
      setCommandPaletteOpen(true)
    })

    const removeSetViewListener = (window as any).ipcRenderer.on('layout:set-view', (_e: any, viewId: any) => {
      setView(viewId)
    })

    const views = ['planner', 'editor', 'designer', 'orchestrator', 'reporter', 'command-center', 'memory'] as const
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') { e.preventDefault(); setCommandPaletteOpen(true) }
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '7') {
        e.preventDefault()
        const v = views[parseInt(e.key) - 1]
        if (v) { setView(v); if (v === 'editor') setCenterMode('code'); else if (v === 'designer') setCenterMode('canvas') }
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    // Fetch initial state
    invoke<any>('app:get-root-path').then((r: any) => {
      const root = unwrapIpc<any>(r)
      if (root) {
        setWorkingDir(root)
      } else {
        setIsWizard(true)
      }
    }).catch(() => {
      setIsWizard(true)
    })
    invoke<any>('git:branch').then((r: any) => setGitBranch(unwrapIpc<any>(r) ?? '')).catch(() => {})

    // Populate in-progress story count
    invoke<any>('stories:list').then((r: any) => {
      const list: any[] = Array.isArray(r) ? r : Array.isArray(unwrapIpc<any>(r)) ? r.data : []
      setInProgressCount(list.filter((s: any) => s.status === 'IN PROGRESS').length)
    }).catch(() => {})

    const removeStoriesUpdated = (window as any).ipcRenderer.on('stories:updated', (_e: any, stories: any[]) => {
      const list: any[] = Array.isArray(stories) ? stories : []
      setInProgressCount(list.filter((s: any) => s.status === 'IN PROGRESS').length)
    })

    return () => {
      removeWorkspaceChanged()
      removeActivateTab()
      removeSpawnTerminal()
      removeBusyState()
      removeTerminalClosed()
      removeTerminalRemove()
      removeFlipListener()
      removeSpotListener()
      removeUiBuilderListener()
      removePaletteListener()
      removeSetViewListener()
      removeStoriesUpdated()
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [invoke, setWorkingDir, setGitBranch, addTerminal, setTerminalBusy, removeTerminal, toggleFlip, setSpotlight, toggleUIBuilder, setView, setCenterMode, setInProgressCount])

  // Tour Trigger on Mount
  useEffect(() => {
    if (!hasCompletedTour && !showSplash && !isWizard) {
      setChatPanelTab('guide')
      setView('planner')
    }
  }, [hasCompletedTour, showSplash, isWizard, setChatPanelTab, setView])

  // FIX Story 209: Auto-collapse sidebar when entering Designer view
  useEffect(() => {
    if (activeView === 'designer') {
      setSidebarOpen(false)
    }
  }, [activeView, setSidebarOpen])

  // Tour Highlight Auto-clear
  useEffect(() => {
    if (tourHighlight) {
      const timer = setTimeout(() => {
        setTourHighlight(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [tourHighlight, setTourHighlight])

  // Touch Bar Telemetry Update
  useEffect(() => {
    if (showSplash || isWizard) return

    ;(window as any).ipcRenderer.send('telemetry:update-touchbar', {
      storyId: activeStoryId,
      timer: formatTime(capexSessionTime),
      view: activeView,
      gitBranch,
      capexTotal,
    })
  }, [activeStoryId, capexSessionTime, activeView, gitBranch, capexTotal, showSplash, isWizard])

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />
  }

  if (isWizard) {
    return <Wizard onComplete={() => setIsWizard(false)} />
  }

  const NavButton = ({ id, icon: Icon, label }: { id: StoryboardView, icon: any, label: string }) => (
    <button
      onClick={() => { setView(id); if (id === 'editor') setCenterMode('code'); else if (id === 'designer') setCenterMode('canvas') }}
      className={`p-2 rounded transition-all duration-200 group relative ${activeView === id ? 'text-copernicus-phosphor bg-copernicus-phosphor/10' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}`}
      title={label}
    >
      <Icon size={18} />
      {activeView === id && <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-copernicus-phosphor rounded-full" />}
    </button>
  )

  return (
    <div className="flex flex-col h-screen w-screen bg-copernicus-bg text-zinc-300 font-sans overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-copernicus-phosphor focus:text-[#050505] focus:px-4 focus:py-2 focus:rounded"
      >
        Skip to main content
      </a>

      {/* Row 1: Application Title Bar (h-8, bg-[#050505]) */}
      <header className="h-8 flex items-center justify-between px-2 bg-[#050505] shrink-0 draggable z-[110] border-b border-copernicus-steel/30">
        <div className="w-[200px] flex items-center gap-2 no-drag ml-[72px]">
           <div className="w-4 h-4 bg-copernicus-phosphor/20 rounded flex items-center justify-center phosphor-glow-border">
              <span className="text-copernicus-phosphor font-bold text-[8px]">C</span>
           </div>
           <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-zinc-500 uppercase">Copernicus</span>
        </div>

        <div className="flex-1 flex justify-center no-drag pointer-events-none">
           <div className="text-[10px] font-mono font-bold tracking-widest text-zinc-600 uppercase">Strategic_Orchestration_Interface</div>
        </div>
        
        <div className="w-[300px] flex justify-end no-drag">
          <div className="flex items-center gap-3 bg-zinc-950 border border-copernicus-steel/30 px-3 py-0.5 rounded-full overflow-hidden">
            <span className="text-[9px] font-mono text-zinc-600 shrink-0">STORY //</span>
            <span className="text-[9px] font-mono text-copernicus-phosphor truncate font-bold uppercase tracking-wider">
              {activeStoryId || 'UNASSIGNED'}
            </span>
            {activeFilePath && (
              <>
                <span className="text-zinc-800">|</span>
                <span className="text-[9px] font-mono text-zinc-500 truncate tracking-tight">
                  {activeFilePath.split('/').pop()}
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Row 2: Panel Header (h-10, bg-[#0A0A0A]) */}
      <div className="h-10 flex items-center justify-between px-2 border-b border-copernicus-steel bg-[#0A0A0A] shrink-0 z-[100]">
        {/* Left Panel (File Explorer) Controls */}
        <div className="flex items-center gap-1 w-64">
          <button
            onClick={() => setSpotlight(spotlightPane === 'explorer' ? null : 'explorer')}
            className={`p-1.5 rounded transition-colors ${spotlightPane === 'explorer' ? 'text-copernicus-phosphor bg-copernicus-phosphor/10' : 'text-zinc-600 hover:text-zinc-300'}`}
            title="Spotlight Explorer"
          >
            {spotlightPane === 'explorer' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button
            onClick={() => toggleFlip('sidebar')}
            className="p-1.5 text-zinc-600 hover:text-copernicus-phosphor transition-colors"
            title="Rotate Explorer Content"
          >
            <RotateCcw size={14} />
          </button>
        </div>

        {/* Center Panel (Canvas) Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-zinc-950/50 p-1 rounded border border-zinc-800/50">
            <button
              onClick={() => setSpotlight(spotlightPane === 'editor' ? null : 'editor')}
              className={`p-1.5 rounded transition-colors ${spotlightPane === 'editor' ? 'text-copernicus-phosphor bg-copernicus-phosphor/10' : 'text-zinc-600 hover:text-zinc-300'}`}
              title="Spotlight Canvas"
            >
              {spotlightPane === 'editor' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button
              onClick={() => toggleFlip('center-panel')}
              className="p-1.5 text-zinc-600 hover:text-copernicus-phosphor transition-colors"
              title="Rotate Canvas Panel"
            >
              <RotateCcw size={14} />
            </button>
          </div>
          
          <div className="w-[1px] h-4 bg-copernicus-steel/30 mx-1" />
          
          <button
            onClick={toggleUIBuilder}
            className={`p-1.5 rounded transition-colors ${uiBuilderOpen ? 'text-copernicus-phosphor bg-copernicus-phosphor/10' : 'text-zinc-600 hover:text-zinc-300'}`}
            title="UI Builder"
          >
            <Layout size={16} />
          </button>
          {activeView === 'designer' && (
            <button
              onClick={toggleUITestingDrawer}
              className={`p-1.5 rounded transition-colors ${uiTestingDrawerOpen ? 'text-copernicus-phosphor bg-copernicus-phosphor/10' : 'text-zinc-600 hover:text-zinc-300'}`}
              title="UI Testing"
            >
              <Beaker size={16} />
            </button>
          )}
        </div>

        {/* Right Panel (Chat) Controls */}
        <div className="flex items-center justify-end gap-1 w-80">
          <button
            onClick={() => setSpotlight(spotlightPane === 'chat' ? null : 'chat')}
            className={`p-1.5 rounded transition-colors ${spotlightPane === 'chat' ? 'text-copernicus-phosphor bg-copernicus-phosphor/10' : 'text-zinc-600 hover:text-zinc-300'}`}
            title="Spotlight Chat"
          >
            {spotlightPane === 'chat' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button
            onClick={() => toggleFlip('chat')}
            className="p-1.5 text-zinc-600 hover:text-copernicus-phosphor transition-colors"
            title="Rotate Chat Tools"
          >
            <RotateCcw size={14} />
          </button>
          <div className="w-[1px] h-4 bg-copernicus-steel/30 mx-1" />
          <button
            onClick={() => setChatPanelOpen(!chatPanelOpen)}
            className={`p-1.5 rounded transition-colors ${chatPanelOpen ? 'text-copernicus-phosphor' : 'text-zinc-600'}`}
            title="Toggle Chat Visibility"
          >
            <MessageSquare size={16} />
          </button>
        </div>
      </div>

      <div className="flex h-full w-full overflow-hidden">
        {/* Activity Side Bar (Navigation) */}
        <aside className={`flex-shrink-0 bg-[#080808] border-r border-copernicus-steel flex flex-col items-center py-4 gap-2 z-50 transition-all duration-200 ease-in-out ${activityBarCollapsed ? 'w-4 px-0' : 'w-12'}`}>
          {!activityBarCollapsed && (
            <>
              <nav className="flex flex-col items-center gap-3">
                <NavButton id="planner" icon={Kanban} label="Planner" />
                <NavButton id="designer" icon={Palette} label="Designer" />
                <NavButton id="editor" icon={Code} label="Editor" />
                <NavButton id="orchestrator" icon={Workflow} label="Orchestrator" />
                <NavButton id="reporter" icon={BarChart2} label="Reports" />
                <NavButton id="command-center" icon={Monitor} label="Command Center" />
                <NavButton id="memory" icon={Brain} label="Memory Browser" />
              </nav>

              <div className="flex-1" />

              <div className="flex flex-col items-center gap-3 pb-2">
                <button 
                  onClick={() => setView('github')} 
                  title="GitHub Manager" 
                  className={`p-2 rounded transition-colors ${activeView === 'github' ? 'text-copernicus-phosphor bg-copernicus-phosphor/10' : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900'}`}
                >
                  <Github size={18} />
                </button>
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="p-2 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900 rounded transition-colors"
                  title="Global Settings"
                >
                  <Settings size={18} />
                </button>
                <button 
                  onClick={() => setSidebarOpen(!sidebarOpen)} 
                  className={`p-2 rounded transition-colors ${sidebarOpen ? 'text-copernicus-phosphor' : 'text-zinc-600'}`}
                  title="Toggle Explorer"
                >
                  <Menu size={18} />
                </button>
              </div>
            </>
          )}

          <button onClick={() => setActivityBarCollapsed(!activityBarCollapsed)} className="mt-auto p-1 text-zinc-700 hover:text-zinc-400">
            {activityBarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={16} />}
          </button>
        </aside>

        {/* Main Content Area */}
        <main id="main-content" className="flex-1 flex flex-col overflow-hidden relative">
          <div className="flex-1 flex overflow-hidden">
            {activeView === 'command-center' && <CommandCenter />}
            {activeView === 'planner' && <KanbanBoard />}
            {activeView === 'reporter' && <CapexDashboard />}
            {activeView === 'orchestrator' && <WorkflowCanvas />}
            {activeView === 'github' && <GithubDashboard />}
            {activeView === 'memory' && <div className="h-full w-full flex items-center justify-center font-mono text-zinc-600">MEMORY_BROWSER_COMING_SOON</div>}

            {(activeView === 'designer' || activeView === 'editor') && (
              <>
                {/* Sidebar (Flippable Explorer/CommandDeck) */}
                <div className={`${sidebarOpen ? 'w-64' : 'w-0'} flex-shrink-0 transition-all duration-300 ease-in-out border-r border-copernicus-steel bg-[#080808] overflow-hidden`}>
                  <FlippablePanel
                    id="sidebar"
                    className="h-full w-full"
                    front={<FileTree rootPath={workingDir} />}
                    back={<CommandDeck />}
                  />
                </div>

                {/* Center Panel & Chat */}
                <div className="flex-1 flex overflow-hidden relative">
                  <div className={`flex-1 flex flex-col transition-all duration-500 ${spotlightPane === 'editor' ? 'flex-[3]' : spotlightPane === 'chat' ? 'flex-0 w-0 opacity-0 pointer-events-none' : spotlightPane === 'explorer' ? 'w-0 opacity-0 pointer-events-none' : spotlightPane === 'terminal' ? 'w-0 opacity-0 pointer-events-none' : 'flex-1'}`}>
                    <FlippablePanel
                      id="center-panel"
                      className="flex-1"
                      front={
                        <div className="flex flex-col h-full relative">
                          <CenterPanelRouter
                            filePath={activeFilePath}
                            onChange={(v) => setActiveFilePath(v ?? null)}
                          />
                          {uiTestingDrawerOpen && <UITestDrawer />}
                        </div>
                      }
                      back={<div className="h-full w-full bg-zinc-900 flex items-center justify-center font-mono text-xs text-zinc-500 tracking-tighter uppercase">Canvas_Preview_Active</div>}
                    />
                  </div>

                  {/* Chat Panel */}
                  <div className={`flex-shrink-0 border-l border-copernicus-steel transition-all duration-500 ${spotlightPane === 'chat' ? 'flex-1' : (spotlightPane === 'editor' || spotlightPane === 'explorer' || spotlightPane === 'terminal' || !chatPanelOpen) ? 'w-0 opacity-0 pointer-events-none' : 'w-80'}`}>
                    <ChatPanel />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Terminal Drawer (Flippable & Spotlightable) */}
          <div 
            className={`bg-[#050505] transition-all duration-300 ease-in-out border-t border-copernicus-steel ${spotlightPane === 'terminal' ? 'flex-1' : ''}`} 
            style={{ height: spotlightPane === 'terminal' ? 'auto' : (terminalOpen ? `${TERMINAL_HEIGHT}px` : '0px') }}
          >
            <FlippablePanel
              id="terminal"
              className="h-full w-full"
              front={<TerminalTabs />}
              back={<div className="h-full w-full bg-[#050505] flex items-center justify-center font-mono text-[10px] text-zinc-600 uppercase">Terminal_System_Log_Coming_Soon</div>}
            />
          </div>

          <div className="h-6 w-full flex items-center px-2 gap-2 bg-[#0A0A0A] border-t border-copernicus-steel select-none group">
            <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => setTerminalOpen(!terminalOpen)}>
              <span className={`text-[10px] font-mono uppercase tracking-widest ${anyTerminalBusy ? 'text-copernicus-phosphor phosphor-glow animate-pulse' : 'text-zinc-500'}`}>
                {terminalOpen ? '▼' : '▲'} TERMINAL_PULSE
              </span>
              {anyTerminalBusy && <Loader2 size={10} className="animate-spin text-copernicus-phosphor" />}
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setSpotlight(spotlightPane === 'terminal' ? null : 'terminal')}
                className={`p-1 rounded transition-colors ${spotlightPane === 'terminal' ? 'text-copernicus-phosphor bg-copernicus-phosphor/10' : 'text-zinc-600 hover:text-zinc-300'}`}
                title="Spotlight Terminal"
              >
                {spotlightPane === 'terminal' ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              </button>
              <button
                onClick={() => toggleFlip('terminal')}
                className="p-1 text-zinc-600 hover:text-copernicus-phosphor transition-colors"
                title="Rotate Terminal Content"
              >
                <RotateCcw size={12} />
              </button>
            </div>
          </div>

          <StatusBar onCommandPalette={() => setCommandPaletteOpen(true)} />
        </main>
      </div>

      {/* Overlays */}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      {commandPaletteOpen && (
        <CommandPalette
          mode="all"
          onClose={() => setCommandPaletteOpen(false)}
          onFileOpen={(path) => {
            setActiveFilePath(path)
            setCenterMode('code')
            setCommandPaletteOpen(false)
          }}
          rootPath={workingDir}
        />
      )}
    </div>
  )
}
