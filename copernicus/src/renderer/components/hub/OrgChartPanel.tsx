import log from '../../utils/logger'
import { useEffect, useState } from 'react';
import { useIpcError } from '../../hooks/useIpcError';
import { RoleCard } from './RoleCard';
import { RoleConfig, ActiveToken } from './RoleCard';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Skeleton } from '../common/Skeleton';

export function OrgChartPanel() {
  const invoke = useIpcError();
  const [config, setConfig] = useState<Record<string, RoleConfig> | null>(null);
  const [activeTokens, setActiveTokens] = useState<ActiveToken[]>([]);
  const [isHubRunning, setIsHubRunning] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const configResult = await invoke<IpcResult<Record<string, RoleConfig>>>('org-chart:get-config');
      if (configResult && configResult.ok && configResult.data) {
        setConfig(configResult.data);
        setIsHubRunning(true);
      } else {
        setIsHubRunning(false);
        // We could theoretically use a cached config here if needed, but for now we'll just not show it if we can't get it
      }

      const tokensResult = await invoke<IpcResult<ActiveToken[]>>('org-chart:list-active-tokens');
      if (tokensResult && tokensResult.ok && tokensResult.data) {
        setActiveTokens(tokensResult.data);
      }
    } catch (e) {
      setIsHubRunning(false);
      log.error('Failed to load org chart config', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // In a real app we might poll for tokens or subscribe to an event
    const interval = setInterval(() => {
      invoke<IpcResult<ActiveToken[]>>('org-chart:list-active-tokens').then(res => {
        if (res && res.ok && res.data) setActiveTokens(res.data);
      }).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [invoke]);

  if (loading && !config) {
    return (
      <div data-testid="panel-org-chart" className="p-8 h-full overflow-y-auto bg-[#050505] space-y-12">
        <div className="flex items-center gap-3">
          <Skeleton width={18} height={18} rounded="full" />
          <Skeleton width={150} height={16} />
          <Skeleton width={100} height={16} />
        </div>
        <div className="space-y-8">
          <div className="space-y-4">
            <Skeleton width={120} height={12} />
            <div className="flex gap-4">
              <Skeleton width={200} height={100} className="rounded-lg" />
              <Skeleton width={200} height={100} className="rounded-lg" />
              <Skeleton width={200} height={100} className="rounded-lg" />
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton width={120} height={12} />
            <div className="flex gap-4">
              <Skeleton width={200} height={100} className="rounded-lg" />
              <Skeleton width={200} height={100} className="rounded-lg" />
              <Skeleton width={200} height={100} className="rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-8 h-full flex items-center justify-center">
        <div className="bg-red-950/30 text-red-400 p-4 rounded border border-red-900 flex items-center gap-3 max-w-md text-sm">
          <AlertTriangle className="shrink-0" size={24} />
          <div>
            <div className="font-bold mb-1">Hub is not running</div>
            <div>Unable to retrieve org chart configuration. Start the Agent Hub to manage roles.</div>
          </div>
        </div>
      </div>
    );
  }

  const regulatoryRoles = Object.entries(config.roles).filter(([_, r]: [string, RoleConfig]) => r.class === 'regulatory');
  const operationalRoles = Object.entries(config.roles).filter(([_, r]: [string, RoleConfig]) => r.class === 'operational');

  return (
    <div className="p-8 h-full overflow-y-auto bg-[#050505]">
      <div className="max-w-6xl mx-auto space-y-12">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-xl font-mono text-zinc-100">Agent Workforce</h1>
            <p className="text-sm text-zinc-500 mt-1">Configure roles, authority, and token limits</p>
          </div>
          {!isHubRunning && (
            <div className="bg-amber-950 text-amber-500 px-3 py-1.5 rounded border border-amber-900 flex items-center gap-2 text-xs font-mono">
              <AlertTriangle size={14} />
              Hub is not running. Changes cannot be saved.
            </div>
          )}
        </div>

        <div>
          <h2 className="text-sm font-mono text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            Regulatory Roles
          </h2>
          <div className="flex flex-wrap gap-6 relative">
            {regulatoryRoles.map(([name, roleConfig]) => (
              <RoleCard
                key={name}
                roleName={name}
                roleConfig={roleConfig}
                activeToken={activeTokens.find(t => t.role === name)}
                isReadOnly={!isHubRunning}
                onUpdate={fetchData}
              />
            ))}
            {/* Visual separator connecting sections (a simple line) */}
            <div className="absolute top-full left-40 w-px h-12 bg-zinc-800" />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-mono text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            Operational Roles
          </h2>
          <div className="flex flex-wrap gap-6 relative pt-4">
            {/* Visual branch connecting from regulatory */}
            <div className="absolute top-0 left-40 w-px h-4 bg-zinc-800" />
            <div className="absolute top-0 left-40 right-auto w-[340px] h-px bg-zinc-800" />

            {operationalRoles.map(([name, roleConfig], index) => (
              <div key={name} className="relative">
                {/* Branch line for each card if not the first */}
                {index > 0 && <div className="absolute -top-4 left-40 w-px h-4 bg-zinc-800" />}
                <RoleCard
                  roleName={name}
                  roleConfig={roleConfig}
                  activeToken={activeTokens.find(t => t.role === name)}
                  isReadOnly={!isHubRunning}
                  onUpdate={fetchData}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
