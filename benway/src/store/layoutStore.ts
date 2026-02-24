import { create } from 'zustand'

interface LayoutState {
  sidebarOpen: boolean
  telemetryOpen: boolean
  toggleSidebar: () => void
  toggleTelemetry: () => void
}

export const useBenwayLayoutStore = create<LayoutState>((set) => ({
  sidebarOpen: true,
  telemetryOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleTelemetry: () => set((state) => ({ telemetryOpen: !state.telemetryOpen })),
}))
