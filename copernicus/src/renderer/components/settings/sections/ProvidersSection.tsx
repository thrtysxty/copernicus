import React, { useState, useEffect } from 'react'
import { useIpcError } from '../../../hooks/useIpcError'
import { useToastStore } from '../../../store/toastStore'
import { 
  Key, Globe, Cpu, RefreshCcw, LogOut, Plus, Trash2, 
  ShieldCheck, Loader2
} from 'lucide-react'

interface AuthStatus {
  provider: string
  hasKey: boolean
  source: 'env' | 'storage' | 'file' | 'none'
  baseUrl?: string
}

export const ProvidersSection: React.FC = () => {
  const invoke = useIpcError()
  const addToast = useToastStore(s => s.addToast)
  const [status, setStatus] = useState<AuthStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [authInProgress, setAuthInProgress] = useState<string | null>(null)

  // Custom provider state
  const [showAddCustom, setShowAddCustom] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customKey, setCustomKey] = useState('')
  const [customUrl, setCustomUrl] = useState('')

  const fetchStatus = async () => {
    try {
      const result = await invoke<AuthStatus[]>('auth:status')
      const data = (result as any).data || result
      if (Array.isArray(data)) setStatus(data)
    } catch (e) {
      console.error('Failed to fetch auth status', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    
    const remove = (window as any).ipcRenderer.on('oauth:callback', (_e: any, data: any) => {
      setAuthInProgress(null)
      if (data.ok) {
        addToast(`${data.provider} authenticated successfully`, 'success')
        fetchStatus()
      } else {
        addToast(`${data.provider} auth failed: ${data.error}`, 'error')
      }
    })
    
    return () => remove()
  }, [invoke, addToast])

  const handleOAuth = async (provider: string) => {
    setAuthInProgress(provider)
    try {
      const result = await invoke<any>(`oauth:start-${provider}`)
      const data = (result as any).data || result
      if (!data.ok) {
        setAuthInProgress(null)
        addToast(data.error || 'Auth failed', 'error')
      }
    } catch (e: any) {
      setAuthInProgress(null)
      addToast(e.message, 'error')
    }
  }

  const handleRevoke = async (provider: string) => {
    try {
      await invoke('auth:revoke', provider)
      addToast(`${provider} credentials revoked`, 'success')
      fetchStatus()
    } catch (e: any) {
      addToast(e.message, 'error')
    }
  }

  const handleAddCustom = async () => {
    if (!customName || !customKey) return
    try {
      await invoke('auth:store-api-key', customName, customKey, customUrl || undefined)
      addToast(`Custom provider ${customName} added`, 'success')
      setCustomName(''); setCustomKey(''); setCustomUrl('')
      setShowAddCustom(false)
      fetchStatus()
    } catch (e: any) {
      addToast(e.message, 'error')
    }
  }

  if (loading) return (
    <div className="flex items-center gap-2 text-zinc-500 font-mono text-[10px] animate-pulse">
      <Loader2 size={12} className="animate-spin" />
      LOADING_AUTH_REGISTRY...
    </div>
  )

  const providers = ['anthropic', 'openai', 'google', 'jules', 'openrouter', 'deepinfra', 'ollama']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-widest font-mono">AI Provider Registry</h2>
          <p className="text-[10px] text-zinc-500 font-mono mt-1">Manage API keys and local inference connectivity.</p>
        </div>
        <button 
          onClick={() => setShowAddCustom(!showAddCustom)}
          className={`flex items-center gap-2 px-3 py-1.5 border rounded text-[10px] font-bold uppercase transition-colors ${
            showAddCustom ? 'border-copernicus-phosphor text-copernicus-phosphor bg-copernicus-phosphor/5' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'
          }`}
        >
          {showAddCustom ? 'Cancel' : <><Plus size={12} /> Custom Provider</>}
        </button>
      </div>

      {showAddCustom && (
        <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[9px] text-zinc-500 uppercase font-bold">Provider Name</label>
              <input 
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                placeholder="e.g. local-llama"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono focus:border-copernicus-phosphor focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] text-zinc-500 uppercase font-bold">Base URL (Optional)</label>
              <input 
                value={customUrl}
                onChange={e => setCustomUrl(e.target.value)}
                placeholder="http://localhost:8080/v1"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono focus:border-copernicus-phosphor focus:outline-none"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-500 uppercase font-bold">API Key</label>
            <input 
              type="password"
              value={customKey}
              onChange={e => setCustomKey(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono focus:border-copernicus-phosphor focus:outline-none"
            />
          </div>
          <button 
            onClick={handleAddCustom}
            className="w-full py-2 bg-copernicus-phosphor text-black rounded text-[10px] font-bold uppercase hover:bg-green-400 transition-colors"
          >
            Add Custom Provider
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {providers.map(id => {
          const s = status.find(st => st.provider === id)
          const isOAuth = ['anthropic', 'google', 'openrouter'].includes(id)
          const isOllama = id === 'ollama'
          
          return (
            <div key={id} className="bg-[#0F0F0F] border border-zinc-800 rounded-lg p-4 flex items-center justify-between group hover:border-zinc-700 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded ${s?.hasKey ? 'bg-copernicus-phosphor/10 text-copernicus-phosphor' : 'bg-zinc-900 text-zinc-600'}`}>
                  {isOllama ? <Globe size={16} /> : <Key size={16} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">{id}</h3>
                    {s?.hasKey && (
                      <span className="text-[8px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <ShieldCheck size={8} className="text-copernicus-phosphor" />
                        {s.source.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate max-w-[300px]">
                    {s?.baseUrl || (isOllama ? 'http://localhost:11434' : 'Managed by system')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isOAuth && !s?.hasKey && (
                  <button
                    onClick={() => handleOAuth(id)}
                    disabled={authInProgress === id}
                    className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded text-[9px] font-bold uppercase text-zinc-400 hover:text-white hover:border-zinc-600 transition-all flex items-center gap-2"
                  >
                    {authInProgress === id ? <Loader2 size={10} className="animate-spin" /> : <RefreshCcw size={10} />}
                    Login with Browser
                  </button>
                )}
                
                {s?.hasKey ? (
                  <button
                    onClick={() => handleRevoke(id)}
                    className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded text-[9px] font-bold uppercase text-red-400/60 hover:text-red-400 hover:border-red-900/30 transition-all flex items-center gap-2"
                  >
                    <LogOut size={10} />
                    Revoke
                  </button>
                ) : !isOAuth && !isOllama && (
                  <div className="text-[9px] text-zinc-600 font-mono italic">Awaiting API Key</div>
                )}

                {isOllama && (
                  <div className={`px-2 py-0.5 rounded text-[9px] font-bold ${s?.hasKey ? 'bg-green-950 text-green-400' : 'bg-red-950 text-red-400'}`}>
                    {s?.hasKey ? 'DETECTED' : 'NOT_FOUND'}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Existing custom providers */}
        {status.filter(s => !providers.includes(s.provider)).map(s => (
          <div key={s.provider} className="bg-[#0F0F0F] border border-zinc-800 rounded-lg p-4 flex items-center justify-between group">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded bg-zinc-900 text-zinc-500">
                <Cpu size={16} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">{s.provider}</h3>
                <p className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate max-w-[300px]">
                  {s.baseUrl || 'No base URL'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRevoke(s.provider)}
                className="p-2 text-zinc-600 hover:text-red-400 transition-colors"
                title="Delete Provider"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
