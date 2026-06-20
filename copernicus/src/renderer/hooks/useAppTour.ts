import { useEffect } from 'react'

export function useAppTour({
  hasCompletedTour,
  showSplash,
  isWizard,
  triggerTour,
}: {
  hasCompletedTour: boolean
  showSplash: boolean
  isWizard: boolean
  triggerTour: () => void
}) {
  useEffect(() => {
    if (!hasCompletedTour && !showSplash && !isWizard) {
      triggerTour()
    }
  }, [hasCompletedTour, showSplash, isWizard, triggerTour])
}
