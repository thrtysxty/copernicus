import React, { useState, useEffect } from 'react'
import { useIpcError } from '../../../hooks/useIpcError'
import { useToastStore } from '../../../store/toastStore'
import { 
  Zap, 
  Settings, 
  Cpu, 
  AlertCircle,
  Save
} from 'lucide-react'
import { unwrapIpc } from '../../../types/ipc'

interface ModelInfo {
  id: string
  name: string
  provider: string
  contextWindow: number
}

export const ContextSection: React.FC = () => {
  const invoke = useIpcError()
  const addToast = useToastStore(s => s.addToast)
  const [compactionThreshold, setCompactionThreshold] = useState(80)
  const [maxTokensOverrides, setMaxTokensOverrides] = useState<Record<string, string>>({})
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await invoke<any>('settings:load')
        if (settings) {
          if (settings.compactionThreshold) setCompactionThreshold(settings.compactionThreshold)
          if (settings.maxTokensOverrides) {
            const overrides: Record<string, string> = {}
            for (const [id, val] of Object.entries(settings.maxTokensOverrides)) {
              overrides[id] = String(val)
            }
            setMaxTokensOverrides(overrides)
          }
        }

        const modelsRes = await invoke<any>('models:list')
        const models = unwrapIpc<ModelInfo[]>(modelsRes)
        if (Array.isArray(models)) {
          setAvailableModels(models)
        }
      } catch (err) {
        console.error('Failed to load context settings', err)
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [invoke])

  const handleSave = async () => {
    try {
      const overrides: Record<string, number> = {}
      for (const [id, val] of Object.entries(maxTokensOverrides)) {
        if (val.trim()) {
          const num = parseInt(val, 10)
          if (!isNaN(num)) overrides[id] = num
        }
      }

      await invoke('settings:save', {
        compactionThreshold,
        maxTokensOverrides: overrides
      })
      addToast('Context settings saved', 'success')
    } catch (err) {
      addToast('Failed to save context settings', 'error')
    }
  }

  if (loading) return <div className="text-[10px] font-mono text-zinc-500 animate-pulse">LOADING_CONTEXT_CONFIG...</div>

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-[0.2em] font-mono flex items-center gap-2">
          <Zap size={16} className="text-copernicus-phosphor" />
          Context Management
        </h2>
        <p className="text-[10px] text-zinc-500 font-mono mt-1">Optimize how the conversation history and context window are handled.</p>
      </div>

      <div className="space-y-6">
        {/* Compaction Threshold */}
        <div className="bg-[#0F0F0F] border border-zinc-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings size={14} className="text-zinc-500" />
              <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">Compaction Threshold</label>
            </div>
            <span className="text-[11px] font-mono font-bold text-copernicus-phosphor bg-copernicus-phosphor/10 px-2 py-0.5 rounded">
              {compactionThreshold}%
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 font-mono leading-relaxed">
            Automatically summarize the oldest half of the conversation when context reaches this percentage of the model's limit.
          </p>
          <input
            type="range"
            min="50"
            max="95"
            step="5"
            value={compactionThreshold}
            onChange={(e) => setCompactionThreshold(parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-copernicus-phosphor"
          />
          <div className="flex justify-between text-[8px] font-mono text-zinc-600 uppercase tracking-widest">
            <span>Aggressive (50%)</span>
            <span>Conservative (95%)</span>
          </div>
        </div>

        {/* Max Tokens Overrides */}
        <div className="bg-[#0F0F0F] border border-zinc-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Cpu size={14} className="text-zinc-500" />
            <h3 className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">Max Output Tokens Overrides</h3>
          </div>
          <p className="text-[10px] text-zinc-500 font-mono leading-relaxed">
            Set hard limits for the maximum number of tokens generated in a single response per model. Leave empty for automatic defaults.
          </p>
          
          <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
            {availableModels.map(m => (
              <div key={m.id} className="flex items-center justify-between bg-black/40 border border-zinc-900 rounded p-2 group hover:border-zinc-700 transition-colors">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-zinc-300">{m.name}</span>
                  <span className="text-[8px] text-zinc-600 uppercase tracking-tight font-mono">{m.id}</span>
                </div>
                <input
                  type="text"
                  placeholder="AUTO"
                  value={maxTokensOverrides[m.id] || ''}
                  onChange={(e) => setMaxTokensOverrides(prev => ({ ...prev, [m.id]: e.target.value }))}
                  className="w-20 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] font-mono text-zinc-300 focus:border-copernicus-phosphor focus:outline-none"
                />
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2 p-3 bg-zinc-900/50 border border-zinc-800 rounded">
            <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[9px] text-zinc-500 font-mono leading-relaxed">
              Default caps: <span className="text-zinc-300">≤8B: 2048</span>, <span className="text-zinc-300">Mid: 4096</span>, <span className="text-zinc-300">Large: 8192</span>. 
              Runaway output consumes context and costs more.
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-copernicus-phosphor text-[#050505] rounded-none text-[10px] font-bold uppercase tracking-[0.2em] hover:opacity-90 transition-opacity"
        >
          <Save size={14} />
          Save Context Configuration
        </button>
      </div>
    </div>
  )
}
