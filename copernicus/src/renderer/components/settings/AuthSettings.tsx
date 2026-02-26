import React, { useState, useEffect } from 'react';
import { useIpcError } from '../../hooks/useIpcError';

interface AuthStatus {
  provider: string;
  hasKey: boolean;
  source: 'env' | 'storage' | 'file' | 'none';
  baseUrl?: string;
}

export const AuthSettings: React.FC = () => {
  const invoke = useIpcError();
  const [status, setStatus] = useState<AuthStatus[]>([]);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  
  const [newProviderName, setNewProviderName] = useState('');
  const [newProviderKey, setNewProviderKey] = useState('');
  const [newProviderUrl, setNewProviderUrl] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);

  const fetchStatus = async () => {
    try {
      const s = await invoke<AuthStatus[]>('auth:status');
      setStatus(s);
    } catch (e) {
      console.error('Failed to fetch auth status', e);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSave = async (provider: string) => {
    try {
      await invoke('auth:store-api-key', provider, apiKey, baseUrl || undefined);
      setEditingProvider(null);
      setApiKey('');
      setBaseUrl('');
      fetchStatus();
    } catch (e) {
      console.error('Failed to save api key', e);
    }
  };
  
  const handleAddCustom = async () => {
      if (!newProviderName || !newProviderKey) return;
      try {
          await invoke('auth:store-api-key', newProviderName, newProviderKey, newProviderUrl || undefined);
          setNewProviderName('');
          setNewProviderKey('');
          setNewProviderUrl('');
          setShowAddCustom(false);
          fetchStatus();
      } catch (e) {
          console.error('Failed to add custom provider', e);
      }
  };

  return (
    <div className="p-4 bg-copernicus-bg text-zinc-300 border border-copernicus-steel rounded-md w-full max-w-lg shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-copernicus-phosphor uppercase tracking-widest">Auth Manager</h2>
        <button 
            onClick={() => setShowAddCustom(!showAddCustom)}
            className="text-[10px] uppercase border border-copernicus-steel px-2 py-1 rounded hover:bg-copernicus-steel/20"
        >
            {showAddCustom ? 'Cancel' : '+ Custom Provider'}
        </button>
      </div>

      {showAddCustom && (
          <div className="mb-4 p-2 border border-copernicus-steel/50 bg-zinc-900/50 rounded flex flex-col gap-2">
              <span className="text-[10px] uppercase text-zinc-500">New Custom Provider</span>
              <input 
                  className="bg-zinc-950 border border-zinc-700 text-xs px-2 py-1 text-white focus:outline-none focus:border-copernicus-phosphor"
                  placeholder="Provider Name (e.g. local-llm)"
                  value={newProviderName}
                  onChange={e => setNewProviderName(e.target.value)}
              />
              <input 
                  className="bg-zinc-950 border border-zinc-700 text-xs px-2 py-1 text-white focus:outline-none focus:border-copernicus-phosphor"
                  placeholder="API Key"
                  type="password"
                  value={newProviderKey}
                  onChange={e => setNewProviderKey(e.target.value)}
              />
              <input 
                  className="bg-zinc-950 border border-zinc-700 text-xs px-2 py-1 text-white focus:outline-none focus:border-copernicus-phosphor"
                  placeholder="Base URL (Optional)"
                  value={newProviderUrl}
                  onChange={e => setNewProviderUrl(e.target.value)}
              />
              <button 
                  onClick={handleAddCustom}
                  className="bg-copernicus-phosphor text-black text-[10px] px-2 py-1 font-bold uppercase hover:bg-green-400 self-end"
              >
                  Add Provider
              </button>
          </div>
      )}

      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        {status.map((s) => (
          <div key={s.provider} className="flex flex-col gap-1 border-b border-hairline border-copernicus-steel pb-2 last:border-0">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                  <span className="text-xs uppercase text-zinc-500 font-mono w-32 truncate" title={s.provider}>{s.provider}</span>
                  {s.baseUrl && <span className="text-[9px] text-zinc-600 truncate max-w-[150px]" title={s.baseUrl}>{s.baseUrl}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-1 rounded ${s.hasKey ? 'bg-copernicus-phosphor/10 text-copernicus-phosphor' : 'bg-red-900/20 text-red-400'}`}>
                  {s.hasKey ? 'ACTIVE' : 'MISSING'}
                </span>
                <span className="text-[9px] text-zinc-600 uppercase w-12 text-center">[{s.source}]</span>
                <button
                  onClick={() => {
                    if (editingProvider === s.provider) {
                      setEditingProvider(null);
                    } else {
                      setEditingProvider(s.provider);
                      setApiKey('');
                      setBaseUrl(s.baseUrl || '');
                    }
                  }}
                  className="text-[10px] text-zinc-400 hover:text-white underline ml-2"
                >
                  {editingProvider === s.provider ? 'Cancel' : 'Edit'}
                </button>
              </div>
            </div>
            
            {editingProvider === s.provider && (
              <div className="flex flex-col gap-2 mt-1 bg-zinc-900/30 p-2 rounded">
                <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={`Update API Key`}
                      className="flex-1 bg-zinc-950 border border-zinc-700 text-xs px-2 py-1 text-white focus:outline-none focus:border-copernicus-phosphor"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder={`Base URL (Optional)`}
                      className="flex-1 bg-zinc-950 border border-zinc-700 text-xs px-2 py-1 text-white focus:outline-none focus:border-copernicus-phosphor"
                    />
                    <button
                      onClick={() => handleSave(s.provider)}
                      className="bg-copernicus-phosphor text-black text-[10px] px-2 py-1 font-bold uppercase hover:bg-green-400"
                    >
                      Save
                    </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
