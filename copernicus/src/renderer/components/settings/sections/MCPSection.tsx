import React, { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import { useIpcError } from '../../../hooks/useIpcError'
import { unwrapIpc } from '../../../types/ipc'

interface McpServer { name: string; transport: 'stdio' | 'sse' | 'http'; command?: string; args?: string[]; url?: string }

export const MCPSection: React.FC = () => {
  const invoke = useIpcError()
  const [mcpServers, setMcpServers] = useState<McpServer[]>([])
  const [mcpStatus, setMcpStatus] = useState<Record<string, string>>({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [newServer, setNewServer] = useState<McpServer>({ name: '', transport: 'stdio' })

  useEffect(() => {
    invoke<any>('settings:load').then((r: any) => {
      const s = unwrapIpc<any>(r)
      setMcpServers(s?.mcp?.servers ?? [])
    }).catch(() => {})
    invoke<any>('mcp:get-status').then((r: any) => {
      const statuses = unwrapIpc<Array<{name:string;status:string}>>(r) ?? []
      const map: Record<string,string> = {}
      statuses.forEach(s => { map[s.name] = s.status })
      setMcpStatus(map)
    }).catch(() => {}) // non-fatal if MCP runtime not ready
  }, [invoke])

  const saveMcpServers = async (servers: McpServer[]) => {
    const current = await invoke<any>('settings:load').then((r: any) => unwrapIpc<any>(r) ?? {})
    await invoke('settings:save', { ...current, mcp: { servers } })
    setMcpServers(servers)
  }

  const addMcpServer = async () => {
    if (!newServer.name) return
    if (newServer.transport === 'stdio' && !newServer.command) return
    if (newServer.transport !== 'stdio' && !newServer.url) return
    await saveMcpServers([...mcpServers, newServer])
    setNewServer({ name: '', transport: 'stdio' })
    setShowAddForm(false)
  }

  const removeMcpServer = async (idx: number) => {
    await saveMcpServers(mcpServers.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-4">
      <div className="text-[10px] text-zinc-500 uppercase tracking-widest">MCP Servers</div>
      {mcpServers.length === 0 ? (
        <p className="text-[10px] text-zinc-600">No MCP servers configured.</p>
      ) : (
        mcpServers.map((s, i) => (
          <div key={i} className="flex items-center justify-between p-2 bg-black/30 border border-zinc-800 rounded">
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${mcpStatus[s.name] === 'connected' ? 'bg-green-500' : mcpStatus[s.name] === 'error' ? 'bg-red-500' : 'bg-amber-500'}`} />
              <span className="text-[10px] font-mono text-zinc-300">{s.name}</span>
              <span className="text-[9px] px-1 border border-zinc-700 rounded text-zinc-500">{s.transport}</span>
            </div>
            <button onClick={() => removeMcpServer(i)} className="text-zinc-600 hover:text-red-400">
              <Trash2 size={12} />
            </button>
          </div>
        ))
      )}
      {/* Add Server form */}
      {!showAddForm ? (
        <button onClick={() => setShowAddForm(true)} className="text-[9px] text-copernicus-phosphor border border-copernicus-phosphor/30 px-2 py-1 rounded hover:bg-copernicus-phosphor/10">
          + Add Server
        </button>
      ) : (
        <div className="space-y-2 p-3 bg-black/30 border border-zinc-800 rounded">
          <input placeholder="Name" value={newServer.name} onChange={e => setNewServer(p => ({...p, name: e.target.value}))} className="w-full bg-transparent border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-300 outline-none focus:border-copernicus-phosphor/50" />
          <select value={newServer.transport} onChange={e => setNewServer(p => ({...p, transport: e.target.value as any}))} className="w-full bg-black/40 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-300">
            <option value="stdio">stdio</option>
            <option value="sse">sse</option>
            <option value="http">http</option>
          </select>
          {newServer.transport === 'stdio' && <>
            <input placeholder="Command" value={newServer.command || ''} onChange={e => setNewServer(p => ({...p, command: e.target.value}))} className="w-full bg-transparent border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-300 outline-none focus:border-copernicus-phosphor/50" />
            <input placeholder="Args (space-separated)" value={(newServer.args || []).join(' ')} onChange={e => setNewServer(p => ({...p, args: e.target.value.split(' ').filter(Boolean)}))} className="w-full bg-transparent border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-300 outline-none" />
          </>}
          {newServer.transport !== 'stdio' && (
            <input placeholder="URL" value={newServer.url || ''} onChange={e => setNewServer(p => ({...p, url: e.target.value}))} className="w-full bg-transparent border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-300 outline-none focus:border-copernicus-phosphor/50" />
          )}
          <div className="flex gap-2">
            <button onClick={addMcpServer} className="text-[9px] px-3 py-1 bg-copernicus-phosphor/10 text-copernicus-phosphor border border-copernicus-phosphor/30 rounded">Add Server</button>
            <button onClick={() => setShowAddForm(false)} className="text-[9px] text-zinc-600 hover:text-zinc-400">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
