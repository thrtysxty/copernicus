import { useEffect, useState } from 'react';
import { useIpcError } from '../../hooks/useIpcError';
import { IpcResult } from '../../types/ipc';

interface PackageGateConfig {
  version: number;
  package_gate: {
    enabled: boolean;
    min_age_days: number;
    min_weekly_downloads: number;
    registries: string[];
    on_violation: 'block' | 'warn' | 'log-only';
    require_user_approval: boolean;
  };
  package_allowlist: string[];
  package_blocklist: string[];
}

interface HubEvent {
    id: number;
    timestamp: string;
    action: string;
    result: string;
    notes: string;
}

export function PackageGatePanel() {
  const invoke = useIpcError();
  const [config, setConfig] = useState<PackageGateConfig | null>(null);
  const [events, setEvents] = useState<HubEvent[]>([]);
  const [newAllowlistEntry, setNewAllowlistEntry] = useState('');

  useEffect(() => {
    loadConfig();
    loadEvents();
  }, []);

  const loadConfig = async () => {
    const res = await invoke<IpcResult<PackageGateConfig>>('security:get-config');
    if (res && res.ok && res.data) {
      setConfig(res.data);
    }
  };

  const loadEvents = async () => {
    try {
        const res = await invoke<IpcResult<HubEvent[]>>('db:get-events', 'package:install');
        if (res && res.ok && res.data) {
            setEvents(res.data.filter((e: any) => e.action && e.action.includes('package:install')));
        }
    } catch (e) {
        // ignore
    }
  };

  const updateGate = async (updates: Partial<PackageGateConfig['package_gate']>, confirmed: boolean = false) => {
    if (updates.enabled === false && !confirmed) {
        if (!window.confirm("Are you sure you want to disable the Package Gate? This reduces security.")) {
            return;
        }
        confirmed = true;
    }
    const res = await invoke<IpcResult<PackageGateConfig>>('security:update-package-gate', { updates, confirmed });
    if (res && res.ok && res.data) {
        setConfig(res.data);
    }
  };

  const addToAllowlist = async (pkg: string) => {
      if (!pkg.trim()) return;
      const res = await invoke<IpcResult<PackageGateConfig>>('security:add-to-allowlist', pkg.trim());
      if (res && res.ok && res.data) {
          setConfig(res.data);
          setNewAllowlistEntry('');
      }
  };

  if (!config) return <div>Loading...</div>;

  const enabledStyle = config.package_gate.enabled
    ? 'text-green-500'
    : 'text-red-500';

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-xl font-semibold">Package Gate Security</h2>

      <div className="flex items-center space-x-2">
        <span className={`font-bold ${enabledStyle}`}>
            {config.package_gate.enabled ? '● ENABLED' : '● DISABLED'}
        </span>
        <button
            onClick={() => updateGate({ enabled: !config.package_gate.enabled })}
            className="px-3 py-1 bg-zinc-800 rounded hover:bg-zinc-700"
        >
            {config.package_gate.enabled ? 'Disable Gate' : 'Enable Gate'}
        </button>
      </div>

      <div className="space-y-4">
          <h3 className="text-lg font-medium">Thresholds</h3>
          <div className="grid grid-cols-2 gap-4">
              <div>
                  <label className="block text-sm text-zinc-400">Min Age (Days)</label>
                  <input
                      type="number"
                      value={config.package_gate.min_age_days}
                      onChange={(e) => updateGate({ min_age_days: parseInt(e.target.value) })}
                      className="bg-zinc-900 border border-zinc-700 p-2 rounded w-full"
                  />
              </div>
              <div>
                  <label className="block text-sm text-zinc-400">Min Weekly Downloads</label>
                  <input
                      type="number"
                      value={config.package_gate.min_weekly_downloads}
                      onChange={(e) => updateGate({ min_weekly_downloads: parseInt(e.target.value) })}
                      className="bg-zinc-900 border border-zinc-700 p-2 rounded w-full"
                  />
              </div>
          </div>
      </div>

      <div className="space-y-4">
          <h3 className="text-lg font-medium">Allowlist</h3>
          <div className="flex space-x-2">
              <input
                  type="text"
                  value={newAllowlistEntry}
                  onChange={e => setNewAllowlistEntry(e.target.value)}
                  placeholder="Package name (e.g., react)"
                  className="bg-zinc-900 border border-zinc-700 p-2 rounded flex-1"
              />
              <button
                  onClick={() => addToAllowlist(newAllowlistEntry)}
                  className="px-4 py-2 bg-copernicus-phosphor text-[#050505] rounded-none font-medium"
              >
                  Add
              </button>
          </div>
          <ul className="space-y-1">
              {config.package_allowlist.map((pkg) => (
                  <li key={pkg} className="bg-zinc-800 p-2 rounded text-sm">{pkg}</li>
              ))}
          </ul>
      </div>

      <div className="space-y-4">
          <h3 className="text-lg font-medium">Recent Events</h3>
          <ul className="space-y-2">
              {events.length === 0 ? <li className="text-zinc-500 text-sm">No recent events</li> : events.map(e => (
                  <li key={e.id} className="bg-zinc-800 p-3 rounded space-y-1">
                      <div className="flex justify-between">
                          <span className="font-semibold text-sm">{e.action}</span>
                          <span className="text-xs text-zinc-400">{new Date(e.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="text-xs">{e.result}</div>
                      {e.notes && <div className="text-xs text-zinc-400">{e.notes}</div>}
                  </li>
              ))}
          </ul>
      </div>
    </div>
  );
}
