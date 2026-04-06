import { useEffect } from 'react'
import { commandRegistry } from '../store/commandRegistry'
import { StoryboardView, PaneId } from '../store/layout'

interface UseCommandRegistrationArgs {
  setIsWizard: (isWizard: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setView: (view: StoryboardView) => void
  setTerminalOpen: (open: boolean) => void
  setSpotlight: (id: PaneId | null) => void
  spotlightPane: string | null
}

export function useCommandRegistration({
  setIsWizard,
  setSettingsOpen,
  setView,
  setTerminalOpen,
  setSpotlight,
  spotlightPane,
}: UseCommandRegistrationArgs) {
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
  }, []) // Empty dependency array as per AC
}
