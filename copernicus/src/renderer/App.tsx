import React from 'react'
import { useWorkspaceStore } from './store/workspace'
import { useKanbanStore } from './store/kanban'
import { useUIBuilderStore } from './store/uiBuilderStore'
import { useIpcError } from './hooks/useIpcError'
import SplashScreen from './components/layout/SplashScreen'
import Wizard from './components/wizard/Wizard'
import { AppShell } from './components/layout/AppShell'

import { useAppIpcListeners } from './hooks/useAppIpcListeners'
import { useCommandRegistration } from './hooks/useCommandRegistration'
import { useTour } from './hooks/useTour'
import { useExtensionLoader } from './hooks/useExtensionLoader'
import { useAppBoot } from './hooks/useAppBoot'
import { useAppTour } from './hooks/useAppTour'

export default function App() {
  const invoke = useIpcError()
  const { hasCompletedTour, triggerTour } = useTour()
  useExtensionLoader()

  const {
    projectSelectorOpen, setProjectSelectorOpen,
    commandPaletteOpen, setCommandPaletteOpen,
    isWizard, setIsWizard,
    showSplash, setShowSplash,
  } = useAppBoot()

  useAppTour({ hasCompletedTour, showSplash, isWizard, triggerTour })

  const activeView = useWorkspaceStore(s => s.activeView)
  const setView = useWorkspaceStore(s => s.setView)
  const setTerminalOpen = useWorkspaceStore(s => s.setTerminalOpen)
  const setSpotlight = useWorkspaceStore(s => s.setSpotlight)
  const spotlightPane = useWorkspaceStore(s => s.spotlightPane)
  const toggleFlip = useWorkspaceStore(s => s.toggleFlip)
  const setWorkingDir = useWorkspaceStore(s => s.setWorkingDir)
  const setGitBranch = useWorkspaceStore(s => s.setGitBranch)
  const setGitDirty = useWorkspaceStore(s => s.setGitDirty)
  const addTerminal = useWorkspaceStore(s => s.addTerminal)
  const removeTerminal = useWorkspaceStore(s => s.removeTerminal)
  const setTerminalBusy = useWorkspaceStore(s => s.setTerminalBusy)
  const toggleUIBuilder = useUIBuilderStore(s => s.toggleUIBuilder)
  const setCenterMode = useWorkspaceStore(s => s.setCenterMode)
  const setInProgressCount = useKanbanStore(s => s.setInProgressCount)
  const setPendingSystemMessage = useWorkspaceStore(s => s.setPendingSystemMessage)
  const setShowGenesis = useWorkspaceStore(s => s.setShowGenesis)
  const setSettingsOpen = useWorkspaceStore(s => s.setSettingsOpen)

  useCommandRegistration({
    setIsWizard,
    setSettingsOpen,
    setView,
    setTerminalOpen,
    setSpotlight,
    spotlightPane,
  })

  useAppIpcListeners({
    invoke,
    setWorkingDir,
    setGitBranch,
    setGitDirty,
    addTerminal,
    setTerminalBusy,
    removeTerminal,
    toggleFlip,
    setSpotlight,
    toggleUIBuilder,
    setCommandPaletteOpen,
    setView,
    setCenterMode,
    setPendingSystemMessage,
    setShowGenesis,
    setInProgressCount,
  })

  React.useEffect(() => {
    invoke('extension:fire-event', { event: `onView:${activeView}` })
      .catch(err => console.error('Extension fire event failed', err))
  }, [activeView, invoke])

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />
  }

  if (isWizard) {
    return (
      <div className="h-screen w-screen">
        <Wizard
          onComplete={async (workspacePath: string) => {
            setWorkingDir(workspacePath)
            setIsWizard(false)
            setShowGenesis(false)
            setView('planner')
          }}
        />
      </div>
    )
  }

  return (
    <AppShell
      projectSelectorOpen={projectSelectorOpen}
      setProjectSelectorOpen={setProjectSelectorOpen}
      commandPaletteOpen={commandPaletteOpen}
      setCommandPaletteOpen={setCommandPaletteOpen}
    />
  )
}
