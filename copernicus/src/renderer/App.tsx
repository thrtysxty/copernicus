import { useState, useEffect } from 'react'
import {
  Github, Settings, BarChart2,
  Loader2, Maximize2, Minimize2, RotateCcw, Layout, Activity, Brain,
  ChevronLeft, ChevronRight, Beaker, Menu, MessageSquare
} from 'lucide-react'
import { useLayoutStore } from './store/layout'
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
      setShowSplash(false)
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

  return (
    <div className="flex flex-col h-screen w-screen bg-copernicus-bg text-zinc-300 font-sans overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-copernicus-phosphor focus:text-[#050505] focus:px-4 focus:py-2 focus:rounded"
      >
        Skip to main content
      </a>

      {/* Global Application Header Row */}
      <header className="h-10 flex items-center justify-between px-2 border-b border-copernicus-steel bg-[#050505] shrink-0 draggable z-[100]">
        {/* Left: View Selection & Sidebar Toggle */}
        <div className="flex items-center gap-1 no-drag">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`p-1.5 rounded hover:bg-zinc-900 transition-colors ${sidebarOpen ? 'text-copernicus-phosphor' : 'text-zinc-500'}`}
            title="Toggle Sidebar"
          >
            <Menu size={16} />
          </button>
          <nav className="flex items-center h-full ml-2">
            {(['planner', 'designer', 'editor', 'orchestrator', 'reporter', 'command-center'] as const).map(view => (
              <button
                key={view}
                onClick={() => { setView(view); if (view === 'editor') setCenterMode('code') }}
                className={`text-[9px] font-mono uppercase tracking-[0.15em] h-8 px-3 transition-all flex items-center ${activeView === view ? 'bg-copernicus-phosphor text-[#050505] font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                {view.replace('-', '_')}
              </button>
            ))}
          </nav>
        </div>

        {/* Center: Active Metadata (Story & File) */}
        <div className="flex-1 flex justify-center min-w-0 px-4 pointer-events-none">
          <div className="flex items-center gap-3 bg-zinc-900/50 border border-copernicus-steel/30 px-4 py-1 rounded-full overflow-hidden max-w-md">
            <span className="text-[10px] font-mono text-zinc-500 shrink-0">STORY //</span>
            <span className="text-[10px] font-mono text-copernicus-phosphor truncate font-bold uppercase tracking-wider">
              {activeStoryId || 'UNASSIGNED_CORE'}
            </span>
            {activeFilePath && (
              <>
                <span className="text-zinc-700">|</span>
                <span className="text-[10px] font-mono text-zinc-400 truncate tracking-tight">
                  {activeFilePath.split('/').pop()}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: Global Panel Controls */}
        <div className="flex items-center gap-1 no-drag">
          {activeView === 'designer' && (
            <button
              onClick={toggleUITestingDrawer}
              className={`p-1.5 rounded transition-colors ${uiTestingDrawerOpen ? 'text-copernicus-phosphor bg-copernicus-phosphor/10' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="UI Testing"
            >
              <Beaker size={16} />
            </button>
          )}
          <button
            onClick={toggleUIBuilder}
            className={`p-1.5 rounded transition-colors ${uiBuilderOpen ? 'text-copernicus-phosphor bg-copernicus-phosphor/10' : 'text-zinc-500 hover:text-zinc-300'}`}
            title="UI Builder"
          >
            <Layout size={16} />
          </button>
          <button
            onClick={() => toggleFlip('center-panel')}
            className="p-1.5 text-zinc-500 hover:text-copernicus-phosphor transition-colors"
            title="Flip Center Panel"
          >
            <RotateCcw size={16} />
          </button>
          <button
            onClick={() => setSpotlight(spotlightPane === 'editor' ? null : 'editor')}
            className={`p-1.5 rounded transition-colors ${spotlightPane === 'editor' ? 'text-copernicus-phosphor bg-copernicus-phosphor/10' : 'text-zinc-500 hover:text-zinc-300'}`}
            title="Spotlight Center"
          >
            {spotlightPane === 'editor' ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <div className="w-[1px] h-4 bg-copernicus-steel/30 mx-1" />
          <button
            onClick={() => setSpotlight(spotlightPane === 'chat' ? null : 'chat')}
            className={`p-1.5 rounded transition-colors ${spotlightPane === 'chat' ? 'text-copernicus-phosphor bg-copernicus-phosphor/10' : 'text-zinc-500 hover:text-zinc-300'}`}
            title="Spotlight Chat"
          >
            <MessageSquare size={16} />
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors ml-1"
            title="Global Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      <div className="flex h-full w-full overflow-hidden">
        {/* Activity Bar (Slimmed down) */}
        <aside className={`flex-shrink-0 bg-[#080808] border-r border-copernicus-steel flex flex-col items-center py-4 gap-4 z-50 transition-all duration-200 ease-in-out ${activityBarCollapsed ? 'w-4 px-0' : 'w-10'}`}>
          {!activityBarCollapsed && (
            <div className="w-6 h-6 bg-copernicus-phosphor/20 rounded flex items-center justify-center mb-2 phosphor-glow-border">
              <span className="text-copernicus-phosphor font-bold text-xs">C</span>
            </div>
          )}

          {!activityBarCollapsed && (
            <nav className="flex flex-col items-center gap-4">
              <button onClick={() => setView('reporter')} title="Reporter" className={`p-2 rounded ${activeView === 'reporter' ? 'text-copernicus-phosphor' : 'text-zinc-500'}`}><BarChart2 size={18} /></button>
              <button onClick={() => setView('command-center')} title="Command Center" className={`p-2 rounded ${activeView === 'command-center' ? 'text-copernicus-phosphor' : 'text-zinc-500'}`}><Activity size={18} /></button>
              <button onClick={() => setView('memory')} title="Memory" className={`p-2 rounded ${activeView === 'memory' ? 'text-copernicus-phosphor' : 'text-zinc-500'}`}><Brain size={18} /></button>
              <div className="w-full border-t border-zinc-800" />
              <button onClick={() => setView('github')} title="GitHub" className={`p-2 rounded ${activeView === 'github' ? 'text-copernicus-phosphor' : 'text-zinc-500'}`}><Github size={18} /></button>
            </nav>
          )}

          <div className="flex-1" />
          <button onClick={() => setActivityBarCollapsed(!activityBarCollapsed)} className="p-1 text-zinc-600 hover:text-zinc-400">
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
                {/* Sidebar (File Tree) - Controlled by global sidebarOpen state */}
                <div className={`${sidebarOpen ? 'w-64' : 'w-0'} flex-shrink-0 transition-all duration-300 ease-in-out border-r border-copernicus-steel bg-[#080808] overflow-hidden`}>
                  <FileTree rootPath={workingDir} />
                </div>

                {/* Center Panel & Chat */}
                <div className="flex-1 flex overflow-hidden relative">
                  <div className={`flex-1 flex flex-col transition-all duration-500 ${spotlightPane === 'editor' ? 'flex-[3]' : spotlightPane === 'chat' ? 'flex-0 w-0 opacity-0 pointer-events-none' : 'flex-1'}`}>
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

                  {/* Chat Panel - Now Global Sidebar in Editor/Designer */}
                  <div className={`w-80 flex-shrink-0 border-l border-copernicus-steel transition-all duration-500 ${spotlightPane === 'chat' ? 'flex-1' : spotlightPane === 'editor' ? 'w-0 opacity-0 pointer-events-none' : 'w-80'}`}>
                    <ChatPanel />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Terminal Drawer */}
          <div className="bg-[#050505] transition-all duration-300 ease-in-out" style={{ height: terminalOpen ? `${TERMINAL_HEIGHT}px` : '0px' }}>
            <TerminalTabs />
          </div>

          <div className="h-6 w-full flex items-center px-3 gap-2 border-t border-copernicus-steel bg-[#0A0A0A] cursor-pointer hover:bg-zinc-900 transition-colors" onClick={() => setTerminalOpen(!terminalOpen)}>
            <div className="flex items-center gap-2 flex-1">
              <span className={`text-[10px] font-mono uppercase tracking-widest ${anyTerminalBusy ? 'text-copernicus-phosphor phosphor-glow animate-pulse' : 'text-zinc-500'}`}>
                {terminalOpen ? '▼' : '▲'} TERMINAL_PULSE
              </span>
              {anyTerminalBusy && <Loader2 size={10} className="animate-spin text-copernicus-phosphor" />}
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
