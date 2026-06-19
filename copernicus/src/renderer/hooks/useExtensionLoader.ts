import { useEffect } from 'react'
import { useIpcError } from './useIpcError'
import { unwrapIpc, IpcResult } from '../types/ipc'
import { useExtensionStore, ExtensionWorkflowNode, ExtensionTile, ExtensionProvider } from '../store/extensionStore'

export function useExtensionLoader() {
  const invoke = useIpcError()

  useEffect(() => {
    const loadExtensions = async () => {
      try {
        const [nodesRes, tilesRes, providersRes] = await Promise.all([
          invoke<IpcResult<ExtensionWorkflowNode[]>>('extensions:workflow-nodes'),
          invoke<IpcResult<ExtensionTile[]>>('extensions:tiles'),
          invoke<IpcResult<ExtensionProvider[]>>('extensions:providers'),
        ])
        const nodes = unwrapIpc<ExtensionWorkflowNode[]>(nodesRes) ?? []
        const tiles = unwrapIpc<ExtensionTile[]>(tilesRes) ?? []
        const providers = unwrapIpc<ExtensionProvider[]>(providersRes) ?? []
        useExtensionStore.getState().setWorkflowNodes(nodes)
        useExtensionStore.getState().setTiles(tiles)
        useExtensionStore.getState().setProviders(providers)
      } catch { /* no extensions installed — ignore */ }
    }
    loadExtensions()
  }, [invoke])
}
