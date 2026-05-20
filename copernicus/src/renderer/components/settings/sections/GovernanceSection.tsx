import React, { useState, useEffect } from 'react'
import { Users, FileText } from 'lucide-react'

type SubTab = 'roles' | 'proposals'

export const GovernanceSection: React.FC = () => {
  const [subTab, setSubTab] = useState<SubTab>('roles')
  const [roles, setRoles] = useState<any[]>([])
  const [proposals, setProposals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ipc = window.ipcRenderer
    if (!ipc) return

    const loadRoles = async () => {
      try {
        const result: any = await ipc.invoke('org-chart:get-config')
        if (result?.ok) setRoles(result.data ?? [])
      } catch { /* not available */ }
    }

    const loadProposals = async () => {
      try {
        const result: any = await ipc.invoke('hub:get-proposals')
        if (result?.ok) setProposals(result.data ?? [])
      } catch { /* not available */ }
    }

    Promise.all([loadRoles(), loadProposals()]).finally(() => setLoading(false))

    const onProposal = (_e: any, data: any) => {
      setProposals(prev => [data, ...prev])
    }
    ipc.on('contract:proposal_ready', onProposal)
    return () => { ipc.off('contract:proposal_ready', onProposal) }
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-zinc-100">Governance</h2>
        <p className="text-xs text-zinc-500 mt-1">Agent workforce configuration and contract proposals</p>
      </div>

      <div className="flex gap-2 border-b border-zinc-800 pb-1">
        <SubTabButton id="roles" label="Roles" icon={<Users size={12} />} active={subTab} onClick={setSubTab} />
        <SubTabButton id="proposals" label={`Proposals (${proposals.length})`} icon={<FileText size={12} />} active={subTab} onClick={setSubTab} />
      </div>

      {loading ? (
        <div className="text-zinc-500 text-xs py-8 text-center">Loading governance data...</div>
      ) : subTab === 'roles' ? (
        <RolesContent roles={roles} />
      ) : (
        <ProposalsContent proposals={proposals} />
      )}
    </div>
  )
}

const SubTabButton: React.FC<{ id: SubTab, label: string, icon: any, active: SubTab, onClick: (id: SubTab) => void }> = ({ id, label, icon, active, onClick }) => {
  const isActive = active === id
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${isActive ? 'text-copernicus-phosphor border-b-2 border-copernicus-phosphor' : 'text-zinc-500 hover:text-zinc-300'}`}
    >
      {icon} {label}
    </button>
  )
}

const RolesContent: React.FC<{ roles: any[] }> = ({ roles }) => {
  if (!roles.length) {
    return <div className="text-zinc-500 text-xs py-8 text-center">No roles configured. Start the Hub to manage agent workforce.</div>
  }
  return (
    <div className="space-y-2">
      {roles.map((role, i) => (
        <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded p-3 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-zinc-200">{role.name ?? role.role ?? `Role ${i + 1}`}</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">{role.authority ?? role.type ?? 'Standard'}</div>
          </div>
          <div className="text-[10px] text-zinc-600 font-mono">{role.activeTokens ?? 0} tokens</div>
        </div>
      ))}
    </div>
  )
}

const ProposalsContent: React.FC<{ proposals: any[] }> = ({ proposals }) => {
  if (!proposals.length) {
    return <div className="text-zinc-500 text-xs py-8 text-center">No pending proposals.</div>
  }
  return (
    <div className="space-y-2">
      {proposals.map((p, i) => (
        <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-zinc-200">{p.role ?? p.name ?? `Proposal ${i + 1}`}</div>
            <span className={`text-[9px] font-bold uppercase tracking-widest ${p.status === 'PENDING' ? 'text-amber-400' : p.status === 'APPROVED' ? 'text-green-400' : 'text-red-400'}`}>
              {p.status ?? 'PENDING'}
            </span>
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">{p.rationale ?? ''}</div>
        </div>
      ))}
    </div>
  )
}
