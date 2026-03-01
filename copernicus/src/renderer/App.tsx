import React, { useState, useEffect } from 'react'
import {
  Github, Settings, BarChart2, GitBranch, FolderOpen,
  Loader2, Monitor, Cpu, Maximize2, Minimize2, RotateCcw, Layout
} from 'lucide-react'
import { useLayoutStore } from './store/layout'
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
import Wizard from './components/wizard/Wizard'
import SplashScreen from './components/layout/SplashScreen'

const TERMINAL_HEIGHT = 200

// Inline PanelHeader to replace missing file
const PanelHeader: React.FC<{
  title: string;
  onSpotlight: () => void;
  onFlip: () => void;
  isSpotlightActive: boolean;
  onBuilder: () => void;
  isBuilderActive: boolean;
}> = ({ title, onSpotlight, onFlip, isSpotlightActive, onBuilder, isBuilderActive }) => (
  <div className="h-10 border-b border-copernicus-steel bg-[#0A0A0A] flex items-center justify-between px-4 shrink-0">
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{title}</span>
    </div>
    <div className="flex items-center gap-2">
      <button
        onClick={onBuilder}
        className={`p-1.5 rounded transition-colors ${isBuilderActive ? 'text-copernicus-phosphor bg-copernicus-phosphor/10' : 'text-zinc-500 hover:text-zinc-300'}`}
        title="UI Builder"
      >
        <Layout size={14} />
      </button>
      <button
        onClick={onFlip}
        className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
        title="Flip Panel"
      >
        <RotateCcw size={14} />
      </button>
      <button
        onClick={onSpotlight}
        className={`p-1.5 rounded transition-colors ${isSpotlightActive ? 'text-copernicus-phosphor bg-copernicus-phosphor/10' : 'text-zinc-500 hover:text-zinc-300'}`}
        title="Spotlight"
      >
        {isSpotlightActive ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button>
    </div>
  </div>
)

export default function App() {
  const invoke = useIpcError()
  const {
    activeView,
    setView,
    sidebarOpen,
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
    toggleUIBuilder,
    activeFilePath,
    activeFileContent,
    activeFileLanguage,
    setActiveFilePath,
    setActiveFileContent,
    setActiveFileLanguage,
    setCenterMode,
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
      const target = useLayoutStore.getState().spotlightPane ?? 'chat'
      toggleFlip(target as any)
    })

    const removeSpotListener = (window as any).ipcRenderer.on('layout:toggle-spotlight', () => {
      const current = useLayoutStore.getState().spotlightPane
      setSpotlight(current ? null : 'editor')
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

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'p') { e.preventDefault(); setCommandPaletteOpen(true) }
    }
    window.addEventListener('keydown', handleKeyDown)

    // Fetch initial state — unwrap {ok, data} envelope from handleIpc()
    invoke<any>('app:get-root-path').then((r: any) => setWorkingDir(r?.data ?? r ?? '')).catch(() => {})
    invoke<any>('git:branch').then((r: any) => setGitBranch(r?.data ?? r ?? '')).catch(() => {})

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
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [invoke, setWorkingDir, setGitBranch, addTerminal, setTerminalBusy, removeTerminal, toggleFlip, setSpotlight, toggleUIBuilder, setView])

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
      {/* Activity Bar (Side) */}
      <div className="flex h-full w-full overflow-hidden">
        <aside className="w-10 flex-shrink-0 bg-[#080808] border-r border-copernicus-steel flex flex-col items-center py-4 gap-4 z-50">
          <div className="w-6 h-6 bg-copernicus-phosphor/20 rounded flex items-center justify-center mb-2 phosphor-glow-border">
            <span className="text-copernicus-phosphor font-bold text-xs">C</span>
          </div>

          {/* §1.4 VT selection block */}
          <button
            onClick={() => setView('planner')}
            className={`p-2 transition-colors ${activeView === 'planner' ? 'bg-copernicus-phosphor text-[#050505] rounded-none' : 'text-zinc-500 hover:text-zinc-300 rounded'}`}
            title="Planner"
          >
            <FolderOpen size={18} />
          </button>

          <button
            onClick={() => setView('editor')}
            className={`p-2 transition-colors ${activeView === 'editor' ? 'bg-copernicus-phosphor text-[#050505] rounded-none' : 'text-zinc-500 hover:text-zinc-300 rounded'}`}
            title="Editor"
          >
            <Monitor size={18} />
          </button>

          <button
            onClick={() => setView('designer')}
            className={`p-2 transition-colors ${activeView === 'designer' ? 'bg-copernicus-phosphor text-[#050505] rounded-none' : 'text-zinc-500 hover:text-zinc-300 rounded'}`}
            title="Designer"
          >
            <Cpu size={18} />
          </button>

          <button
            onClick={() => setView('orchestrator')}
            className={`p-2 transition-colors ${activeView === 'orchestrator' ? 'bg-copernicus-phosphor text-[#050505] rounded-none' : 'text-zinc-500 hover:text-zinc-300 rounded'}`}
            title="Orchestrator"
          >
            <GitBranch size={18} />
          </button>

          <button
            onClick={() => setView('reporter')}
            className={`p-2 transition-colors ${activeView === 'reporter' ? 'bg-copernicus-phosphor text-[#050505] rounded-none' : 'text-zinc-500 hover:text-zinc-300 rounded'}`}
            title="Reporter"
          >
            <BarChart2 size={18} />
          </button>

          <div className="flex-1" />

          <button
            onClick={() => invoke('app:open-external', 'https://github.com')}
            className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="GitHub"
          >
            <Github size={18} />
          </button>

          <button
            onClick={() => setSettingsOpen(true)}
            className={`p-2 transition-colors ${settingsOpen ? 'bg-copernicus-phosphor text-[#050505] rounded-none' : 'text-zinc-500 hover:text-zinc-300 rounded'}`}
            title="Settings"
          >
            <Settings size={18} />
          </button>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <header className="h-8 flex items-center justify-between px-4 pl-20 border-b border-copernicus-steel bg-[#050505] flex-shrink-0 draggable">
            {/* §1.4 VT selection block */}
            <nav className="flex h-full items-center no-drag">
              {(['planner', 'designer', 'editor'] as const).map(view => (
                <button
                  key={view}
                  onClick={() => setView(view)}
                  className={`text-[10px] font-mono uppercase tracking-[0.2em] h-full px-2 transition-all ${activeView === view ? 'bg-copernicus-phosphor text-[#050505] rounded-none' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  {view.replace('-', '_')}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-4 no-drag">
               <button
                onClick={() => setCommandPaletteOpen(true)}
                className="text-[10px] font-mono text-zinc-500 hover:text-copernicus-phosphor transition-colors flex items-center gap-2 px-2 py-0.5 bg-zinc-900 rounded border border-zinc-800"
               >
                 <span>CMD + P</span>
               </button>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden">
            {activeView === 'planner' && <KanbanBoard />}
            {activeView === 'reporter' && <CapexDashboard />}
            {activeView === 'orchestrator' && <WorkflowCanvas />}

            {(activeView === 'designer' || activeView === 'editor') && (
              <>
                {/* Sidebar */}
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
                        <div className="flex flex-col h-full">
                          <PanelHeader
                            title={activeStoryId ? `STORY // ${activeStoryId}` : 'DEVELOPMENT_CORE'}
                            onSpotlight={() => setSpotlight(spotlightPane === 'editor' ? null : 'editor')}
                            onFlip={() => toggleFlip('center')}
                            isSpotlightActive={spotlightPane === 'editor'}
                            onBuilder={toggleUIBuilder}
                            isBuilderActive={uiBuilderOpen}
                          />
                          <CenterPanelRouter
                            filePath={activeFilePath}
                            content={activeFileContent}
                            language={activeFileLanguage}
                            onChange={(v) => setActiveFileContent(v ?? '')}
                          />
                        </div>
                      }
                      back={<div className="h-full w-full bg-zinc-900 flex items-center justify-center font-mono text-xs text-zinc-500">CANVAS_PREVIEW_ACTIVE</div>}
                    />
                  </div>

                  <div className={`w-80 flex-shrink-0 border-l border-copernicus-steel transition-all duration-500 ${spotlightPane === 'chat' ? 'flex-1' : spotlightPane === 'editor' ? 'w-0 opacity-0 pointer-events-none' : 'w-80'}`}>
                    <ChatPanel />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Terminal Drawer */}
          <div
            className="bg-[#050505] transition-all duration-300 ease-in-out"
            style={{ height: terminalOpen ? `${TERMINAL_HEIGHT}px` : '0px' }}
          >
            <TerminalTabs />
          </div>

          <div
            className="h-6 w-full flex items-center px-3 gap-2 border-t border-copernicus-steel bg-[#0A0A0A] cursor-pointer hover:bg-zinc-900 transition-colors"
            onClick={() => setTerminalOpen(!terminalOpen)}
          >
            <div className="flex items-center gap-2 flex-1">
              <span className={`text-[9px] uppercase tracking-widest ${anyTerminalBusy ? 'text-copernicus-phosphor font-bold animate-pulse' : 'text-zinc-500'}`}>
                {terminalOpen ? '▼' : '▲'} TERMINAL_PULSE
              </span>
              {anyTerminalBusy && <Loader2 size={10} className="animate-spin text-copernicus-phosphor" />}
            </div>
          </div>

          <StatusBar />
        </main>
      </div>

      {/* Overlays */}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      {commandPaletteOpen && (
        <CommandPalette
          mode="all"
          onClose={() => setCommandPaletteOpen(false)}
          onFileOpen={(path, content, language) => {
            setActiveFilePath(path)
            setActiveFileContent(content)
            setActiveFileLanguage(language)
            setCenterMode('code')
            setCommandPaletteOpen(false)
          }}
          rootPath={workingDir}
        />
      )}
    </div>
  )
}
