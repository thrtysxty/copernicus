import { useEffect } from 'react'
import { useLayoutStore, PHOSPHOR_PRESETS } from '../store/layout'

const ipcRenderer = window.ipcRenderer

export function useThemeManager() {
  const phosphorColor = useLayoutStore((state) => state.phosphorColor)

  useEffect(() => {
    const root = document.documentElement
    const preset = PHOSPHOR_PRESETS[phosphorColor]
    if (preset) {
      root.style.setProperty('--copernicus-phosphor-rgb', preset.rgb)
      root.style.setProperty('--phosphor', preset.hex)

      // Persist to settings.json via main process so splash screen can read it on next launch
      if (ipcRenderer) {
        ipcRenderer.invoke('settings:save', { phosphorColor: preset.hex }).catch(console.error)
      }
    }
  }, [phosphorColor])
}
