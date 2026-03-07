import React, { useState, useEffect } from 'react'
import {
  Loader2, Maximize2, Minimize2, RotateCcw, Layout,
} from 'lucide-react'
import { useLayoutStore } from './store/layout'
import { ActivityBar } from './components/layout/ActivityBar'
import { ProjectSelectorDialog } from './components/layout/ProjectSelectorDialog'
import { CommandCenter } from './components/command/CommandCenter'
import { useIpcError } from './hooks/useIpcError'
import { unwrapIpc } from './types/ipc'
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
import { ContainerViewer } from './components/runtime/ContainerViewer'

const TERMINAL_HEIGHT = 200

// Inline PanelHeader to replace missing file
const PanelHeader: React.FC<{
  title: string;
  onSpotlight: () => void;
  onFlip: () => void;
  isSpotlightActive: boolean;
  onBuilder: () => void;
  isBuilderActive: boolean;
  onCommandPalette?: () => void;
  showLspStatus?: boolean;
}> = ({ title, onSpotlight, onFlip, isSpotlightActive, onBuilder, isBuilderActive, onCommandPalette, showLspStatus }) => {
  const [lspRunning, setLspRunning] = useState(false)
  const [errorCount, setErrorCount] = useState(0)
  const [warnCount, setWarnCount] = useState(0)
  const invoke = useIpcError()
  const { activeFilePath } = useLayoutStore()

  useEffect(() => {
    invoke<any>('lsp:status').then((res: any) => {
      if (res?.ok && res.data) setLspRunning(res.data.running ?? false)
    }).catch(() => {})

    const removeDiag = window.ipcRenderer.on(
      'lsp:diagnostics-update',
      (_e: Electron.IpcRendererEvent, { uri, diagnostics }: { uri: string; diagnostics: any[] }) => {
        if (!activeFilePath || `file://${activeFilePath}` !== uri) return
        let errors = 0, warnings = 0
        diagnostics.forEach((d: any) => { if (d.severity === 1) errors++; if (d.severity === 2) warnings++ })
        setErrorCount(errors)
        setWarnCount(warnings)
      }
    )
    return () => removeDiag()
  }, [invoke, activeFilePath])

  return (
    <div className="h-10 border-b border-copernicus-steel bg-[#0A0A0A] flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{title}</span>
        {showLspStatus && (
          <div
            className="flex items-center gap-2 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 cursor-pointer hover:bg-zinc-800 transition-colors"
            onClick={onCommandPalette}
          >
            <span className={`text-[8px] ${lspRunning ? 'text-green-500' : 'text-red-500'}`}>◉</span>
            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
              LSP {errorCount}E {warnCount}W
            </span>
          </div>
        )}
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
}

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
    hasCompletedTour,
    tourHighlight,
    setTourHighlight,
    setChatPanelTab,
    setInProgressCount,
    settingsOpen,
    setSettingsOpen,
  } = useLayoutStore()

  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false)
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

    const views = ['planner', 'editor', 'designer', 'orchestrator', 'reporter', 'command-center', 'memory'] as const
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') { e.preventDefault(); setCommandPaletteOpen(true) }
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '7') {
        e.preventDefault()
        const v = views[parseInt(e.key) - 1]
        if (v) {
          setView(v)
          if (v === 'editor') setCenterMode('code')
          else if (v === 'designer') setCenterMode('canvas')
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    // Fetch initial state
    invoke<any>('app:get-root-path').then((r: any) => {
      const root = unwrapIpc<any>(r)
      if (root) setWorkingDir(root)
      else setIsWizard(true)
    }).catch(() => setIsWizard(true))
    invoke<any>('git:branch').then((r: any) => setGitBranch(r?.data ?? r ?? '')).catch(() => {})
    invoke<any>('stories:list').then((r: any) => {
      const list: any[] = Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : []
      setInProgressCount(list.filter((s: any) => s.status === 'IN PROGRESS').length)
    }).catch(() => {})

    const removeStoriesUpdated = (window as any).ipcRenderer.on('stories:updated', (_e: any, stories: any[]) => {
      setInProgressCount(stories.filter((s: any) => s.status === 'IN PROGRESS').length)
    })

    return () => {
      removeStoriesUpdated()
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

  // Tour Trigger on Mount
  useEffect(() => {
    if (!hasCompletedTour && !showSplash && !isWizard) {
      setChatPanelTab('guide')
      setView('planner')
    }
  }, [hasCompletedTour, showSplash, isWizard, setChatPanelTab, setView])

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
    return (
      <Wizard
        onComplete={() => {
          setIsWizard(false)
          setView('planner')
          invoke<any>('app:get-root-path').then((r: any) => {
            const root = unwrapIpc<any>(r)
            if (root) setWorkingDir(root)
          }).catch(() => {})
        }}
      />
    )
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-copernicus-bg text-zinc-300 font-sans overflow-hidden">
      {/* AC-6: Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-copernicus-phosphor focus:text-[#050505] focus:px-4 focus:py-2 focus:rounded"
      >
        Skip to main content
      </a>

      <div className="flex h-full w-full overflow-hidden">
        <ActivityBar />

        {/* Main Content Area */}
        <main id="main-content" className="flex-1 flex flex-col overflow-hidden relative">
          <header className="h-8 flex items-center px-4 border-b border-copernicus-steel bg-[#050505] shrink-0 draggable">
            <div className="w-20 shrink-0" />
            <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-[0.25em] mr-auto no-drag">
              COPERNICUS_IDE
            </span>
            <div className="flex items-center gap-2 no-drag text-[10px] font-mono">
              <button
                onClick={() => setProjectSelectorOpen(true)}
                className="text-zinc-400 hover:text-copernicus-phosphor transition-colors"
                title="Select project"
              >
                {workingDir.split('/').pop() || '—'}
              </button>
              <span className="text-zinc-700">//</span>
              <span className="text-zinc-600">{activeStoryId ?? '—'}</span>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden">
            {/* Solo full-screen views */}
            {activeView === 'command-center' && <CommandCenter />}
            {activeView === 'planner' && <KanbanBoard onStartSession={() => setProjectSelectorOpen(true)} />}
            {activeView === 'reporter' && <CapexDashboard />}
            {activeView === 'orchestrator' && <WorkflowCanvas />}
            {activeView === 'github' && <GithubDashboard />}
            {activeView === 'memory' && (
              <div className="h-full w-full flex items-center justify-center bg-[#050505] text-copernicus-phosphor/50 font-mono text-sm uppercase tracking-widest">
                Memory Browser — coming in a future release.
              </div>
            )}

            {(activeView === 'designer' || activeView === 'editor') && (
              <>
                {/* Sidebar */}
                <div className={`${sidebarOpen ? 'w-64' : 'w-0'} flex-shrink-0 transition-all duration-300 ease-in-out border-r border-copernicus-steel bg-[#080808] overflow-hidden relative`}>
                  <div className="absolute top-2 right-2 z-10 flex gap-1">
                     <button
                        onClick={() => toggleFlip('sidebar')}
                        className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors bg-[#080808] rounded border border-copernicus-steel"
                        title="Flip Sidebar"
                     >
                        <RotateCcw size={12} />
                     </button>
                  </div>
                  <FlippablePanel
                    id="sidebar"
                    front={<FileTree rootPath={workingDir} />}
                    back={<ContainerViewer />}
                  />
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
                            onFlip={() => toggleFlip('center-panel')}
                            isSpotlightActive={spotlightPane === 'editor'}
                            onBuilder={toggleUIBuilder}
                            isBuilderActive={uiBuilderOpen}
                            onCommandPalette={() => setCommandPaletteOpen(true)}
                            showLspStatus={activeView === 'designer' || activeView === 'editor'}
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
              <span className={`text-[10px] font-mono uppercase tracking-widest ${anyTerminalBusy ? 'text-copernicus-phosphor phosphor-glow animate-pulse' : 'text-zinc-500'}`}>
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
      <ProjectSelectorDialog
        open={projectSelectorOpen}
        onClose={() => setProjectSelectorOpen(false)}
      />
    </div>
  )
}
