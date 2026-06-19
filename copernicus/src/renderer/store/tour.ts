import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface TourState {
  hasCompletedTour: boolean
  tourHighlight: string | null
  tourStep: number
  tourActive: boolean
  setHasCompletedTour: () => void
  setTourHighlight: (id: string | null) => void
  setTourStep: (step: number) => void
  setTourActive: (active: boolean) => void
  retakeTour: (setView: (view: any) => void, setCenterMode: (mode: any) => void) => void
}

export const useTourStore = create<TourState>()(
  persist(
    (set) => ({
      hasCompletedTour: false,
      tourHighlight: null,
      tourStep: 0,
      tourActive: false,
      setHasCompletedTour: () => set({ hasCompletedTour: true }),
      setTourHighlight: (id) => set({ tourHighlight: id }),
      setTourStep: (step) => set({ tourStep: step }),
      setTourActive: (active) => set({ tourActive: active }),
      retakeTour: (setView, setCenterMode) => {
        set({ tourActive: true });
        setView('designer');
        setCenterMode('canvas');
      },
    }),
    {
      name: 'copernicus-tour-storage',
      partialize: (state) => ({ hasCompletedTour: state.hasCompletedTour }),
    }
  )
)
