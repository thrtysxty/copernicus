import React, { useState, useEffect } from 'react'
import { useTelemetryStore } from '../../store/telemetryStore'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc , IpcResult} from '../../types/ipc'

const PERSONA_ORDER = ['architect', 'product-owner', 'dev-orchestrator', 'senior-dev', 'junior-dev', 'sentinel']

type Tab = 'models' | 'activity' | 'session' | 'all-time'

interface RoleStat {
  role: string
  tokens: number
  cost: number
}

interface ModelConfig { id: string; name: string; provider: string }

interface Props {
  onModelSelected?: (model: ModelConfig) => void
  activeModelId?: string
}

// prettier-ignore
const PROVIDER_LABEL: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  openrouter: 'OpenRouter',
  deepinfra: 'DeepInfra',
  ollama: 'Ollama',
}

export const AgentTelemetryOverlay: React.FC<Props> = ({ onModelSelected, activeModelId }) => {
  const { agentTelemetry } = useTelemetryStore()
  const invoke = useIpcError()
  const [activeTab, setActiveTab] = useState<Tab>(onModelSelected ? 'models' : 'activity')
  const [roleStats, setRoleStats] = useState<RoleStat[]>([])
  const [models, setModels] = useState<ModelConfig[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch models when models tab is active
  useEffect(() => {
    if (activeTab !== 'models') return
    setLoading(true)
    invoke<IpcResult<ModelConfig[]>>('models:list')
      .then(r => setModels(unwrapIpc<ModelConfig[]>(r) ?? []))
      .catch(() => setModels([]))
      .finally(() => setLoading(false))
  }, [activeTab, invoke])

  useEffect(() => {
    if (activeTab === 'activity' || activeTab === 'models') return
    setLoading(true)
    const channel = activeTab === 'session' ? 'ledger:stats-by-role-session' : 'ledger:stats-by-role-alltime'
    const args = activeTab === 'session' ? ['current-session'] : []
    invoke<RoleStat[]>(channel, ...args)
      .then(res => setRoleStats(unwrapIpc(res) ?? []))
      .catch(() => setRoleStats([]))
      .finally(() => setLoading(false))
  }, [activeTab, invoke])

  const activityEntries = Object.entries(agentTelemetry ?? {})
    .sort(([a], [b]) => {
      const ai = PERSONA_ORDER.indexOf(a.toLowerCase())
      const bi = PERSONA_ORDER.indexOf(b.toLowerCase())
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })

  const totalTokens = roleStats.reduce((acc, s) => acc + s.tokens, 0)
  const totalCost = roleStats.reduce((acc, s) => acc + s.cost, 0)

  // Group models by provider for display
  const modelsByProvider = models.reduce<Record<string, ModelConfig[]>>((acc, m) => {
    const key = m.provider || 'other'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  const tabs: Tab[] = onModelSelected
    ? ['models', 'activity', 'session', 'all-time']
    : ['activity', 'session', 'all-time']

  return (
    <div className="flex flex-col min-h-[200px]">
      {/* Tabs */}
      <div className="flex border-b border-copernicus-steel/20">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-[11px] uppercase tracking-wider font-bold transition-colors ${
              activeTab === tab ? 'text-copernicus-phosphor border-b border-copernicus-phosphor' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.replace('-', ' ')}
          </button>
        ))}
      </div>

      <div className="p-2 flex-1 overflow-y-auto max-h-[340px]">
        {activeTab === 'models' && onModelSelected ? (
          loading ? (
            <div className="px-2 py-3 text-[11px] text-zinc-600 animate-pulse">Loading models…</div>
          ) : models.length === 0 ? (
            <div className="px-2 py-3 text-[11px] text-zinc-600 italic">No models registered</div>
          ) : (
            <div className="flex flex-col gap-3">
              {Object.entries(modelsByProvider).map(([provider, providerModels]) => (
                <div key={provider}>
                  <div className="px-2 pb-1 text-[11px] text-zinc-600 uppercase tracking-widest font-bold border-b border-white/5">
                    {PROVIDER_LABEL[provider] ?? provider}
                  </div>
                  {providerModels.map(model => (
                    <button
                      key={model.id}
                      onClick={() => {
                        invoke('models:set-active', model.id).catch(() => {})
                        onModelSelected(model)
                      }}
                      className={`w-full text-left flex items-center justify-between px-2 py-1.5 rounded transition-colors hover:bg-white/5 ${
                        activeModelId === model.id ? 'text-copernicus-phosphor' : 'text-zinc-400'
                      }`}
                    >
                      <span className="text-[11px] font-mono">{model.name}</span>
                      {activeModelId === model.id && (
                        <span className="text-[11px] text-copernicus-phosphor font-bold uppercase tracking-widest">active</span>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )
        ) : activeTab === 'activity' ? (
          <>
            {activityEntries.length === 0 ? (
              <div className="px-2 py-3 text-[11px] text-zinc-600 italic">No active agents</div>
            ) : activityEntries.map(([agent, data]) => (
              <div key={agent} className="flex items-center justify-between px-2 py-1.5 hover:bg-white/5 rounded">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${data.cost > 0 ? 'bg-copernicus-phosphor' : 'bg-zinc-600'}`} />
                  <span className="text-[11px] text-zinc-300 capitalize">{agent}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-zinc-600 tabular-nums">
                  <span>{(data.tokensIn + data.tokensOut).toLocaleString()}t</span>
                  <span className="text-copernicus-phosphor">${(data.cost ?? 0).toFixed(4)}</span>
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className="flex flex-col gap-1">
            {loading ? (
              <div className="px-2 py-3 text-[11px] text-zinc-600 animate-pulse">Loading stats…</div>
            ) : roleStats.length === 0 ? (
              <div className="px-2 py-3 text-[11px] text-zinc-600 italic">No data available</div>
            ) : (
              <>
                <div className="flex items-center justify-between px-2 py-1 text-[11px] text-zinc-500 uppercase font-bold border-b border-copernicus-steel/10">
                  <span>Role</span>
                  <div className="flex gap-4">
                    <span className="w-16 text-right">Tokens</span>
                    <span className="w-12 text-right">Cost</span>
                  </div>
                </div>
                {roleStats.map(stat => (
                  <div key={stat.role} className="flex items-center justify-between px-2 py-1.5 hover:bg-white/5 rounded">
                    <span className="text-[11px] text-zinc-300 capitalize">{stat.role}</span>
                    <div className="flex gap-4 text-[11px] text-zinc-600 tabular-nums">
                      <span className="w-16 text-right">{stat.tokens.toLocaleString()}t</span>
                      <span className="w-12 text-right text-copernicus-phosphor">${stat.cost.toFixed(4)}</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between px-2 py-2 mt-1 border-t border-copernicus-steel/30 bg-white/5 font-bold">
                  <span className="text-[11px] text-zinc-400">TOTAL</span>
                  <div className="flex gap-4 text-[11px] text-zinc-400 tabular-nums">
                    <span className="w-16 text-right">{totalTokens.toLocaleString()}t</span>
                    <span className="w-12 text-right text-copernicus-phosphor">${totalCost.toFixed(4)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
