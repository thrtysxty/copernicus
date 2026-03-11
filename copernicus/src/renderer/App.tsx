import React, { useState, useEffect, useRef } from 'react'
import {
  Maximize2, Minimize2, RotateCcw, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useLayoutStore, StoryboardView } from './store/layout'
import { useToastStore } from './store/toastStore'
import { ActivityBar } from './components/layout/ActivityBar'
import { ProjectSelectorDialog } from './components/layout/ProjectSelectorDialog'
import { CommandCenter } from './components/command/CommandCenter'
import { useIpcError } from './hooks/useIpcError'
import { unwrapIpc, IpcResult, LspStatusResponse } from './types/ipc'
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
import GenesisWizard from './components/genesis/GenesisWizard'
import SplashScreen from './components/layout/SplashScreen'
import { ContainerViewer } from './components/runtime/ContainerViewer'
import { MemoryBrowser } from './components/memory/MemoryBrowser'

const TERMINAL_HEIGHT = 200

// Inline PanelHeader to replace missing file
const PanelHeader: React.FC<{
  title: string;
  onSpotlight: () => void;
  onFlip: () => void;
  isSpotlightActive: boolean;
  onCommandPalette?: () => void;
  showLspStatus?: boolean;
}> = ({ title, onSpotlight, onFlip, isSpotlightActive, onCommandPalette, showLspStatus }) => {
  const [lspRunning, setLspRunning] = useState(false)
  const [errorCount, setErrorCount] = useState(0)
  const [warnCount, setWarnCount] = useState(0)
  const invoke = useIpcError()
  const activeFilePath = useLayoutStore(s => s.activeFilePath)

  useEffect(() => {
    invoke<IpcResult<LspStatusResponse>>('lsp:status').then((res) => {
      if (res?.ok && res.data) setLspRunning(res.data.running ?? false)
    }).catch(() => {})

    const removeDiag = window.ipcRenderer.on(
      'lsp:diagnostics-update',
      (_e: Electron.IpcRendererEvent, { uri, diagnostics }: { uri: string; diagnostics: { severity: number }[] }) => {
        if (!activeFilePath || `file://${activeFilePath}` !== uri) return
        let errors = 0, warnings = 0
        diagnostics.forEach((d) => { if (d.severity === 1) errors++; if (d.severity === 2) warnings++ })
        setErrorCount(errors)
        setWarnCount(warnings)
      }
    )
    return () => removeDiag()
  }, [invoke, activeFilePath])

  return (
    <div className="h-8 border-b border-copernicus-steel bg-[#0A0A0A] flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{title}</span>
        {showLspStatus && (
          <button
            aria-label="Toggle command palette"
            className="flex items-center gap-2 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 cursor-pointer hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-copernicus-phosphor focus-visible:outline-none"
            onClick={onCommandPalette}
          >
            <span className={`text-[8px] ${lspRunning ? 'text-green-500' : 'text-red-500'}`}>◉</span>
            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
              LSP {errorCount}E {warnCount}W
            </span>
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onFlip}
          className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors focus-visible:ring-2 focus-visible:ring-copernicus-phosphor focus-visible:outline-none"
          title="Flip Panel"
          aria-label="Flip Panel"
        >
          <RotateCcw size={14} />
        </button>
        <button
          onClick={onSpotlight}
          aria-pressed={isSpotlightActive}
          className={`p-1.5 rounded transition-colors focus-visible:ring-2 focus-visible:ring-copernicus-phosphor focus-visible:outline-none ${isSpotlightActive ? 'text-copernicus-phosphor bg-copernicus-phosphor/10' : 'text-zinc-500 hover:text-zinc-300'}`}
          title="Spotlight"
          aria-label={isSpotlightActive ? "Minimize Spotlight" : "Maximize Spotlight"}
        >
          {isSpotlightActive ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const invoke = useIpcError()
  
  // Selective subscriptions for primitives
  const activeView = useLayoutStore(s => s.activeView)
  const sidebarOpen = useLayoutStore(s => s.sidebarOpen)
  const terminalOpen = useLayoutStore(s => s.terminalOpen)
  const spotlightPane = useLayoutStore(s => s.spotlightPane)
  const workingDir = useLayoutStore(s => s.workingDir)
  const gitBranch = useLayoutStore(s => s.gitBranch)
  const activeStoryId = useLayoutStore(s => s.activeStoryId)
  const capexSessionTime = useLayoutStore(s => s.capexSessionTime)
  const capexTotal = useLayoutStore(s => s.capexTotal)
  const activeFilePath = useLayoutStore(s => s.activeFilePath)
  const activeFileContent = useLayoutStore(s => s.activeFileContent)
  const activeFileLanguage = useLayoutStore(s => s.activeFileLanguage)
  const hasCompletedTour = useLayoutStore(s => s.hasCompletedTour)
  const tourHighlight = useLayoutStore(s => s.tourHighlight)
  const settingsOpen = useLayoutStore(s => s.settingsOpen)

  // Subscriptions for functions (these don't change, so they don't trigger re-renders)
  const setView = useLayoutStore(s => s.setView)
  const setTerminalOpen = useLayoutStore(s => s.setTerminalOpen)
  const setSpotlight = useLayoutStore(s => s.setSpotlight)
  const toggleFlip = useLayoutStore(s => s.toggleFlip)
  const setWorkingDir = useLayoutStore(s => s.setWorkingDir)
  const setGitBranch = useLayoutStore(s => s.setGitBranch)
  const addTerminal = useLayoutStore(s => s.addTerminal)
  const removeTerminal = useLayoutStore(s => s.removeTerminal)
  const setTerminalBusy = useLayoutStore(s => s.setTerminalBusy)
  const toggleUIBuilder = useLayoutStore(s => s.toggleUIBuilder)
  const setActiveFileContent = useLayoutStore(s => s.setActiveFileContent)
  const setActiveFileLanguage = useLayoutStore(s => s.setActiveFileLanguage)
  const setCenterMode = useLayoutStore(s => s.setCenterMode)
  const openFile = useLayoutStore(s => s.openFile)
  const setTourHighlight = useLayoutStore(s => s.setTourHighlight)
  const setChatPanelTab = useLayoutStore(s => s.setChatPanelTab)
  const setInProgressCount = useLayoutStore(s => s.setInProgressCount)
  const setSettingsOpen = useLayoutStore(s => s.setSettingsOpen)
  const setSidebarOpen = useLayoutStore(s => s.setSidebarOpen)
  const showGenesis = useLayoutStore(s => s.showGenesis)
  const setShowGenesis = useLayoutStore(s => s.setShowGenesis)

  const previousSidebarOpenRef = useRef<boolean>(sidebarOpen)
  const prevViewRef = useRef<string>(activeView)

  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [isWizard, setIsWizard] = useState(false)
  const [showSplash, setShowSplash] = useState(true)


  // Initial setup and IPC listeners
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('window') === 'wizard') {
      setIsWizard(true)
      setShowSplash(false)
    }

    const removeWorkspaceChanged = window.ipcRenderer.on('app:workspace-changed', (_e, { path }: { path: string }) => {
      setWorkingDir(path)
    })

    const removeActivateTab = window.ipcRenderer.on('terminal:activate-tab', (_e, { agentId }: { agentId: string }) => {
      addTerminal(`terminal-${agentId}`, agentId.toUpperCase())
    })

    const removeSpawnTerminal = window.ipcRenderer.on('terminal:spawn', (_e, { id, label, ephemeral }: { id: string; label: string; ephemeral?: boolean }) => {
      addTerminal(id, label, ephemeral ?? false)
    })

    const removeBusyState = window.ipcRenderer.on('terminal:set-busy', (_e, { id, busy }: { id: string; busy: boolean }) => {
      setTerminalBusy(id, busy)
    })

    const removeTerminalClosed = window.ipcRenderer.on('terminal-closed', (_e, { id }: { id: string }) => {
      removeTerminal(id)
    })

    const removeTerminalRemove = window.ipcRenderer.on('terminal:remove', (_e, { id }: { id: string }) => {
      removeTerminal(id)
    })

    const removeFlipListener = window.ipcRenderer.on('layout:toggle-flip', () => {
      const target = useLayoutStore.getState().spotlightPane ?? 'chat'
      toggleFlip(target as 'editor' | 'chat')
    })

    const removeSpotListener = window.ipcRenderer.on('layout:toggle-spotlight', () => {
      const current = useLayoutStore.getState().spotlightPane
      setSpotlight(current ? null : 'editor')
    })

    const removeUiBuilderListener = window.ipcRenderer.on('layout:toggle-ui-builder', () => {
      toggleUIBuilder()
    })

    const removePaletteListener = window.ipcRenderer.on('layout:open-palette', () => {
      setCommandPaletteOpen(true)
    })

    const removeSetViewListener = window.ipcRenderer.on('layout:set-view', (_e, viewId: string) => {
      setView(viewId as StoryboardView)
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
    invoke<IpcResult<string | null>>('app:get-root-path').then((r) => {
      const root = unwrapIpc<string | null>(r)
      if (root) {
        setWorkingDir(root)
      } else {
        setShowGenesis(true)
      }
    }).catch(() => setShowGenesis(true))
    invoke<IpcResult<string>>('git:branch').then((r) => setGitBranch(unwrapIpc<string>(r))).catch(() => {})
    invoke<IpcResult<{ status: string }[]>>('stories:list').then((r) => {
      const list = unwrapIpc<{ status: string }[]>(r) ?? []
      setInProgressCount(list.filter((s) => s.status === 'IN PROGRESS').length)
    }).catch(() => {})

    const removeStoriesUpdated = window.ipcRenderer.on('stories:updated', (_e, stories: { status: string }[]) => {
      setInProgressCount(stories.filter((s) => s.status === 'IN PROGRESS').length)
    })

    const removeCriticalError = window.ipcRenderer.on('app:critical-error', (_e, payload) => {
      const p = payload as { type: string; message: string }
      useToastStore.getState().addToast(`[Main] ${p.type}: ${p.message}`, 'error')
    })

    return () => {
      removeCriticalError()
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

  // Story 209: Auto-collapse explorer on designer view entry
  useEffect(() => {
    if (activeView === 'designer' && prevViewRef.current !== 'designer') {
      previousSidebarOpenRef.current = sidebarOpen
      setSidebarOpen(false)
    } else if (prevViewRef.current === 'designer' && activeView === 'editor') {
      setSidebarOpen(previousSidebarOpenRef.current)
    }
    prevViewRef.current = activeView
  }, [activeView, sidebarOpen, setSidebarOpen])

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

    ;window.ipcRenderer.send('telemetry:update-touchbar', {
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
          <header className="h-8 flex items-center px-4 border-b border-copernicus-steel bg-[#050505] shrink-0 draggable relative">
            {/* Absolutely centered title — doesn't interact with flex children */}
            <span className="absolute inset-x-0 flex justify-center pointer-events-none">
              <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-[0.25em] no-drag">
                COPERNICUS_IDE
              </span>
            </span>
            {/* Right-side metadata — constrained so it never overflows */}
            <div className="ml-auto flex items-center gap-2 no-drag text-[10px] font-mono min-w-0 max-w-[40%]">
              <button
                onClick={() => setProjectSelectorOpen(true)}
                className="text-zinc-400 hover:text-copernicus-phosphor transition-colors truncate max-w-[120px]"
                title="Select project"
              >
                {workingDir.split('/').pop() || '—'}
              </button>
              <span className="text-zinc-700 shrink-0">//</span>
              <span className="text-zinc-600 truncate max-w-[80px]">{activeStoryId ?? '—'}</span>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden">
            {/* Solo full-screen views */}
            {activeView === 'command-center' && <CommandCenter />}
            {activeView === 'planner' && <KanbanBoard onStartSession={() => setProjectSelectorOpen(true)} />}
            {activeView === 'reporter' && <CapexDashboard />}
            {activeView === 'orchestrator' && <WorkflowCanvas />}
            {activeView === 'github' && <GithubDashboard />}
            {activeView === 'memory' && <MemoryBrowser />}

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
                    <PanelHeader
                      title={activeStoryId ? `STORY // ${activeStoryId}` : 'DEVELOPMENT_CORE'}
                      onSpotlight={() => setSpotlight(spotlightPane === 'editor' ? null : 'editor')}
                      onFlip={() => toggleFlip('center-panel')}
                      isSpotlightActive={spotlightPane === 'editor'}
                      onCommandPalette={() => setCommandPaletteOpen(true)}
                      showLspStatus={activeView === 'designer' || activeView === 'editor'}
                    />
                    <FlippablePanel
                      id="center-panel"
                      className="flex-1"
                      front={
                        <CenterPanelRouter
                          filePath={activeFilePath}
                          content={activeFileContent}
                          language={activeFileLanguage}
                          onChange={(v) => setActiveFileContent(v ?? '')}
                        />
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

          <button
            className="h-6 w-full flex items-center px-3 gap-2 border-t border-copernicus-steel bg-[#0A0A0A] cursor-pointer hover:bg-zinc-900 transition-colors focus-visible:ring-2 focus-visible:ring-copernicus-phosphor focus-visible:outline-none"
            onClick={() => setTerminalOpen(!terminalOpen)}
            aria-expanded={terminalOpen}
            aria-label="Toggle terminal"
          >
            <div className="flex items-center gap-2 flex-1 pointer-events-none">
              {terminalOpen
                ? <ChevronDown size={12} className="text-zinc-500 hover:text-zinc-300" />
                : <ChevronUp size={12} className="text-zinc-500 hover:text-zinc-300" />
              }
            </div>
          </button>

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
            openFile(path)
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
      {showGenesis && (
        <GenesisWizard 
          onComplete={() => {
            setShowGenesis(false);
            // After genesis, we might want to refresh the working dir
            invoke<IpcResult<string | null>>('app:get-root-path').then((r) => {
              const root = unwrapIpc<string | null>(r);
              if (root) setWorkingDir(root);
            }).catch(() => {});
          }} 
        />
      )}
    </div>
  )
}
