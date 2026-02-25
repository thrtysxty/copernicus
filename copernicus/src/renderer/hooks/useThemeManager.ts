import { useEffect } from 'react'
import { useLayoutStore, PHOSPHOR_PRESETS } from '../store/layout'

export function useThemeManager() {
  const phosphorColor = useLayoutStore((state) => state.phosphorColor)

  useEffect(() => {
    const root = document.documentElement
    const preset = PHOSPHOR_PRESETS[phosphorColor]
    if (preset) {
      root.style.setProperty('--copernicus-phosphor-rgb', preset.rgb)
    }
  }, [phosphorColor])
}
