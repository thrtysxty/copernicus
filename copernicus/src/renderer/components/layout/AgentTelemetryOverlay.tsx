import React, { useState, useEffect } from 'react'
import { useLayoutStore } from '../../store/layout'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc } from '../../types/ipc'

const PERSONA_ORDER = ['architect', 'product-owner', 'dev-orchestrator', 'senior-dev', 'junior-dev', 'sentinel']

type Tab = 'activity' | 'session' | 'all-time'

interface RoleStat {
  role: string
  tokens: number
  cost: number
}

export const AgentTelemetryOverlay: React.FC = () => {
  const { agentTelemetry } = useLayoutStore()
  const invoke = useIpcError()
  const [activeTab, setActiveTab] = useState<Tab>('activity')
  const [roleStats, setRoleStats] = useState<RoleStat[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (activeTab === 'activity') return
    
    setLoading(true)
    const channel = activeTab === 'session' ? 'ledger:stats-by-role-session' : 'ledger:stats-by-role-alltime'
    const args = activeTab === 'session' ? ['current-session'] : [] // In a real app, sessionId would come from somewhere

    invoke<RoleStat[]>(channel, ...args)
      .then(res => {
        setRoleStats(unwrapIpc(res) ?? [])
      })
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

  return (
    <div className="flex flex-col min-h-[200px]">
      {/* Tabs */}
      <div className="flex border-b border-copernicus-steel/20">
        {(['activity', 'session', 'all-time'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-[9px] uppercase tracking-wider font-bold transition-colors ${
              activeTab === tab ? 'text-copernicus-phosphor border-b border-copernicus-phosphor' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.replace('-', ' ')}
          </button>
        ))}
      </div>

      <div className="p-2 flex-1 overflow-y-auto max-h-[300px]">
        {activeTab === 'activity' ? (
          <>
            {activityEntries.length === 0 ? (
              <div className="px-2 py-3 text-[10px] text-zinc-600 italic">No active agents</div>
            ) : activityEntries.map(([agent, data]) => (
              <div key={agent} className="flex items-center justify-between px-2 py-1.5 hover:bg-white/5 rounded">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${(data as any).cost > 0 ? 'bg-copernicus-phosphor' : 'bg-zinc-600'}`} />
                  <span className="text-[10px] text-zinc-300 capitalize">{agent}</span>
                </div>
                <div className="flex items-center gap-3 text-[9px] text-zinc-600 tabular-nums">
                  <span>{((data as any).tokensIn + (data as any).tokensOut).toLocaleString()}t</span>
                  <span className="text-copernicus-phosphor">${((data as any).cost ?? 0).toFixed(4)}</span>
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className="flex flex-col gap-1">
            {loading ? (
              <div className="px-2 py-3 text-[10px] text-zinc-600 animate-pulse">Loading stats...</div>
            ) : roleStats.length === 0 ? (
              <div className="px-2 py-3 text-[10px] text-zinc-600 italic">No data available</div>
            ) : (
              <>
                <div className="flex items-center justify-between px-2 py-1 text-[8px] text-zinc-500 uppercase font-bold border-b border-copernicus-steel/10">
                  <span>Role</span>
                  <div className="flex gap-4">
                    <span className="w-16 text-right">Tokens</span>
                    <span className="w-12 text-right">Cost</span>
                  </div>
                </div>
                {roleStats.map(stat => (
                  <div key={stat.role} className="flex items-center justify-between px-2 py-1.5 hover:bg-white/5 rounded">
                    <span className="text-[10px] text-zinc-300 capitalize">{stat.role}</span>
                    <div className="flex gap-4 text-[9px] text-zinc-600 tabular-nums">
                      <span className="w-16 text-right">{stat.tokens.toLocaleString()}t</span>
                      <span className="w-12 text-right text-copernicus-phosphor">${stat.cost.toFixed(4)}</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between px-2 py-2 mt-1 border-t border-copernicus-steel/30 bg-white/5 font-bold">
                  <span className="text-[10px] text-zinc-400">TOTAL</span>
                  <div className="flex gap-4 text-[9px] text-zinc-400 tabular-nums">
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
