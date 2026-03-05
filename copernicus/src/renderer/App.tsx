import { useState, useEffect, useMemo } from 'react'
import {
  Github, Settings, BarChart2,
  Maximize2, RotateCcw, Brain,
  Menu,
  Palette, Code, Workflow, Kanban, Monitor
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
import { classifyFile } from './utils/fileUtils'

const TERMINAL_HEIGHT = 200

export default function App() {
  const invoke = useIpcError()
  const {
    activeView,
    setView,
    sidebarOpen,
    setSidebarOpen,
    terminalOpen,
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
    addTerminal,
    removeTerminal,
    setTerminalBusy,
    uiTestingDrawerOpen,
    toggleUIBuilder,
    activeFilePath,
    setActiveFilePath,
    centerMode,
    setCenterMode,
    hasCompletedTour,
    setChatPanelTab,
    setInProgressCount,
    chatPanelOpen,
    paletteOpen,
    setPaletteOpen,
    inspectorOpen,
    setInspectorOpen,
    browserSessionActive
  } = useLayoutStore()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [isWizard, setIsWizard] = useState(false)
  const [showSplash, setShowSplash] = useState(true)

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
      const data = unwrapIpc<any>(r)
      const list: any[] = Array.isArray(data) ? data : []
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

  // Story 209: Auto-collapse sidebar when entering Designer view
  useEffect(() => {
    if (activeView === 'designer') {
      setSidebarOpen(false)
    }
  }, [activeView, setSidebarOpen])

  // NEW: Force open sidebar if in editor mode but no file is selected
  useEffect(() => {
    if (activeView === 'editor' && !activeFilePath && !sidebarOpen) {
      setSidebarOpen(true)
    }
  }, [activeView, activeFilePath, sidebarOpen, setSidebarOpen])

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

  const centerLabel = useMemo(() => {
    if (activeView === 'orchestrator') return 'Orchestrator'
    if (centerMode === 'code') return 'Editor'
    if (centerMode === 'binary') return 'Binary'
    
    if (browserSessionActive) return 'Canvas: Browser'
    if (activeFilePath) {
      const type = classifyFile(activeFilePath)
      if (type === 'canvas' || type === 'svg') return 'Canvas: Image'
    }
    return 'Canvas: UI'
  }, [activeView, centerMode, browserSessionActive, activeFilePath])

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

  // MULTI-PANEL logic: Only Editor, Designer, and Orchestrator use the tier-based spotlight system
  const isTieredLayout = ['editor', 'designer', 'orchestrator'].includes(activeView)

  return (
    <div className="flex flex-col h-screen w-screen bg-copernicus-bg text-zinc-300 font-sans overflow-hidden">
      
      {/* Level 0: Top Dog - Application Title Bar (Spans full width) */}
      <header className="h-8 flex items-center justify-between px-2 bg-[#050505] shrink-0 draggable z-[110] border-b border-copernicus-steel/30 font-bold uppercase select-none">
        <div className="flex-1"></div>
        <div className="flex items-center justify-center gap-2">
          <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-zinc-500">Copernicus</span>
        </div>
        
        <div className="flex-1 flex justify-end">
          <div className="flex items-center gap-3 bg-zinc-950 border border-copernicus-steel/30 px-3 py-0.5 rounded-full overflow-hidden">
            <span className="text-[9px] font-mono text-zinc-600 shrink-0 uppercase tracking-tighter font-black italic">Story //</span>
            <span className="text-[9px] font-mono text-copernicus-phosphor truncate font-bold uppercase tracking-wider">
              {activeStoryId || 'UNASSIGNED'}
            </span>
            {activeFilePath && (
              <>
                <span className="text-zinc-800">|</span>
                <span className="text-[9px] font-mono text-zinc-500 truncate tracking-tight uppercase">
                  {activeFilePath.split('/').pop()}
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Level 1: Horizontal Body Split */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Activity Side Bar - Permanent w-12 bar */}
        <aside className="w-12 flex-shrink-0 bg-[#080808] border-r border-copernicus-steel flex flex-col items-center h-full z-50">
          <div className="pt-4">
            <div className="w-8 h-8 bg-copernicus-phosphor/20 rounded flex items-center justify-center phosphor-glow-border">
              <span className="text-copernicus-phosphor font-bold text-[10px]">C</span>
            </div>
          </div>
          
          <nav className="flex flex-col items-center gap-3 pt-4">
            <NavButton id="planner" icon={Kanban} label="Planner" />
            <NavButton id="designer" icon={Palette} label="Designer" />
            <NavButton id="editor" icon={Code} label="Editor" />
            <NavButton id="orchestrator" icon={Workflow} label="Orchestrator" />
            <NavButton id="reporter" icon={BarChart2} label="Reports" />
            <NavButton id="command-center" icon={Monitor} label="Command Center" />
            <NavButton id="memory" icon={Brain} label="Memory Browser" />
          </nav>

          <div className="flex-1" />

          <div className="flex flex-col items-center gap-3 pb-4">
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
            {isTieredLayout && (
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)} 
                className={`p-2 rounded transition-colors ${sidebarOpen ? 'text-copernicus-phosphor' : 'text-zinc-600'}`}
                title="Toggle Explorer"
              >
                <Menu size={18} />
              </button>
            )}
          </div>
        </aside>

        {/* Level 2: Main Application Window (The Stage) */}
        <main id="main-content" className="flex-1 flex flex-col overflow-hidden relative">
          
          <div className="flex-1 flex overflow-hidden relative">
            {isTieredLayout ? (
              /* Tiered Layout: Respects Panel Spotlight logic */
              <>
                {/* Explorer Tier - FIXED: Added flex-shrink-0 to prevent overflow */}
                <div className={`${sidebarOpen && (!spotlightPane || spotlightPane === 'explorer') ? (spotlightPane === 'explorer' ? 'flex-1' : 'w-64') : 'w-6 flex-shrink-0'} flex-shrink-0 transition-all duration-300 ease-in-out border-r border-copernicus-steel bg-[#080808] overflow-hidden`}>
                  {sidebarOpen ? (
                    <FlippablePanel
                      id="sidebar"
                      className="h-full w-full"
                      front={<FileTree rootPath={workingDir} />}
                      back={<CommandDeck />}
                    />
                  ) : (
                    <div 
                      className="h-full w-6 flex flex-col items-center py-4 cursor-pointer hover:bg-white/5 transition-colors group/bookmark"
                      onClick={() => setSidebarOpen(true)}
                      title="Restore Explorer"
                    >
                      <Menu size={12} className="text-zinc-600 group-hover/bookmark:text-copernicus-phosphor mb-4" />
                      <div className="flex-1 flex items-center justify-center">
                        <span 
                          className="text-[9px] font-bold text-zinc-600 uppercase tracking-tighter origin-center whitespace-nowrap"
                          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                        >
                          Explorer
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Content Tiers (Center + Chat) - FIXED: Added min-width: 0 to center panel */}
                <div className={`${spotlightPane === 'explorer' ? 'w-0 opacity-0 pointer-events-none' : 'flex-1'} flex overflow-hidden relative transition-all duration-500`}>
                  
                  {/* Center Tier (Editor / Canvas / Orchestrator) - FIXED: Added min-width: 0 */}
                  <div className={`flex-1 flex flex-col transition-all duration-500 ${spotlightPane === 'editor' ? 'flex-[3]' : (spotlightPane === 'chat' || spotlightPane === 'terminal') ? 'flex-0 w-0 opacity-0 pointer-events-none' : 'flex-1'}`} style={{ minWidth: 0 }}>
                    <FlippablePanel
                      id="center-panel"
                      className="flex-1"
                      front={
                        <div className="flex flex-col h-full relative">
                          <header className="h-8 flex items-center justify-between px-3 border-b border-white/5 bg-black/20 shrink-0 group/center">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                                {centerLabel}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 opacity-0 group-hover/center:opacity-100 transition-opacity">
                              {activeView === 'designer' && (
                                <div className="flex bg-zinc-900 rounded p-0.5 border border-zinc-800 mr-2">
                                  <button 
                                    onClick={() => setPaletteOpen(!paletteOpen)}
                                    className={`px-2 py-0.5 text-[8px] font-bold rounded uppercase transition-colors ${paletteOpen ? 'bg-zinc-800 text-copernicus-phosphor' : 'text-zinc-600 hover:text-zinc-400'}`}
                                  >
                                    Palette
                                  </button>
                                  <button 
                                    onClick={() => setInspectorOpen(!inspectorOpen)}
                                    className={`px-2 py-0.5 text-[8px] font-bold rounded uppercase transition-colors ${inspectorOpen ? 'bg-zinc-800 text-copernicus-phosphor' : 'text-zinc-600 hover:text-zinc-400'}`}
                                  >
                                    Inspector
                                  </button>
                                </div>
                              )}
                              <button onClick={() => toggleFlip('center-panel')} className="p-1 text-zinc-600 hover:text-copernicus-phosphor transition-colors" title="Rotate Panel"><RotateCcw size={12} /></button>
                              <button onClick={() => setSpotlight(spotlightPane === 'editor' ? null : 'editor')} className={`p-1 rounded ${spotlightPane === 'editor' ? 'text-copernicus-phosphor bg-copernicus-phosphor/10' : 'text-zinc-600 hover:text-zinc-300'}`} title="Spotlight"><Maximize2 size={12} /></button>
                            </div>
                          </header>
                          <div className="flex-1 overflow-hidden relative">
                            {activeView === 'orchestrator' ? (
                              <WorkflowCanvas />
                            ) : (
                              <CenterPanelRouter 
                                filePath={activeFilePath} 
                                onChange={(val) => setActiveFilePath(val ?? null)} 
                              />
                            )}
                            {uiTestingDrawerOpen && <UITestDrawer />}
                          </div>
                        </div>
                      }
                      back={
                        <div className="h-full w-full bg-[#050505] flex flex-col">
                          <header className="h-8 flex items-center justify-between px-3 border-b border-white/5 bg-black/20">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Backface</span>
                            <button onClick={() => toggleFlip('center-panel')} className="p-1 text-zinc-600 hover:text-copernicus-phosphor transition-colors"><RotateCcw size={12} /></button>
                          </header>
                          <div className="flex-1 flex items-center justify-center font-mono text-xs text-zinc-500 uppercase tracking-tighter">Panel_Flipped</div>
                        </div>
                      }
                    />
                  </div>

                  {/* Chat Tier */}
                  <div className={`flex-shrink-0 border-l border-copernicus-steel transition-all duration-500 ${spotlightPane === 'chat' ? 'flex-1' : (spotlightPane === 'editor' || spotlightPane === 'terminal' || !chatPanelOpen) ? 'w-0 opacity-0 pointer-events-none' : 'w-80'}`}>
                    <ChatPanel />
                  </div>
                </div>
              </>
            ) : (
              /* Solo Layout: Fullscreen views that handle their own internal spotlighting */
              <div className="flex-1 flex flex-col overflow-hidden bg-copernicus-bg">
                {activeView === 'command-center' && <CommandCenter />}
                {activeView === 'planner' && <KanbanBoard />}
                {activeView === 'reporter' && <CapexDashboard />}
                {activeView === 'github' && <GithubDashboard />}
                {activeView === 'memory' && <div className="h-full w-full flex items-center justify-center font-mono text-zinc-600 uppercase tracking-tighter italic">Memory_Browser_Online</div>}
              </div>
            )}
          </div>

          {/* Terminal Drawer (Main Stage relative) */}
          <div 
            className={`bg-[#050505] transition-all duration-300 ease-in-out border-t border-copernicus-steel ${spotlightPane === 'terminal' ? 'flex-1' : (terminalOpen ? `h-[${TERMINAL_HEIGHT}px]` : 'h-0')}`} 
            style={{ height: spotlightPane === 'terminal' ? '100%' : (terminalOpen ? `${TERMINAL_HEIGHT}px` : '0px') }}
          >
            <TerminalTabs />
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
