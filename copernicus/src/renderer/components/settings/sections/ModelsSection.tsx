import React, { useState, useEffect } from 'react'
import { useIpcError } from '../../../hooks/useIpcError'
import { useToastStore } from '../../../store/toastStore'
import { MessageSquare, Code, Workflow, GripVertical, Info, Search } from 'lucide-react'
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
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

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

  const handleDragStart = (idx: number) => setDraggedIdx(idx)
  const handleDrop = async (idx: number) => {
    if (draggedIdx === null || draggedIdx === idx) {
      setDraggedIdx(null)
      setHoveredIdx(null)
      return
    }

    const newPriority = [...defaults.embeddingPriority]
    const [moved] = newPriority.splice(draggedIdx, 1)
    if (moved) {
      newPriority.splice(idx, 0, moved)
    }

    setDefaults(prev => ({ ...prev, embeddingPriority: newPriority }))
    setDraggedIdx(null)
    setHoveredIdx(null)

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
            <div 
              key={p} 
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => { e.preventDefault(); setHoveredIdx(i) }}
              onDragLeave={() => setHoveredIdx(null)}
              onDrop={() => handleDrop(i)}
              className={`flex items-center justify-between p-3 bg-zinc-900/30 border rounded-lg group transition-colors cursor-default ${
                draggedIdx === i ? 'opacity-50 border-zinc-700' : 'border-zinc-800'
              } ${hoveredIdx === i && draggedIdx !== i ? 'border-t-2 border-t-copernicus-phosphor' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className="text-zinc-700 group-hover:text-zinc-500 cursor-grab active:cursor-grabbing">
                  <GripVertical size={14} />
                </div>
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-tighter">{p}</span>
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
