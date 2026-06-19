import { useEffect } from 'react'
import { useWorkspaceStore } from '../store/workspace'
import { useTourStore } from '../store/tour'

export function useTour() {
  const hasCompletedTour = useTourStore(s => s.hasCompletedTour)
  const tourHighlight = useTourStore(s => s.tourHighlight)
  const setTourHighlight = useTourStore(s => s.setTourHighlight)
  const setView = useWorkspaceStore(s => s.setView)
  const setChatPanelTab = useWorkspaceStore(s => s.setChatPanelTab)

  // Tour Trigger on Mount
  useEffect(() => {
    // We only trigger tour if splash is gone, not in wizard, and not completed
    // Since this hook doesn't know about splash/wizard, the component will handle the condition
  }, [hasCompletedTour, setChatPanelTab, setView])

  // Tour Highlight Auto-clear
  useEffect(() => {
    if (tourHighlight) {
      const timer = setTimeout(() => {
        setTourHighlight(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [tourHighlight, setTourHighlight])

  return {
    hasCompletedTour,
    tourHighlight,
    setTourHighlight,
    triggerTour: () => {
      setChatPanelTab('guide')
      setView('planner')
    }
  }
}
