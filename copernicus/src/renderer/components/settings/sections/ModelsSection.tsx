import React, { useState, useEffect } from 'react'
import { useIpcError } from '../../../hooks/useIpcError'
import { useToastStore } from '../../../store/toastStore'
import { MessageSquare, Code, Workflow, ChevronUp, ChevronDown } from 'lucide-react'
import log from '../../../utils/logger'

interface Model {
  id: string
  name: string
  provider: string
  contextWindow: number
}

interface PanelDefaults {
  chat: string
  workflow: string
  code: string
  embeddingPriority: string[]
}

export const ModelsSection: React.FC = () => {
  const invoke = useIpcError()
  const addToast = useToastStore(s => s.addToast)
  const [models, setModels] = useState<Model[]>([])
  const [defaults, setDefaults] = useState<PanelDefaults>({
    chat: '',
    workflow: '',
    code: '',
    embeddingPriority: ['openai', 'anthropic', 'google']
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      try {
        const [mResult, sResult] = await Promise.all([
          invoke<Model[]>('models:list'),
          invoke<any>('settings:load')
        ])
        const m = (mResult as any).data || mResult
        const s = (sResult as any).data || sResult
        
        if (Array.isArray(m)) setModels(m)
        if (s?.panelDefaults) {
          setDefaults(prev => ({
            ...prev,
            ...s.panelDefaults
          }))
        }
      } catch (e) {
        log.error('Failed to load models/settings', e)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [invoke])

  const handleSave = async (patch: Partial<PanelDefaults>) => {
    const newDefaults = { ...defaults, ...patch }
    setDefaults(newDefaults)
    try {
      await invoke('settings:save', { panelDefaults: newDefaults })
      addToast('Model defaults updated', 'success')
    } catch (e: any) {
      addToast(`Save failed: ${e.message}`, 'error')
    }
  }

  const movePriority = (index: number, direction: 'up' | 'down') => {
    const newPriority = [...defaults.embeddingPriority]
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= newPriority.length) return
    
    const temp = newPriority[index]
    newPriority[index] = newPriority[target]
    newPriority[target] = temp
    
    handleSave({ embeddingPriority: newPriority })
  }

  const groupedModels = models.reduce((acc, m) => {
    if (!acc[m.provider]) acc[m.provider] = []
    acc[m.provider].push(m)
    return acc
  }, {} as Record<string, Model[]>)

  if (loading) return null

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-widest font-mono">Model Configuration</h2>
        <p className="text-[10px] text-zinc-500 font-mono mt-1">Set default intelligence engines for different IDE functions.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <ModelSelector 
          label="Default Chat Model" 
          icon={MessageSquare} 
          value={defaults.chat}
          models={groupedModels}
          onChange={(v: string) => handleSave({ chat: v })}
        />
        <ModelSelector 
          label="Workflow Agent" 
          icon={Workflow} 
          value={defaults.workflow}
          models={groupedModels}
          onChange={(v: string) => handleSave({ workflow: v })}
        />
        <ModelSelector 
          label="Code Intelligence" 
          icon={Code} 
          value={defaults.code}
          models={groupedModels}
          onChange={(v: string) => handleSave({ code: v })}
        />
      </div>

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

const ModelSelector = ({ label, icon: Icon, value, models, onChange }: any) => (
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
      className="bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 rounded px-3 py-1.5 focus:outline-none focus:border-copernicus-phosphor transition-colors min-w-[200px]"
    >
      <option value="">Auto-detect (System Default)</option>
      {Object.entries(models).map(([provider, providerModels]: [string, any]) => (
        <optgroup key={provider} label={provider.toUpperCase()}>
          {providerModels.map((m: any) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  </div>
)
