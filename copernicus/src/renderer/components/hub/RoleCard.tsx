import log from '../../utils/logger'
import React, { useState, useEffect } from 'react';
import { useIpcError } from '../../hooks/useIpcError';
import { Lock, FileText } from 'lucide-react';

interface RoleConfig {
  name: string;
  class: 'regulatory' | 'operational';
  authority_level: number;
  assigned_to: { provider: string; model: string };
  token_ttl: string;
  token_budget_usd: number;
  selection_policy: 'static' | 'data-driven';
  contract: string;
}

interface ActiveToken {
  token_id: string;
  role: string;
  expires_at: number;
}

interface ProviderModel {
  id: string;
  name: string;
}

interface Provider {
  id: string;
  name: string;
  models: ProviderModel[];
}

interface RoleCardProps {
  roleName: string;
  roleConfig: RoleConfig;
  activeToken?: ActiveToken;
  isReadOnly: boolean;
  onUpdate: () => void;
}

export function RoleCard({ roleName, roleConfig, activeToken, isReadOnly, onUpdate }: RoleCardProps) {
  const invoke = useIpcError();
  const [providers, setProviders] = useState<Provider[]>([]);

  const [ttl, setTtl] = useState(roleConfig.token_ttl);
  const [budget, setBudget] = useState(roleConfig.token_budget_usd.toString());

  useEffect(() => {
    setTtl(roleConfig.token_ttl);
    setBudget(roleConfig.token_budget_usd.toString());
  }, [roleConfig]);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const result = await invoke<any>('provider:list-providers');
        if (result.ok && result.data) {
          setProviders(result.data as Provider[]);
        }
      } catch (e) {
        log.error('Failed to load providers', e);
      }
    };
    fetchProviders();
  }, [invoke]);

  const handleUpdate = async (updates: Partial<RoleConfig>) => {
    if (isReadOnly) return;
    try {
      const result = await invoke<any>('org-chart:update-role', { role: roleName, ...updates });
      if (result.ok) {
        onUpdate();
      }
    } catch (e) {
      log.error('Failed to update role', e);
    }
  };

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value) {
      const [provider, model] = value.split(':');
      handleUpdate({ assigned_to: { provider: provider || '', model: model || '' } });
    }
  };

  const openContract = () => {
    invoke('fs:open-file', roleConfig.contract).catch(log.error);
  };

  const minutesRemaining = activeToken ? Math.max(0, Math.floor((activeToken.expires_at * 1000 - Date.now()) / 60000)) : 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded p-4 flex flex-col gap-3 relative text-sm w-80 shrink-0">
      <div className="flex items-center justify-between">
        <h3 className="font-mono font-bold text-zinc-100">{roleName}</h3>
        <div className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase ${
          roleConfig.class === 'regulatory' ? 'bg-amber-900/50 text-amber-500 border border-amber-900' : 'bg-blue-900/50 text-blue-500 border border-blue-900'
        }`}>
          {roleConfig.class}
        </div>
      </div>

      {activeToken && (
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 bg-zinc-950 p-2 rounded border border-zinc-800">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-zinc-300 truncate" title={activeToken.token_id}>
            {activeToken.token_id.startsWith('tok_') ? activeToken.token_id : `tok_${activeToken.token_id.substring(0, 6)}`}
          </span>
          <span className="ml-auto">(expires in {minutesRemaining}m)</span>
        </div>
      )}

      <div className="grid grid-cols-[100px_1fr] items-center gap-y-2 text-xs">
        <div className="text-zinc-500">Authority Level</div>
        <div className="flex items-center gap-1 text-zinc-400 font-mono group cursor-help relative">
          <span>{roleConfig.authority_level}</span>
          <Lock size={12} className="text-zinc-600" />
          <div className="hidden group-hover:block absolute bottom-full mb-1 left-0 bg-black text-zinc-300 text-[10px] p-2 rounded border border-zinc-800 w-48 z-10">
            Constitutional field — edit `~/.copernicus/org.yaml` directly.
          </div>
        </div>

        <div className="text-zinc-500">Model</div>
        <select
          value={`${roleConfig.assigned_to.provider}:${roleConfig.assigned_to.model}`}
          onChange={handleProviderChange}
          disabled={isReadOnly}
          className="bg-black border border-zinc-800 rounded px-2 py-1 text-zinc-300 w-full outline-none disabled:opacity-50"
        >
          {providers.map(p => (
            <optgroup key={p.id} label={p.name}>
              {p.models.map(m => (
                <option key={`${p.id}:${m.id}`} value={`${p.id}:${m.id}`}>
                  {m.name}
                </option>
              ))}
            </optgroup>
          ))}
          {/* Fallback if provider list doesn't match */}
          {!providers.some(p => p.id === roleConfig.assigned_to.provider && p.models.some(m => m.id === roleConfig.assigned_to.model)) && (
            <option value={`${roleConfig.assigned_to.provider}:${roleConfig.assigned_to.model}`}>
              {roleConfig.assigned_to.provider}/{roleConfig.assigned_to.model}
            </option>
          )}
        </select>

        <div className="text-zinc-500">Token TTL</div>
        <input
          value={ttl}
          onChange={e => setTtl(e.target.value)}
          onBlur={() => { if (ttl !== roleConfig.token_ttl) handleUpdate({ token_ttl: ttl }) }}
          disabled={isReadOnly}
          className="bg-black border border-zinc-800 rounded px-2 py-1 text-zinc-300 w-full outline-none font-mono disabled:opacity-50"
        />

        <div className="text-zinc-500">Budget Limit</div>
        <div className="relative">
          <span className="absolute left-2 top-1.5 text-zinc-600">$</span>
          <input
            value={budget}
            onChange={e => setBudget(e.target.value)}
            onBlur={() => {
              const num = parseFloat(budget);
              if (!isNaN(num) && num !== roleConfig.token_budget_usd) {
                handleUpdate({ token_budget_usd: num });
              } else {
                setBudget(roleConfig.token_budget_usd.toString());
              }
            }}
            disabled={isReadOnly}
            className="bg-black border border-zinc-800 rounded pl-5 pr-2 py-1 text-zinc-300 w-full outline-none font-mono disabled:opacity-50"
          />
        </div>

        <div className="text-zinc-500">Contract</div>
        <button
          onClick={openContract}
          className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors text-left font-mono truncate max-w-[140px]"
          title={roleConfig.contract}
        >
          <FileText size={12} className="shrink-0" />
          <span className="truncate">{roleConfig.contract.split('/').pop()}</span>
        </button>
      </div>
    </div>
  );
}
