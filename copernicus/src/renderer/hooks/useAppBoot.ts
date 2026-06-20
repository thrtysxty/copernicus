import { useState } from 'react'

export function useAppBoot() {
  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [isWizard, setIsWizard] = useState(false)
  const [showSplash, setShowSplash] = useState(true)

  return {
    projectSelectorOpen,
    setProjectSelectorOpen,
    commandPaletteOpen,
    setCommandPaletteOpen,
    isWizard,
    setIsWizard,
    showSplash,
    setShowSplash,
  }
}
