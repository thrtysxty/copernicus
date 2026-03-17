import React, { useEffect, useState } from 'react'
import { useIpcError } from '../../../hooks/useIpcError'
import { unwrapIpc } from '../../../types/ipc'

interface ExtensionSummary {
  name: string
  path: string
  nodes: number
  tiles: number
  providers: number
}

export const ExtensionsSection: React.FC = () => {
  const invoke = useIpcError()
  const [extensions, setExtensions] = useState<ExtensionSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchExtensions = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await invoke('extensions:list')
      const data = unwrapIpc<any[]>(res as any) ?? []
      setExtensions(data.map((ext: any) => ({
        name: ext.name,
        path: ext.path,
        nodes: ext.workflowNodes.length,
        tiles: ext.tiles.length,
        providers: ext.providers.length,
      })))
    } catch (e: any) {
      setError(`Failed to load extensions: ${e.message || e}`)
    } finally {
      setLoading(false)
    }
  }

  const handleReload = async () => {
    setLoading(true)
    setError(null)
    try {
      await invoke('extensions:reload')
      await fetchExtensions()
    } catch (e: any) {
      setError(`Failed to reload extensions: ${e.message || e}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExtensions()
  }, [])

  return (
    <div className="flex flex-col h-full bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-[10px] text-zinc-300 font-mono">
      <h3 className="text-zinc-100 font-bold mb-4 uppercase tracking-wider">Extensions</h3>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        {loading && <p className="text-zinc-500">Loading extensions...</p>}
        {error && <p className="text-red-400">{error}</p>}
        {!loading && extensions.length === 0 && <p className="text-zinc-500">No extensions installed.</p>}

        {extensions.map((ext, index) => (
          <div key={index} className="mb-4 p-3 bg-zinc-800/50 rounded border border-zinc-700">
            <p className="text-copernicus-phosphor font-bold mb-1">{ext.name}</p>
            <p className="text-zinc-400 break-all">Path: {ext.path}</p>
            <p className="text-zinc-400">Workflow Nodes: {ext.nodes}</p>
            <p className="text-zinc-400">Orchestrator Tiles: {ext.tiles}</p>
            <p className="text-zinc-400">Providers: {ext.providers}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-zinc-800 pt-4 flex justify-end">
        <button
          onClick={handleReload}
          disabled={loading}
          className="px-4 py-2 bg-copernicus-phosphor text-[#050505] rounded-sm hover:bg-copernicus-phosphor/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Reloading...' : 'Reload Extensions'}
        </button>
      </div>
    </div>
  )
}
