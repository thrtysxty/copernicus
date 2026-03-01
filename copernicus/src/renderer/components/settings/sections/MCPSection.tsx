import React, { useState, useEffect } from 'react'
import { useIpcError } from '../../../hooks/useIpcError'
import { useToastStore } from '../../../store/toastStore'
import { Server, Plus, Trash2, Edit3, Globe, Terminal, Activity, Loader2 } from 'lucide-react'
import log from '../../../utils/logger'

interface MCPServer {
  id: string
  name: string
  transport: 'sse' | 'stdio'
  url?: string
  command?: string
  args?: string[]
}

export const MCPSection: React.FC = () => {
  const invoke = useIpcError()
  const addToast = useToastStore(s => s.addToast)
  
  const [servers, setServers] = useState<MCPServer[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Form State
  const [name, setName] = useState('')
  const [transport, setTransport] = useState<'sse' | 'stdio'>('sse')
  const [url, setUrl] = useState('')
  const [command, setCommand] = useState('')

  const fetchServers = async () => {
    try {
      const result = await invoke<MCPServer[]>('mcp:list-servers')
      const data = (result as any).data || result
      setServers(data || [])
    } catch (e) {
      log.error('Failed to fetch MCP servers', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchServers()
  }, [invoke])

  const handleSave = async (newServers: MCPServer[]) => {
    try {
      await invoke('mcp:save-servers', newServers)
      setServers(newServers)
      addToast('MCP configuration saved', 'success')
    } catch (e: any) {
      addToast(`Save failed: ${e.message}`, 'error')
    }
  }

  const handleAdd = () => {
    if (!name || (transport === 'sse' && !url) || (transport === 'stdio' && !command)) return
    const newServer: MCPServer = {
      id: `mcp-${Date.now()}`,
      name,
      transport,
      url: transport === 'sse' ? url : undefined,
      command: transport === 'stdio' ? command : undefined
    }
    handleSave([...servers, newServer])
    resetForm()
  }

  const handleUpdate = () => {
    if (!editingId) return
    const updated = servers.map(s => 
      s.id === editingId ? { 
        ...s, name, transport, 
        url: transport === 'sse' ? url : undefined,
        command: transport === 'stdio' ? command : undefined
      } : s
    )
    handleSave(updated)
    resetForm()
  }

  const handleDelete = (id: string) => {
    handleSave(servers.filter(s => s.id !== id))
  }

  const handleTest = async (server: MCPServer) => {
    setTestingId(server.id)
    try {
      const result = await invoke<{ ok: boolean; error?: string }>('mcp:test-server', server)
      const res = (result as any).data || result
      if (res.ok) {
        addToast(`${server.name} reachable`, 'success')
      } else {
        addToast(`Connection failed: ${res.error}`, 'error')
      }
    } catch (e: any) {
      addToast(`Test failed: ${e.message}`, 'error')
    } finally {
      setTestingId(null)
    }
  }

  const startEdit = (s: MCPServer) => {
    setEditingId(s.id)
    setName(s.name)
    setTransport(s.transport)
    setUrl(s.url || '')
    setCommand(s.command || '')
  }

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setTransport('sse')
    setUrl('')
    setCommand('')
  }

  if (loading) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-widest font-mono">MCP Servers</h2>
          <p className="text-[10px] text-zinc-500 font-mono mt-1">Model Context Protocol integration for external tools.</p>
        </div>
        {!editingId && (
          <button 
            onClick={() => setEditingId('new')}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] font-bold uppercase hover:border-copernicus-phosphor transition-colors font-mono"
          >
            <Plus size={12} /> Add Server
          </button>
        )}
      </div>

      {editingId && (
        <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[9px] text-zinc-500 uppercase font-bold">Server Name</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Brave Search"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono focus:border-copernicus-phosphor focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] text-zinc-500 uppercase font-bold">Transport Type</label>
              <div className="flex bg-zinc-950 border border-zinc-800 rounded p-1">
                {(['sse', 'stdio'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTransport(t)}
                    className={`flex-1 py-1 text-[9px] font-bold uppercase rounded transition-all ${transport === t ? 'bg-zinc-800 text-copernicus-phosphor' : 'text-zinc-500 hover:text-zinc-400'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {transport === 'sse' ? (
            <div className="space-y-1.5">
              <label className="text-[9px] text-zinc-500 uppercase font-bold">Server URL</label>
              <div className="flex gap-2">
                <div className="p-2 rounded bg-zinc-950 text-zinc-600 border border-zinc-800">
                  <Globe size={14} />
                </div>
                <input 
                  type="text" 
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="http://localhost:3001/sse"
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono focus:border-copernicus-phosphor focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-[9px] text-zinc-500 uppercase font-bold">Stdio Command</label>
              <div className="flex gap-2">
                <div className="p-2 rounded bg-zinc-950 text-zinc-600 border border-zinc-800">
                  <Terminal size={14} />
                </div>
                <input 
                  type="text" 
                  value={command}
                  onChange={e => setCommand(e.target.value)}
                  placeholder="npx -y @modelcontextprotocol/server-everything"
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono focus:border-copernicus-phosphor focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button 
              onClick={editingId === 'new' ? handleAdd : handleUpdate}
              className="flex-1 py-2 bg-copernicus-phosphor text-black rounded text-[10px] font-bold uppercase hover:bg-green-400 transition-colors font-mono"
            >
              {editingId === 'new' ? 'Add Server' : 'Update Server'}
            </button>
            <button 
              onClick={resetForm}
              className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-bold uppercase hover:bg-zinc-700 transition-colors text-zinc-400 font-mono"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {servers.map(s => (
          <div key={s.id} className="group bg-[#0F0F0F] border border-zinc-800 rounded-lg overflow-hidden transition-all hover:border-zinc-700">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded bg-zinc-900 ${s.transport === 'sse' ? 'text-blue-400' : 'text-purple-400'}`}>
                  {s.transport === 'sse' ? <Globe size={18} /> : <Terminal size={18} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-tight">{s.name}</h3>
                    <span className="text-[8px] px-1.5 py-0.5 rounded font-bold bg-zinc-900 border border-zinc-800 text-zinc-500 uppercase font-mono">
                      {s.transport}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-0.5 font-mono truncate max-w-sm">
                    {s.transport === 'sse' ? s.url : s.command}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button 
                  onClick={() => handleTest(s)}
                  disabled={testingId === s.id}
                  className="p-2 text-zinc-500 hover:text-copernicus-phosphor transition-colors disabled:opacity-50"
                  title="Test Connection"
                >
                  {testingId === s.id ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
                </button>
                <button 
                  onClick={() => startEdit(s)}
                  className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  title="Edit Server"
                >
                  <Edit3 size={14} />
                </button>
                <button 
                  onClick={() => handleDelete(s.id)}
                  className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                  title="Remove Server"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {servers.length === 0 && !editingId && (
          <div className="p-12 text-center border-2 border-dashed border-zinc-900 rounded-xl">
            <Server className="mx-auto text-zinc-800 mb-3" size={32} />
            <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest font-mono">No MCP servers configured</p>
          </div>
        )}
      </div>
    </div>
  )
}
