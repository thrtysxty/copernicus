import { create } from 'zustand'
import { UIComponent } from '../components/Editor/ui-builder/types'

interface UIBuilderState {
  uiBuilderOpen: boolean
  uiTestingDrawerOpen: boolean
  paletteOpen: boolean
  inspectorOpen: boolean
  uiComponents: UIComponent[]

  toggleUIBuilder: () => void
  setPaletteOpen: (open: boolean) => void
  setInspectorOpen: (open: boolean) => void
  toggleUITestingDrawer: () => void
  setUIComponents: (components: UIComponent[]) => void
}

export const useUIBuilderStore = create<UIBuilderState>()((set) => ({
  uiBuilderOpen: false,
  uiTestingDrawerOpen: false,
  paletteOpen: true,
  inspectorOpen: true,
  uiComponents: [],

  toggleUIBuilder: () => set((state) => ({ uiBuilderOpen: !state.uiBuilderOpen })),
  setPaletteOpen: (open) => set({ paletteOpen: open }),
  setInspectorOpen: (open) => set({ inspectorOpen: open }),
  toggleUITestingDrawer: () => set((state) => ({ uiTestingDrawerOpen: !state.uiTestingDrawerOpen })),
  setUIComponents: (components) => set({ uiComponents: components }),
}))
