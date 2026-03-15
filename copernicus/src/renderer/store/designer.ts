import { create } from 'zustand'

export type PrimitiveType = 'container' | 'text' | 'button' | 'image' | 'input'

export interface CanvasObjectData {
  id: string
  type: PrimitiveType
  x: number
  y: number
  width: number
  height: number
  label?: string
}

interface DesignerState {
  objects: CanvasObjectData[]
  selectedId: string | null
  addObject: (obj: CanvasObjectData) => void
  updateObject: (id: string, patch: Partial<CanvasObjectData>) => void
  removeObject: (id: string) => void
  setSelectedId: (id: string | null) => void
}

export const useDesignerStore = create<DesignerState>((set) => ({
  objects: [],
  selectedId: null,
  addObject: (obj) => set((state) => ({ objects: [...state.objects, obj] })),
  updateObject: (id, patch) =>
    set((state) => ({
      objects: state.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    })),
  removeObject: (id) =>
    set((state) => ({
      objects: state.objects.filter((o) => o.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    })),
  setSelectedId: (id) => set({ selectedId: id }),
}))
