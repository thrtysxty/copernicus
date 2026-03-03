import React, { useState, useEffect } from 'react'
import { useIpcError } from '../../../hooks/useIpcError'
import { useToastStore } from '../../../store/toastStore'
import {
  Key, Globe, Cpu, RefreshCcw, LogOut, Plus, Trash2,
  ShieldCheck, Loader2, GripVertical, Zap, Check
} from 'lucide-react'
import log from '../../../utils/logger'
import { unwrapIpc } from '../../../types/ipc'

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
  const [providers, setProviders] = useState<string[]>(['anthropic', 'openai', 'google', 'jules', 'openrouter', 'deepinfra', 'ollama'])
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [keyDraft, setKeyDraft] = useState<Record<string, string>>({})
  const [baseUrlDraft, setBaseUrlDraft] = useState<Record<string, string>>({})
  const [authFailed, setAuthFailed] = useState<Set<string>>(new Set())
  const [claudeCliAvailable, setClaudeCliAvailable] = useState(false)
  const [anthropicMethod, setAnthropicMethod] = useState<'cli' | 'apikey' | null>(null)

  // Custom provider state
  const [showAddCustom, setShowAddCustom] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customKey, setCustomKey] = useState('')
  const [customUrl, setCustomUrl] = useState('')

  const fetchStatus = async () => {
    try {
      const result = await invoke<AuthStatus[]>('auth:status')
      const data = (result as any).data || result
      if (Array.isArray(data)) {
        setStatus(data)
        const urls: Record<string, string> = {}
        data.forEach((s: any) => {
          if (s.baseUrl) urls[s.provider] = s.baseUrl
          if (s.provider === 'anthropic' && s.type === 'cli') setAnthropicMethod('cli')
          else if (s.provider === 'anthropic' && s.hasKey) setAnthropicMethod('apikey')
        })
        setBaseUrlDraft(prev => ({ ...urls, ...prev }))
      }

      // Check Claude CLI availability
      const cliResult = await invoke<any>('check-cli-tools')
      const cliData = unwrapIpc<any>(cliResult)
      setClaudeCliAvailable(!!cliData?.claude)

      const settings = await invoke<any>('settings:load')
      const savedOrder = (settings as any).data?.providerOrder || settings?.providerOrder
      if (savedOrder && Array.isArray(savedOrder)) setProviders(savedOrder)
    } catch (e) {
      log.error('Failed to fetch auth status', e)
    } finally {
      setLoading(false)
    }
  }

  const setAnthropicCli = async () => {
    try {
      await invoke('auth:store-api-key', 'anthropic', '__cli__', undefined, 'cli')
      setAnthropicMethod('cli')
      addToast('Anthropic: using Claude Code CLI', 'success')
      fetchStatus()
    } catch (e: any) { addToast(e.message, 'error') }
  }

  const saveKey = async (id: string) => {
    const key = keyDraft[id]?.trim()
    if (!key) return
    try {
      await invoke('auth:store-api-key', id, key, baseUrlDraft[id] || undefined)
      setKeyDraft(prev => ({ ...prev, [id]: '' }))
      addToast(`${id} API key saved`, 'success')
      fetchStatus()
    } catch (e: any) {
      addToast(e.message, 'error')
    }
  }

  const saveBaseUrl = async (id: string) => {
    const url = baseUrlDraft[id]?.trim()
    if (!url) return
    try {
      await invoke('auth:store-api-key', id, keyDraft[id] || '', url)
      addToast(`${id} base URL updated`, 'success')
      fetchStatus()
    } catch (e: any) {
      addToast(e.message, 'error')
    }
  }

  useEffect(() => {
    fetchStatus()
    
    const remove = (window as any).ipcRenderer.on('oauth:callback', (_e: any, data: any) => {
      setAuthInProgress(null)
      if (data.ok) {
        setAuthFailed(prev => { const n = new Set(prev); n.delete(data.provider); return n })
        addToast(`${data.provider} authenticated successfully`, 'success')
        fetchStatus()
      } else {
        setAuthFailed(prev => new Set([...prev, data.provider]))
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
      setKeyDraft(prev => ({ ...prev, [provider]: '' }))
      setAuthFailed(prev => { const n = new Set(prev); n.delete(provider); return n })
      addToast('Provider access revoked', 'success')
      fetchStatus()
    } catch (e: any) {
      addToast(e.message, 'error')
    }
  }

  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx)
  }

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (draggedIdx === null || draggedIdx === idx) return
    
    const newProviders = [...providers]
    const item = newProviders.splice(draggedIdx, 1)[0]
    newProviders.splice(idx, 0, item)
    setProviders(newProviders)
    setDraggedIdx(idx)
  }

  const handleDragEnd = async () => {
    setDraggedIdx(null)
    try {
      await invoke('settings:save', { providerOrder: providers })
      addToast('Provider priority updated', 'success')
    } catch (e: any) {
      addToast('Failed to save provider order', 'error')
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
        {providers.map((id, idx) => {
          const s = status.find(st => st.provider === id)
          const isOAuth = ['google', 'openrouter'].includes(id)
          const isOllama = id === 'ollama'
          
          return (
            <div
              key={id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              className={`bg-[#0F0F0F] border border-zinc-800 rounded-lg p-4 group hover:border-zinc-700 transition-colors cursor-default ${draggedIdx === idx ? 'opacity-50 border-copernicus-phosphor' : ''}`}
            >
              {/* Top row: grip + status + name + buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-zinc-700 group-hover:text-zinc-500 cursor-grab active:cursor-grabbing">
                    <GripVertical size={14} />
                  </div>
                  {/* 3-state status dot */}
                  <div className={`w-2 h-2 rounded-full flex-none ${
                    authFailed.has(id) ? 'bg-red-400' :
                    s?.hasKey ? 'bg-green-400' :
                    'bg-amber-400'
                  }`} title={authFailed.has(id) ? 'Auth failed' : s?.hasKey ? 'Authenticated' : 'No key'} />
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

                  {s?.hasKey && (
                    <button
                      onClick={() => handleRevoke(id)}
                      className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded text-[9px] font-bold uppercase text-red-400/60 hover:text-red-400 hover:border-red-900/30 transition-all flex items-center gap-2"
                    >
                      <LogOut size={10} />
                      Revoke
                    </button>
                  )}

                  {isOllama && (
                    <div className={`px-2 py-0.5 rounded text-[9px] font-bold ${s?.hasKey ? 'bg-green-950 text-green-400' : 'bg-red-950 text-red-400'}`}>
                      {s?.hasKey ? 'DETECTED' : 'NOT_FOUND'}
                    </div>
                  )}
                </div>
              </div>

              {/* Anthropic: CLI toggle */}
              {id === 'anthropic' && (
                <div className="mt-3 pt-3 border-t border-zinc-800/50 space-y-2">
                  <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">Connection Method</p>
                  <div className="flex gap-2">
                    <button
                      onClick={setAnthropicCli}
                      disabled={!claudeCliAvailable}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[9px] font-bold uppercase border transition-all ${
                        anthropicMethod === 'cli'
                          ? 'border-copernicus-phosphor bg-copernicus-phosphor/10 text-copernicus-phosphor'
                          : claudeCliAvailable
                            ? 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                            : 'border-zinc-800 text-zinc-700 cursor-not-allowed'
                      }`}
                      title={claudeCliAvailable ? 'Use Claude Code CLI session' : 'Claude CLI not found'}
                    >
                      <Zap size={9} />
                      Claude Code CLI
                      {anthropicMethod === 'cli' && <Check size={9} />}
                      {!claudeCliAvailable && <span className="ml-1">(not found)</span>}
                    </button>
                    <button
                      onClick={() => setAnthropicMethod('apikey')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[9px] font-bold uppercase border transition-all ${
                        anthropicMethod === 'apikey'
                          ? 'border-copernicus-phosphor bg-copernicus-phosphor/10 text-copernicus-phosphor'
                          : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                      }`}
                    >
                      <Key size={9} />
                      API Key
                      {anthropicMethod === 'apikey' && <Check size={9} />}
                    </button>
                  </div>
                  {!claudeCliAvailable && (
                    <p className="text-[9px] text-zinc-600">
                      Install{' '}
                      <button onClick={() => (window as any).ipcRenderer.invoke('app:open-external', 'https://claude.ai/download')} className="text-copernicus-phosphor hover:underline">
                        Claude Code
                      </button>
                      {' '}then run <code className="text-zinc-400">claude login</code> to enable CLI mode.
                    </p>
                  )}
                </div>
              )}
              {/* Input row: API key + base URL */}
              <div className="mt-3 pt-3 border-t border-zinc-800/50 grid gap-2" style={{ gridTemplateColumns: isOllama ? '1fr' : (id === 'openrouter' || isOllama ? '1fr 1fr' : '1fr') }}>
                {!isOllama && (
                  <input
                    type="password"
                    value={keyDraft[id] ?? ''}
                    onChange={e => setKeyDraft(prev => ({ ...prev, [id]: e.target.value }))}
                    onBlur={() => saveKey(id)}
                    placeholder={s?.hasKey ? 'API key stored — paste to replace' : 'Paste API key…'}
                    className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[10px] font-mono focus:border-copernicus-phosphor focus:outline-none w-full"
                  />
                )}
                {(isOllama || id === 'openrouter') && (
                  <input
                    type="text"
                    value={baseUrlDraft[id] ?? ''}
                    onChange={e => setBaseUrlDraft(prev => ({ ...prev, [id]: e.target.value }))}
                    onBlur={() => saveBaseUrl(id)}
                    placeholder={isOllama ? 'http://localhost:11434' : 'https://openrouter.ai/api/v1'}
                    className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[10px] font-mono focus:border-copernicus-phosphor focus:outline-none w-full"
                  />
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
