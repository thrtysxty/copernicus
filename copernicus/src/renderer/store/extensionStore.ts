import { create } from 'zustand'

interface ExtensionWorkflowNode { type: string; label: string; description?: string; defaultData?: Record<string, unknown> }
interface ExtensionTile { id: string; category: string; label: string; icon: string; defaultConfig: Record<string, string>; configSchema: Array<{ key: string; label: string; type: 'text' | 'select'; options?: string[] }> }
export interface ExtensionProvider { id: string; name: string; baseUrl: string }

interface ExtensionState {
  workflowNodes: ExtensionWorkflowNode[]
  tiles: ExtensionTile[]
  providers: ExtensionProvider[]
  setWorkflowNodes: (nodes: ExtensionWorkflowNode[]) => void
  setTiles: (tiles: ExtensionTile[]) => void
  setProviders: (providers: ExtensionProvider[]) => void
}

export const useExtensionStore = create<ExtensionState>((set) => ({
  workflowNodes: [],
  tiles: [],
  providers: [],
  setWorkflowNodes: (workflowNodes) => set({ workflowNodes }),
  setTiles: (tiles) => set({ tiles }),
  setProviders: (providers) => set({ providers }),
}))
