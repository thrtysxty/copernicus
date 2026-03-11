import React, { useState, useEffect } from 'react'
import { useIpcError } from '../../../hooks/useIpcError'
import { useToastStore } from '../../../store/toastStore'
import { MessageSquare, Code, Workflow, ChevronUp, ChevronDown, Info, Search } from 'lucide-react'
import { SettingsLoadResponse } from '../../../types/ipc'
import log from '../../../utils/logger'

interface Model {
  id: string
  name: string
  provider: string
  contextWindow: number
}

interface ModelOption {
  label: string
  value: string
}

interface AuthStatus {
  provider: string
  hasKey: boolean
}

const EMBEDDING_PROVIDERS = [
  { provider: 'openai',     model: 'text-embedding-3-small', note: 'Also: text-embedding-3-large, ada-002' },
  { provider: 'google',     model: 'text-embedding-004', note: '' },
  { provider: 'ollama',     model: 'nomic-embed-text', note: 'Local — requires nomic-embed-text pulled' },
  { provider: 'openrouter', model: 'openai/text-embedding-3-small', note: '' },
  { provider: 'deepinfra',  model: 'BAAI/bge-large-en-v1.5', note: '' },
]

interface PanelDefaults {
  chat: string
  workflow: string
  code: string
  embeddingProvider?: string
  embeddingPriority: string[]
}

export const ModelsSection: React.FC = () => {
  const invoke = useIpcError()
  const addToast = useToastStore(s => s.addToast)
  const [options, setOptions] = useState<ModelOption[]>([])
  const [authStatus, setAuthStatus] = useState<AuthStatus[]>([])
  const [defaults, setDefaults] = useState<PanelDefaults>({
    chat: '',
    workflow: '',
    code: '',
    embeddingProvider: 'openai:text-embedding-3-small',
    embeddingPriority: ['openai', 'anthropic', 'google']
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadData = async () => {
    setLoading(true)
    setError(false)
    try {
      const [mCloud, mOllama, s, auth] = await Promise.all([
        invoke<Model[]>('models:list'),
        invoke<{ ok: boolean, models: Model[] }>('models:list-ollama'),
        invoke<SettingsLoadResponse>('settings:load'),
        invoke<AuthStatus[]>('auth:status')
      ])

      if (Array.isArray(auth)) setAuthStatus(auth)

      const allModels: Model[] = []
      if (Array.isArray(mCloud)) allModels.push(...mCloud)
      if (mOllama?.ok && Array.isArray(mOllama.models)) allModels.push(...mOllama.models)

      const opts = allModels.map(m => ({
        label: `${m.provider.toUpperCase()} — ${m.name || m.id}`,
        value: `${m.provider}:${m.id}`
      }))
      setOptions(opts)

      if (s?.modelDefaults) {
        setDefaults(prev => ({
          ...prev,
          ...(s.modelDefaults as any)
        }))
      }
    } catch (e) {
      log.error('Failed to load models/settings', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [invoke])

  const handleSetDefault = async (role: string, value: string) => {
    setDefaults(prev => ({ ...prev, [role]: value }))
    try {
      await invoke('models:set-default', { role, value })
      addToast(`Default ${role} updated`, 'success')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      addToast(`Save failed: ${message}`, 'error')
    }
  }

  const movePriority = async (index: number, direction: 'up' | 'down') => {
    const newPriority = [...defaults.embeddingPriority]
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= newPriority.length) return
    
    const temp = newPriority[index]
    if (temp !== undefined && newPriority[target] !== undefined) {
      newPriority[index] = newPriority[target]!
      newPriority[target] = temp
    }
    
    setDefaults(prev => ({ ...prev, embeddingPriority: newPriority }))
    try {
      await invoke('settings:save', { modelDefaults: { ...defaults, embeddingPriority: newPriority } })
      addToast('Embedding priority updated', 'success')
    } catch (e) {
      addToast('Failed to save priority', 'error')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="w-8 h-8 border-2 border-copernicus-phosphor border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs font-mono text-zinc-500">Loading intelligence engines...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <span className="text-xs font-mono text-red-500">Failed to load models</span>
        <button 
          onClick={loadData}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs rounded transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  const availableEmbeddings = EMBEDDING_PROVIDERS.filter(p => {
    const s = authStatus.find(as => as.provider === p.provider)
    return s?.hasKey || p.provider === 'ollama'
  })

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-widest font-mono">Model Configuration</h2>
        <p className="text-[10px] text-zinc-500 font-mono mt-1">Set default intelligence engines for different IDE functions.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <ModelSelector 
          label="Architect / Planning" 
          icon={MessageSquare} 
          value={defaults.chat}
          options={options}
          onChange={(v: string) => handleSetDefault('chat', v)}
        />
        <ModelSelector 
          label="Coding Assistant" 
          icon={Code} 
          value={defaults.code}
          options={options}
          onChange={(v: string) => handleSetDefault('code', v)}
        />
        <ModelSelector 
          label="Workflow Agent" 
          icon={Workflow} 
          value={defaults.workflow}
          options={options}
          onChange={(v: string) => handleSetDefault('workflow', v)}
        />
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <h3 className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Embedding Engine</h3>
          <span className="text-[9px] text-zinc-600 font-mono italic">Source for codebase semantic indexing</span>
        </div>
        
        <div className="flex items-center justify-between p-4 bg-[#0F0F0F] border border-zinc-800 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-zinc-900 text-zinc-400">
              <Search size={16} />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-zinc-200 uppercase tracking-tight">Primary Embedding Model</span>
              {defaults.embeddingProvider?.startsWith('openai') && (
                <div className="flex items-center gap-1 mt-0.5 text-zinc-500">
                  <Info size={10} />
                  <span className="text-[9px]">Multiple models available via OpenAI</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select 
              value={defaults.embeddingProvider}
              onChange={(e) => handleSetDefault('embeddingProvider', e.target.value)}
              className="bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 rounded px-3 py-1.5 focus:outline-none focus:border-copernicus-phosphor transition-colors min-w-[240px]"
            >
              {availableEmbeddings.map((p) => (
                <option key={`${p.provider}:${p.model}`} value={`${p.provider}:${p.model}`}>
                  {p.provider.toUpperCase()} — {p.model}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <h3 className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Embedding Priority</h3>
          <span className="text-[9px] text-zinc-600 font-mono italic">Used for semantic search & indexing</span>
        </div>
        <div className="space-y-2">
          {defaults.embeddingPriority.map((p, i) => (
            <div key={p} className="flex items-center justify-between p-3 bg-zinc-900/30 border border-zinc-800 rounded-lg group">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-zinc-600">{i + 1}.</span>
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-tighter">{p}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => movePriority(i, 'up')}
                  disabled={i === 0}
                  className="p-1.5 hover:text-copernicus-phosphor disabled:text-zinc-800 transition-colors"
                >
                  <ChevronUp size={14} />
                </button>
                <button 
                  onClick={() => movePriority(i, 'down')}
                  disabled={i === defaults.embeddingPriority.length - 1}
                  className="p-1.5 hover:text-copernicus-phosphor disabled:text-zinc-800 transition-colors"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

const ModelSelector = ({ label, icon: Icon, value, options, onChange }: {
  label: string;
  icon: React.ElementType;
  value: string;
  options: ModelOption[];
  onChange: (v: string) => void;
}) => (
  <div className="flex items-center justify-between p-4 bg-[#0F0F0F] border border-zinc-800 rounded-lg">
    <div className="flex items-center gap-3">
      <div className="p-2 rounded bg-zinc-900 text-zinc-400">
        <Icon size={16} />
      </div>
      <span className="text-[11px] font-bold text-zinc-200 uppercase tracking-tight">{label}</span>
    </div>
    <select 
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 rounded px-3 py-1.5 focus:outline-none focus:border-copernicus-phosphor transition-colors min-w-[240px]"
    >
      <option value="">Auto-detect (System Default)</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
)
