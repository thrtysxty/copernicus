import log from './utils/logger'
import React, { useState, useEffect, useRef } from 'react'
import {
  Maximize2, RotateCcw, ChevronDown, Archive,
} from 'lucide-react'
import { useLayoutStore, StoryboardView } from './store/layout'
import { useUIBuilderStore } from './store/uiBuilderStore'
import { useTelemetryStore } from './store/telemetryStore'
import { useToastStore } from './store/toastStore'
import { motion } from 'framer-motion'
import { ActivityBar } from './components/layout/ActivityBar'
import { ApplicationHeader } from './components/layout/ApplicationHeader'
import { ProjectSelectorDialog } from './components/layout/ProjectSelectorDialog'
import { CommandCenter } from './components/command/CommandCenter'
import { useIpcError } from './hooks/useIpcError'
import { unwrapIpc, IpcResult, WorkspaceState } from './types/ipc'
import { useExtensionStore } from './store/extensionStore'
import { FileTree } from './components/FileTree/FileTree'
import { ChatPanel } from './components/chat/ChatPanel'
import { StatusBar } from './components/layout/StatusBar'
import { FlippablePanel } from './components/layout/FlippablePanel'
import { CenterPanelRouter } from './components/Editor/CenterPanelRouter'
import { TerminalTabs } from './components/Terminal/TerminalTabs'
import { KanbanBoard } from './components/kanban/KanbanBoard'
import { CapexDashboard } from './components/capex/CapexDashboard'
import WorkflowCanvas from './components/workflow/WorkflowCanvas'
import { TileInspector } from './components/orchestrator/TileInspector'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { CommandPalette } from './components/layout/CommandPalette'
import { commandRegistry } from './store/commandRegistry'
import Wizard from './components/wizard/Wizard'
import GenesisWizard from './components/genesis/GenesisWizard'
import { IntelligenceManager } from './components/intelligence/IntelligenceManager'
import SplashScreen from './components/layout/SplashScreen'
import { CRTOverlay } from './components/effects/CRTOverlay'
import { ContainerViewer } from './components/runtime/ContainerViewer'
import { DebugPanel } from './components/debug/DebugPanel'

import { SourceControlView } from './components/source-control/SourceControlView'
import { MemoryReplayView } from './components/memory/MemoryReplayView'
import { OutputView } from './components/output/OutputView'
import { KnowledgeBaseView } from './components/kb/KnowledgeBaseView'

// The following panels are still rendered directly as they are not part of the new tiled views
import { SearchPanel } from './components/search/SearchPanel'
import { ReviewPanel } from './components/review/ReviewPanel'


const TERMINAL_HEIGHT = 200

const ArchiveDrawer: React.FC = () => {
  const invoke = useIpcError()
  const [archived, setArchived] = useState<{ id: string; title: string; date?: string }[]>([])
  const setTerminalOpen = useLayoutStore(s => s.setTerminalOpen)
  const toggleArchive = useLayoutStore(s => s.toggleArchive)
  const setSpotlight = useLayoutStore(s => s.setSpotlight)
  const spotlightPane = useLayoutStore(s => s.spotlightPane)

  useEffect(() => {
    invoke('stories:list', { status: 'ARCHIVED' })
      .then((res: any) => {
        const list = res?.data ?? res ?? []
        if (Array.isArray(list)) setArchived(list)
      })
      .catch(() => {})
  }, [invoke])

  return (
    <div className="h-full flex flex-col bg-[#050505]">
      <div className="h-8 flex items-center border-t border-zinc-700 border-b border-copernicus-steel px-0 shrink-0 bg-[#080808]">
        <div className="flex-1 flex items-center px-3">
          <Archive size={10} className="text-copernicus-phosphor mr-2" />
          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Archive</span>
        </div>
        <div className="flex items-center gap-2 px-3 shrink-0">
          <button
            onClick={() => { toggleArchive() }}
            className="text-zinc-600 hover:text-zinc-300 transition-colors opacity-60 hover:opacity-100"
            title="Switch to Terminal"
          >
            <RotateCcw size={12} />
          </button>
          <button
            onClick={() => setSpotlight(spotlightPane === 'terminal' ? null : 'terminal')}
            className="text-zinc-600 hover:text-zinc-300 transition-colors opacity-60 hover:opacity-100"
            title="Spotlight"
          >
            <Maximize2 size={12} />
          </button>
          <button
            onClick={() => setTerminalOpen(false)}
            className="text-copernicus-phosphor hover:text-zinc-300 transition-colors opacity-60 hover:opacity-100"
            title="Close Archive"
          >
            <ChevronDown size={12} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
        {!archived.length && (
          <p className="text-[9px] text-zinc-700 italic mt-2">No archived stories.</p>
        )}
        {archived.map(s => (
          <div key={s.id} className="flex items-center gap-3 text-[9px] font-mono text-zinc-600">
            <span className="text-zinc-700">{s.id}</span>
            <span className="truncate text-zinc-500">{s.title}</span>
            <span className="ml-auto text-zinc-700 shrink-0">{s.date ?? ''}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const invoke = useIpcError()
  
  // Selective subscriptions for primitives
  const activeView = useLayoutStore(s => s.activeView)
  const workspaceKey = useLayoutStore(s => s.workspaceKey)
  const sidebarOpen = useLayoutStore(s => s.sidebarOpen)
  const terminalOpen = useLayoutStore(s => s.terminalOpen)
  const showArchive = useLayoutStore(s => s.showArchive)
  const spotlightPane = useLayoutStore(s => s.spotlightPane)
  const isSessionEnded = useLayoutStore(s => s.isSessionEnded)
  const workingDir = useLayoutStore(s => s.workingDir)
  const gitBranch = useLayoutStore(s => s.gitBranch)
  const activeStoryId = useLayoutStore(s => s.activeStoryId)
  const activeFilePath = useLayoutStore(s => s.activeFilePath)
  const activeFileContent = useLayoutStore(s => s.activeFileContent)
  const activeFileLanguage = useLayoutStore(s => s.activeFileLanguage)
  const chatPanelOpen = useLayoutStore(s => s.chatPanelOpen)
  const hasCompletedTour = useLayoutStore(s => s.hasCompletedTour)
  const tourHighlight = useLayoutStore(s => s.tourHighlight)
  const settingsOpen = useLayoutStore(s => s.settingsOpen)
  const agentsOpen = useLayoutStore(s => s.agentsOpen)
  const setAgentsOpen = useLayoutStore(s => s.setAgentsOpen)

  const capexSessionTime = useTelemetryStore(s => s.capexSessionTime)
  const capexTotal = useTelemetryStore(s => s.capexTotal)
  const agentTelemetry = useTelemetryStore(s => s.agentTelemetry)

  const toggleUIBuilder = useUIBuilderStore(s => s.toggleUIBuilder)

  // Subscriptions for functions (these don't change, so they don't trigger re-renders)
  const setView = useLayoutStore(s => s.setView)
  const setTerminalOpen = useLayoutStore(s => s.setTerminalOpen)
  const setSpotlight = useLayoutStore(s => s.setSpotlight)
  const toggleFlip = useLayoutStore(s => s.toggleFlip)
  const setWorkingDir = useLayoutStore(s => s.setWorkingDir)
  const setGitBranch = useLayoutStore(s => s.setGitBranch)
  const setGitDirty = useLayoutStore(s => s.setGitDirty)
  const addTerminal = useLayoutStore(s => s.addTerminal)
  const removeTerminal = useLayoutStore(s => s.removeTerminal)
  const setTerminalBusy = useLayoutStore(s => s.setTerminalBusy)
  const setActiveFileContent = useLayoutStore(s => s.setActiveFileContent)
  const setCenterMode = useLayoutStore(s => s.setCenterMode)
  const setTourHighlight = useLayoutStore(s => s.setTourHighlight)
  const setChatPanelTab = useLayoutStore(s => s.setChatPanelTab)
  const setInProgressCount = useLayoutStore(s => s.setInProgressCount)
  const setPendingReview = useLayoutStore(s => s.setPendingReview)
  const setPendingSystemMessage = useLayoutStore(s => s.setPendingSystemMessage)
  const setSettingsOpen = useLayoutStore(s => s.setSettingsOpen)
  const setSidebarOpen = useLayoutStore(s => s.setSidebarOpen)
  const setChatPanelOpen = useLayoutStore(s => s.setChatPanelOpen)
  const showGenesis = useLayoutStore(s => s.showGenesis)
  const setShowGenesis = useLayoutStore(s => s.setShowGenesis)

  const previousSidebarOpenRef = useRef<boolean>(sidebarOpen)
  const prevViewRef = useRef<string>(activeView)

  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [isWizard, setIsWizard] = useState(false)
  const [showSplash, setShowSplash] = useState(true)


  // Story 428: Init kanban columns from SQLite on mount
  useEffect(() => {
    const LABELS: Record<string, string> = {
      'planning': 'Planning', 'storyboarding': 'Storyboarding', 'sprint-planning': 'Sprint Planning',
      'development': 'Development', 'testing': 'Testing', 'qa': 'QA',
      'documenting': 'Documenting', 'ready-to-build': 'Ready to Build', 'done': 'Done',
    }
    invoke<unknown>('kanban:get-columns').then((res) => {
      const cols = unwrapIpc<Array<{ id: string; [k: string]: unknown }>>(res as IpcResult<Array<{ id: string; [k: string]: unknown }>>)
      if (cols && Array.isArray(cols)) {
        useLayoutStore.getState().setColumns(cols.map(c => ({ ...c, label: LABELS[c.id] ?? c.id } as any)))
      }
    }).catch((e: unknown) => log.error('Failed to init kanban columns', e))
  }, [invoke])

  // Story 380: Sync fullscreen state from main process
  const [isFullscreen, setIsFullscreen] = useState(false)
  useEffect(() => {
    return window.ipcRenderer.on('window:fullscreen-state', (_e, state) => {
      setIsFullscreen(state as boolean)
    })
  }, [])

  // Story 380 & 609: ESC exits native fullscreen safely and closes intelligence view
  useEffect(() => {
    if (!isFullscreen && !agentsOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        if (agentsOpen) {
          setAgentsOpen(false)
        } else if (isFullscreen) {
          invoke('window:exit-fullscreen')
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreen, agentsOpen, invoke, setAgentsOpen])

  // Load extensions on mount
  useEffect(() => {
    const loadExtensions = async () => {
      try {
        const [nodesRes, tilesRes, providersRes] = await Promise.all([
          invoke('extensions:workflow-nodes'),
          invoke('extensions:tiles'),
          invoke('extensions:providers'),
        ])
        const nodes = unwrapIpc<any[]>(nodesRes as any) ?? []
        const tiles = unwrapIpc<any[]>(tilesRes as any) ?? []
        const providers = unwrapIpc<any[]>(providersRes as any) ?? []
        useExtensionStore.getState().setWorkflowNodes(nodes)
        useExtensionStore.getState().setTiles(tiles)
        useExtensionStore.getState().setProviders(providers)
      } catch { /* no extensions installed — ignore */ }
    }
    loadExtensions()
  }, [invoke])

  // Initial setup and IPC listeners
  useEffect(() => {
    commandRegistry.registerCommand({ id: 'open-settings', label: 'Open Settings', shortcut: '⌘,', action: () => setSettingsOpen(true) })
    commandRegistry.registerCommand({ id: 'open-planner', label: 'Open Planner', shortcut: '', action: () => setView('planner') })
    commandRegistry.registerCommand({ id: 'open-terminal', label: 'Open Terminal', shortcut: '', action: () => setTerminalOpen(true) })
    commandRegistry.registerCommand({ id: 'toggle-spotlight', label: 'Toggle Explorer Spotlight', shortcut: '', action: () => setSpotlight(spotlightPane ? null : 'explorer') })
    commandRegistry.registerCommand({ id: 'new-story', label: 'New Story', shortcut: '', action: () => { /* open story form */ } })
    commandRegistry.registerCommand({ id: 'switch-model', label: 'Switch Model', shortcut: '', action: () => setSettingsOpen(true) })

    const params = new URLSearchParams(window.location.search)
    if (params.get('window') === 'wizard') {
      setIsWizard(true)
    }

    const removeWorkspaceChanged = window.ipcRenderer.on('app:workspace-changed', (_e, workspaceState: WorkspaceState) => {
      setWorkingDir(workspaceState.path)
      setGitBranch(workspaceState.branch)
      setGitDirty(workspaceState.isDirty)
      // AC4: Context reset on switch
      useLayoutStore.getState().resetForWorkspaceSwitch()

      // Verify env state consistency
      invoke<IpcResult<WorkspaceState>>('app:get-env-state').then((r) => {
        const envState = unwrapIpc<WorkspaceState>(r)
        if (envState?.drift?.length) {
          log.warn('[workspace] State drift detected after switch:', envState.drift)
        }
      }).catch(() => {})

      // Re-fetch stories for new workspace
      invoke<IpcResult<{ status: string }[]>>('stories:list').then((r) => {
        const list = unwrapIpc<{ status: string }[]>(r) ?? []
        setInProgressCount(list.filter((s) => s.status === 'IN PROGRESS').length)
      }).catch(() => {})
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

    const removeReviewSession = window.ipcRenderer.on('review:session-complete', (_e, data: any) => {
      // New logic for story 334:
      const storyId = data.stories && data.stories.length > 0 ? data.stories[0].toString() : 'UNKNOWN'
      const storyTitle = data.stories && data.stories.length > 0 ? `Story ${data.stories[0]}` : 'Untitled Story'

      setPendingSystemMessage({
        type: 'review-summary',
        storyId,
        storyTitle,
        changedFiles: data.changedFiles ? data.changedFiles.slice(0, 10) : [],
        summary: `Story ${storyId} implementation complete. ${data.changedFiles ? data.changedFiles.length : 0} file(s) changed.`,
        timestamp: new Date().toISOString()
      })
      // The generic chat message is no longer needed as the ReviewSummaryCard handles display
      // invoke('chat:send-system', message)
    })

    const views = ['planner', 'editor', 'designer', 'orchestrator', 'reporter', 'command-center', 'memory', 'review', 'git'] as const
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') { e.preventDefault(); setCommandPaletteOpen(true) }
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
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
      removeReviewSession()
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [invoke, setWorkingDir, setGitBranch, setGitDirty, addTerminal, setTerminalBusy, removeTerminal, toggleFlip, setSpotlight, toggleUIBuilder, setView, setPendingReview])

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

  const sidebarClass = (() => {
    if (spotlightPane === 'explorer') return 'flex-1'
    if (spotlightPane === 'editor' || spotlightPane === 'chat') return 'w-10 flex-shrink-0'
    if (!sidebarOpen) return 'w-10 flex-shrink-0'
    return 'w-64 flex-shrink-0'
  })()

  const centerClass = (() => {
    if (spotlightPane === 'editor') return 'flex-[3]' // Maximize editor if spotlighted
    // If the current view is editor or designer, ensure it's always visible
    if (activeView === 'editor' || activeView === 'designer') {
      return 'flex-1' // Always take normal space unless editor is spotlighted
    }

    // Original logic for other views (these are rendered outside this block and not directly affected by this flex context)
    if (spotlightPane === 'chat') return 'w-0 opacity-0 pointer-events-none'
    if (spotlightPane === 'explorer') return 'w-10 flex-shrink-0'
    return 'flex-1'
  })()

  const chatClass = (() => {
    if (!chatPanelOpen) return 'w-10 flex-shrink-0'
    if (spotlightPane === 'chat') return 'flex-1'
    if (spotlightPane === 'editor' || spotlightPane === 'explorer') return 'w-10 flex-shrink-0'
    return 'w-80 flex-shrink-0'
  })()


  const crtMode = useLayoutStore(s => s.crtMode)
  const anyAgentActive = Object.keys(agentTelemetry ?? {}).length > 0
  const heavyLoad = Object.keys(agentTelemetry ?? {}).length >= 3

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />
  }

  if (isWizard) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="h-screen w-screen"
      >
        <Wizard
          onComplete={async (workspacePath: string) => {
            setWorkingDir(workspacePath)
            setIsWizard(false)
            setShowGenesis(false)
            setView('planner')
          }}
        />
      </motion.div>
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

      <ApplicationHeader />

      <div className="flex flex-1 w-full overflow-hidden">
        <ActivityBar />

        {/* Main Content Area */}
        <main id="main-content" className="flex-1 flex flex-col overflow-hidden relative" key={workspaceKey}>
          <div className="flex-1 flex overflow-hidden">
            {/* Solo full-screen views */}
            {activeView === 'command-center' && <CommandCenter />}
            {activeView === 'planner' && (
              <KanbanBoard onStartSession={() => setProjectSelectorOpen(true)} />
            )}
            {activeView === 'reporter' && <CapexDashboard />}
            {activeView === 'orchestrator' && (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="flex flex-1 overflow-hidden">
                  <WorkflowCanvas />
                  <TileInspector />
                </div>
              </div>
            )}
            {activeView === 'diagnostics' && <OutputView />}
            {activeView === 'memory' && <MemoryReplayView />}
            {activeView === 'git' && <SourceControlView />}
            {activeView === 'search' && <SearchPanel />}
            {activeView === 'review' && <ReviewPanel />}
            {activeView === 'debug' && <DebugPanel />}
            {activeView === 'knowledge-base' && <KnowledgeBaseView />}
            {(activeView === 'designer' || activeView === 'editor') && (

              <>
                {/* Sidebar */}
                <div className={`${sidebarClass} min-w-0 transition-all duration-300 ease-in-out border-r border-copernicus-steel bg-[#080808] relative flex flex-col overflow-hidden`}>
                  {(!sidebarOpen || spotlightPane === 'editor' || spotlightPane === 'chat') ? (
                    <div className="h-full w-10 flex flex-col items-center justify-center bg-[#080808] border-r border-copernicus-steel cursor-pointer hover:bg-white/5 shrink-0" onClick={() => !sidebarOpen ? setSidebarOpen(true) : setSpotlight(null)}>
                      <span className="text-[9px] font-mono text-zinc-600 uppercase" style={{ writingMode: 'vertical-rl' }}>Explorer</span>
                    </div>
                  ) : (
                    <FlippablePanel
                      id="sidebar"
                      className="flex-1 overflow-hidden"
                      front={<FileTree rootPath={workingDir} />}
                      back={<ContainerViewer />}
                    />
                  )}
                </div>

                {/* Center Panel & Chat */}
                <div className="flex-1 flex min-w-0 overflow-hidden relative">
                  <div className={`${centerClass} min-w-0 transition-all duration-300 ease-in-out flex flex-col overflow-hidden`}>
                    {spotlightPane === 'explorer' ? (
                       <div className="h-full w-10 flex flex-col items-center justify-center bg-[#080808] border-r border-copernicus-steel cursor-pointer hover:bg-white/5 shrink-0" onClick={() => setSpotlight(null)}>
                          <span className="text-[9px] font-mono text-zinc-600 uppercase" style={{ writingMode: 'vertical-rl' }}>Editor</span>
                       </div>
                    ) : (
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
                        back={
                          <div className="h-full w-full flex flex-col bg-zinc-900">
                            <div className="h-8 flex items-center justify-between px-3 border-b border-copernicus-steel bg-[#080808] shrink-0">
                              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Canvas</span>
                              <button
                                onClick={() => toggleFlip('center-panel')}
                                className="text-zinc-500 hover:text-zinc-200 transition-colors text-[9px] font-mono uppercase tracking-widest"
                                title="Flip to Editor"
                              >
                                ← Editor
                              </button>
                            </div>
                            <div className="flex-1 flex items-center justify-center font-mono text-xs text-zinc-600">CANVAS_PREVIEW_ACTIVE</div>
                          </div>
                        }
                      />
                    )}
                  </div>

                  <div className={`${chatClass} min-w-0 transition-all duration-300 ease-in-out border-l border-copernicus-steel flex flex-col overflow-hidden`}>
                    {(!chatPanelOpen || spotlightPane === 'editor' || spotlightPane === 'explorer') ? (
                       <div className="h-full w-10 flex flex-col items-center justify-center bg-[#080808] border-l border-copernicus-steel cursor-pointer hover:bg-white/5 shrink-0" onClick={() => !chatPanelOpen ? setChatPanelOpen(true) : setSpotlight(null)}>
                          <span className="text-[9px] font-mono text-zinc-600 uppercase" style={{ writingMode: 'vertical-rl' }}>Chat</span>
                       </div>
                    ) : (
                      <ChatPanel />
                    )}
                  </div>

                  {isSessionEnded && (activeView === 'editor' || activeView === 'designer') && (
                    <div className="absolute inset-0 z-50 pointer-events-auto bg-black/60 flex items-center justify-center">
                      <div className="text-center font-mono">
                        <div className="text-zinc-300 text-sm mb-1">Session ended</div>
                        <div className="text-zinc-600 text-[11px]">Planning and reports are still accessible</div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Terminal / Archive Drawer */}
          <div
            className={`bg-[#050505] transition-all duration-300 ease-in-out overflow-hidden${!terminalOpen ? ' cursor-pointer' : ''}`}
            style={{ height: !terminalOpen ? '32px' : spotlightPane === 'terminal' ? '60vh' : `${TERMINAL_HEIGHT}px` }}
            onClick={!terminalOpen ? () => setTerminalOpen(true) : undefined}
          >
            {showArchive ? <ArchiveDrawer /> : <TerminalTabs />}
          </div>

          <StatusBar />

        </main>
      </div>

      {/* Overlays */}
      {agentsOpen && (
        <div className="absolute inset-0 z-[200] bg-[#050505]">
          <IntelligenceManager onClose={() => setAgentsOpen(false)} />
        </div>
      )}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
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
      <CRTOverlay enabled={crtMode} anyAgentActive={anyAgentActive} heavyLoad={heavyLoad} />
    </div>
  )
}
