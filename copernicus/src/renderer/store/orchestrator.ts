import { create } from 'zustand'

export interface OrchestratorTile {
  id: string
  category: 'vcs' | 'search' | 'review' | 'container' | 'browser' | 'extensions' | string
  label: string
  icon: string        // Phosphor icon name (string)
  defaultConfig: Record<string, string>
  configSchema: Array<{ key: string; label: string; type: 'text' | 'select'; options?: string[] }>
}

export interface OrchestratorNode {
  id: string
  tileId: string
  label: string
  config: Record<string, string>
  position: { x: number; y: number }
}

interface OrchestratorState {
  tiles: OrchestratorTile[]
  canvasNodes: OrchestratorNode[]
  selectedNodeId: string | null
  setSelectedNodeId: (id: string | null) => void
  addNodeFromTile: (tile: OrchestratorTile, position: { x: number; y: number }) => void
  updateNode: (id: string, patch: Partial<OrchestratorNode>) => void
  removeNode: (id: string) => void
  setTiles: (tiles: OrchestratorTile[]) => void
}

export const useOrchestratorStore = create<OrchestratorState>((set) => ({
  tiles: [],
  canvasNodes: [],
  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  addNodeFromTile: (tile, position) => set((state) => {
    const newNodeId = `node-${Date.now()}`
    return {
      canvasNodes: [
        ...state.canvasNodes,
        {
          id: newNodeId,
          tileId: tile.id,
          label: tile.label,
          config: { ...tile.defaultConfig },
          position,
        }
      ],
      selectedNodeId: newNodeId
    }
  }),
  updateNode: (id, patch) => set((state) => ({
    canvasNodes: state.canvasNodes.map((node) =>
      node.id === id ? { ...node, ...patch, config: { ...node.config, ...(patch.config || {}) } } : node
    )
  })),
  removeNode: (id) => set((state) => ({
    canvasNodes: state.canvasNodes.filter((node) => node.id !== id)
  })),
  setTiles: (tiles) => set({ tiles }),
}))
