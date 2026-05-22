import { useEffect } from 'react'
import { useLayoutStore, PHOSPHOR_PRESETS } from '../store/layout'
import log from '../utils/logger'
import { useIpcError } from './useIpcError'
import { unwrapIpc } from '../types/ipc'

export function useThemeManager() {
  const invoke = useIpcError()
  const phosphorColor = useLayoutStore((state) => state.phosphorColor)
  const uiDensity = useLayoutStore((state) => state.uiDensity)
  const fontSize = useLayoutStore((state) => state.fontSize)
  const animationsEnabled = useLayoutStore((state) => state.animationsEnabled)
  const crtMode = useLayoutStore((state) => state.crtMode)

  useEffect(() => {
    const root = document.documentElement
    const preset = PHOSPHOR_PRESETS[phosphorColor]
    if (preset) {
      root.style.setProperty('--copernicus-phosphor-rgb', preset.rgb)
      root.style.setProperty('--phosphor', preset.hex)

      // Apply other appearance settings
      root.style.setProperty('--editor-font-size', `${fontSize}px`)
      
      if (!animationsEnabled) {
        root.classList.add('disable-animations')
      } else {
        root.classList.remove('disable-animations')
      }

      if (crtMode) {
        root.classList.add('crt-mode')
      } else {
        root.classList.remove('crt-mode')
      }

      // Handle UI density classes
      root.classList.remove('ui-density-compact', 'ui-density-normal', 'ui-density-comfortable')
      root.classList.add(`ui-density-${uiDensity}`)

      // Persist to settings.json via main process so splash screen can read it on next launch
      if (invoke) {
        invoke('settings:save', {
          phosphorColor: preset.hex,
          appearance: { uiDensity, fontSize, animationsEnabled, crtMode }
        }).then(res => unwrapIpc(res)).catch(log.error)
      }
    }
  }, [phosphorColor, uiDensity, fontSize, animationsEnabled, crtMode, invoke])
}
