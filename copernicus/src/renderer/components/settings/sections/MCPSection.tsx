import React, { useState, useEffect } from 'react'
import { Trash2, AlertCircle, Plus, X, Server } from 'lucide-react'
import { useIpcError } from '../../../hooks/useIpcError'
import { SettingsLoadResponse } from '../../../types/ipc'

interface McpServer { 
  name: string; 
  transport: 'stdio' | 'sse' | 'http'; 
  command?: string; 
  args?: string[]; 
  url?: string 
}

export const MCPSection: React.FC = () => {
  const invoke = useIpcError()
  const [mcpServers, setMcpServers] = useState<McpServer[]>([])
  const [mcpStatus, setMcpStatus] = useState<Record<string, 'connected' | 'disconnected' | 'error'>>({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [newServer, setNewServer] = useState<McpServer>({ name: '', transport: 'stdio' })
  const [isLoading, setIsLoading] = useState(true)

  const [stitchProjectId, setStitchProjectId] = useState('')
  const [stitchApiKey, setStitchApiKey] = useState('')
  const [stitchStatus, setStitchStatus] = useState<'none' | 'success' | 'auth_failed' | 'error'>('none')
  const [isStitchTesting, setIsStitchTesting] = useState(false)


  const loadSettings = async () => {
    try {
      const result = await invoke<SettingsLoadResponse>('settings:load')

      setMcpServers((result?.mcp as any)?.servers ?? [])
      setStitchProjectId((result?.mcp as any)?.stitchProjectId ?? '')
      const storedKey = await invoke<string | null>('auth:get-api-key', 'stitch')
      setStitchApiKey(storedKey ?? '')

      
      const statuses = await invoke<Array<{name:string;status:'connected' | 'disconnected' | 'error'}>>('mcp:get-status')
      const map: Record<string, 'connected' | 'disconnected' | 'error'> = {}
      if (Array.isArray(statuses)) {
        statuses.forEach(s => { map[s.name] = s.status })
      }
      setMcpStatus(map)
    } catch (err) {
      console.error('Failed to load MCP settings:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const saveMcpServers = async (servers: McpServer[]) => {
    const current = await invoke<SettingsLoadResponse>('settings:load')
    await invoke('settings:save', { ...current, mcp: { servers } })
    setMcpServers(servers)
    
    // Refresh status after save
    const statuses = await invoke<Array<{name:string;status:'connected' | 'disconnected' | 'error'}>>('mcp:get-status')
    const map: Record<string, 'connected' | 'disconnected' | 'error'> = {}
    if (Array.isArray(statuses)) {
      statuses.forEach(s => { map[s.name] = s.status })
    }
    setMcpStatus(map)
  }


  const saveStitchProject = async (id: string) => {
    setStitchProjectId(id)
    const current = await invoke<SettingsLoadResponse>('settings:load')
    await invoke('settings:save', { ...current, mcp: { ...(current.mcp as any), stitchProjectId: id } })
  }

  const saveStitchApiKey = async (key: string) => {
    setStitchApiKey(key)
    if (key.trim()) {
      await invoke('auth:store-api-key', 'stitch', key.trim())
    }
  }

  const testStitchConnection = async () => {
    if (!stitchProjectId) return
    setIsStitchTesting(true)
    setStitchStatus('none')
    try {
      const res = await invoke<{ok: boolean, error?: string}>('stitch:ping', stitchProjectId)
      if (res.ok) {
        setStitchStatus('success')
      } else {
        if (res.error?.includes('auth') || res.error?.includes('credentials')) {
          setStitchStatus('auth_failed')
        } else {
          setStitchStatus('error')
        }
      }
    } catch (err) {
      setStitchStatus('error')
    } finally {
      setIsStitchTesting(false)
    }
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

  const allDisconnected = mcpServers.length > 0 && Object.values(mcpStatus ?? {}).every(s => s === 'disconnected')

  if (isLoading) {
    return <div className="text-[10px] text-zinc-500 font-mono animate-pulse">Initializing MCP Configuration...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
          <Server size={14} className="text-copernicus-phosphor" />
          MCP Servers
        </div>
        {!showAddForm && (
          <button 
            onClick={() => setShowAddForm(true)} 
            className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-copernicus-phosphor hover:bg-copernicus-phosphor/10 px-2 py-1 rounded border border-copernicus-phosphor/20 transition-all"
          >
            <Plus size={12} />
            Add Server
          </button>
        )}
      </div>

      <div className="space-y-3">
        {mcpServers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 border border-dashed border-zinc-800 rounded-lg bg-zinc-900/10">
            <Server size={24} className="text-zinc-700 mb-2 opacity-20" />
            <p className="text-[10px] text-zinc-500 font-mono">No MCP servers configured.</p>
          </div>
        ) : (
          mcpServers.map((s, i) => (
            <div key={i} className="group flex items-center justify-between p-3 bg-zinc-900/30 border border-zinc-800 hover:border-zinc-700 transition-colors rounded-none">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className={`w-2 h-2 rounded-full ${
                    mcpStatus[s.name] === 'connected' 
                      ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' 
                      : mcpStatus[s.name] === 'error' 
                        ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' 
                        : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                  }`} />
                </div>
                
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-zinc-200 font-mono tracking-tight">{s.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded-sm text-zinc-400 font-mono uppercase">
                      {s.transport}
                    </span>
                  </div>
                  <div className="text-[9px] text-zinc-500 font-mono truncate max-w-[400px]">
                    {s.transport === 'stdio' ? `${s.command} ${(s.args || []).join(' ')}` : s.url}
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => removeMcpServer(i)} 
                className="opacity-0 group-hover:opacity-100 p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-all"
                title="Remove Server"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>


      {allDisconnected && (
        <div className="flex items-start gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-none animate-in fade-in slide-in-from-top-1 duration-300">
          <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-[10px] text-amber-200/80 font-mono uppercase tracking-wider font-bold">Connection status unavailable</p>
            <p className="text-[9px] text-amber-500/60 leading-relaxed font-mono">The MCP runtime is currently initializing or unavailable. Status indicators may not reflect real-time connectivity.</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <Server size={14} className="text-copernicus-phosphor" />
            Google Stitch MCP
          </div>
        </div>

        <div className="bg-[#0F0F0F] border border-zinc-800 rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full flex-none ${
              stitchStatus === 'success' ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.4)]' :
              stitchStatus === 'auth_failed' ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]' :
              stitchStatus === 'error' ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.4)]' :
              'bg-zinc-600'
            }`} title={
              stitchStatus === 'success' ? 'Connected successfully' :
              stitchStatus === 'auth_failed' ? 'gcloud not authenticated' :
              stitchStatus === 'error' ? 'Project not set / API not enabled' :
              'Not tested'
            } />
            <div className="flex-1 space-y-3">
              <div>
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest ml-1 block mb-1">Google Cloud Project ID</label>
                <input
                  placeholder="e.g. my-design-project-123"
                  value={stitchProjectId}
                  onChange={e => saveStitchProject(e.target.value)}
                  className="w-full bg-black/40 border border-zinc-800 rounded-none px-3 py-2 text-[10px] text-zinc-200 outline-none focus:border-copernicus-phosphor/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest ml-1 block mb-1">Stitch API Key <span className="normal-case text-zinc-600">(optional — skips gcloud auth)</span></label>
                <input
                  type="password"
                  placeholder="Paste key from stitch.withgoogle.com → Settings"
                  value={stitchApiKey}
                  onChange={e => saveStitchApiKey(e.target.value)}
                  className="w-full bg-black/40 border border-zinc-800 rounded-none px-3 py-2 text-[10px] text-zinc-200 outline-none focus:border-copernicus-phosphor/50 transition-colors"
                />
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={testStitchConnection}
                disabled={isStitchTesting || !stitchProjectId}
                className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-none text-[9px] font-bold uppercase text-zinc-400 hover:text-white hover:border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
              >
                {isStitchTesting ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Server form */}

      {showAddForm && (
        <div className="space-y-4 p-4 bg-zinc-900/50 border border-zinc-700 rounded-none animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">Configure New Server</div>
            <button onClick={() => setShowAddForm(false)} className="text-zinc-500 hover:text-white">
              <X size={14} />
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Server Name</label>
              <input 
                placeholder="e.g. Memory Server" 
                value={newServer.name} 
                onChange={e => setNewServer(p => ({...p, name: e.target.value}))} 
                className="w-full bg-black/40 border border-zinc-800 rounded-none px-3 py-2 text-[10px] text-zinc-200 outline-none focus:border-copernicus-phosphor/50 transition-colors" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Transport Type</label>
              <select 
                value={newServer.transport} 
                onChange={e => setNewServer(p => ({...p, transport: e.target.value as 'stdio' | 'sse' | 'http'}))} 
                className="w-full bg-black/40 border border-zinc-800 rounded-none px-3 py-2 text-[10px] text-zinc-200 outline-none focus:border-copernicus-phosphor/50 appearance-none transition-colors cursor-pointer"
              >
                <option value="stdio">stdio (Local Process)</option>
                <option value="sse">sse (Server-Sent Events)</option>
                <option value="http">http (Standard REST)</option>
              </select>
            </div>
          </div>

          {newServer.transport === 'stdio' ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Executable Command</label>
                <input 
                  placeholder="e.g. node, python, /usr/bin/custom-server" 
                  value={newServer.command || ''} 
                  onChange={e => setNewServer(p => ({...p, command: e.target.value}))} 
                  className="w-full bg-black/40 border border-zinc-800 rounded-none px-3 py-2 text-[10px] text-zinc-200 outline-none focus:border-copernicus-phosphor/50 transition-colors" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Arguments</label>
                <input 
                  placeholder="e.g. ./path/to/server.js --option value" 
                  value={(newServer.args || []).join(' ')} 
                  onChange={e => setNewServer(p => ({...p, args: e.target.value.split(' ').filter(Boolean)}))} 
                  className="w-full bg-black/40 border border-zinc-800 rounded-none px-3 py-2 text-[10px] text-zinc-200 outline-none focus:border-copernicus-phosphor/50 transition-colors" 
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Server URL</label>
              <input 
                placeholder="e.g. http://localhost:3001/mcp" 
                value={newServer.url || ''} 
                onChange={e => setNewServer(p => ({...p, url: e.target.value}))} 
                className="w-full bg-black/40 border border-zinc-800 rounded-none px-3 py-2 text-[10px] text-zinc-200 outline-none focus:border-copernicus-phosphor/50 transition-colors" 
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button 
              onClick={addMcpServer} 
              disabled={!newServer.name || (newServer.transport === 'stdio' ? !newServer.command : !newServer.url)}
              className="text-[10px] font-bold uppercase tracking-widest px-6 py-2 bg-copernicus-phosphor text-[#050505] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-copernicus-phosphor/90 transition-all rounded-none"
            >
              Add Server
            </button>
            <button 
              onClick={() => setShowAddForm(false)} 
              className="text-[10px] font-bold uppercase tracking-widest px-4 py-2 text-zinc-500 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
