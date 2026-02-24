import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, Key, LogOut, RefreshCw, Lock } from 'lucide-react';
import type { AuthStatus } from '../../../main/auth/auth-manager';
import { AuthMethodPicker } from './AuthMethodPicker';

interface AuthAPI {
  getStatus: (provider: string) => Promise<AuthStatus>;
  launchOAuth: (provider: string) => Promise<void>;
  storeApiKey: (provider: string, key: string) => Promise<void>;
  revoke: (provider: string) => Promise<void>;
  onAuthSuccess: (callback: (status: AuthStatus) => void) => () => void;
  onAuthError: (callback: (error: any) => void) => () => void;
}

declare global {
  interface Window {
    auth: AuthAPI;
  }
}

export const AuthSettings: React.FC = () => {
  const [statuses, setStatuses] = useState<AuthStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePicker, setActivePicker] = useState<string | null>(null);

  const providers = ['google', 'anthropic'];

  const fetchStatuses = async () => {
    try {
      setLoading(true);
      if (!window.auth) return;
      const results = await Promise.all(providers.map(p => window.auth.getStatus(p)));
      setStatuses(results);
    } catch (e) {
      console.error('Error fetching auth statuses', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatuses();
    
    if (window.auth) {
        const cleanupSuccess = window.auth.onAuthSuccess((status) => {
            setStatuses(prev => prev.map(s => s.provider === status.provider ? status : s));
        });
        
        const cleanupError = (error: any) => {
            console.error('Auth error:', error);
        };
        const cleanupErrorFunc = window.auth.onAuthError(cleanupError);

        return () => {
            cleanupSuccess();
            cleanupErrorFunc();
        };
    }
  }, []);

  const handleMethodSelect = async (provider: string, method: string) => {
    setActivePicker(null);
    if (method === 'oauth') {
      await window.auth.launchOAuth(provider);
    } else if (method === 'manual') {
      const key = window.prompt(`Enter API Key for ${provider}:`);
      if (key) {
        await window.auth.storeApiKey(provider, key);
        fetchStatuses();
      }
    }
  };

  const handleRevoke = async (provider: string) => {
    if (window.confirm(`Revoke credentials for ${provider}?`)) {
      await window.auth.revoke(provider);
      fetchStatuses();
    }
  };

  if (loading) return <div className="p-4 text-gray-500 italic">Loading authentication status...</div>;

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-gray-900 custom-scrollbar">
      {activePicker && (
        <AuthMethodPicker 
          onSelect={(m) => handleMethodSelect(activePicker, m)}
          onClose={() => setActivePicker(null)}
        />
      )}

      <div className="max-w-4xl mx-auto space-y-8">
        <header className="border-b border-gray-800 pb-4">
          <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
            <Lock className="text-blue-500" size={24} />
            <span>Authentication</span>
          </h2>
          <p className="text-sm text-gray-500 mt-1">Manage credentials and security boundaries for ATLAS agents.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {statuses.map((status) => (
            <div key={status.provider} className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-lg hover:border-gray-600 transition">
              <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-750">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${status.authenticated ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-gray-600'}`} />
                  <span className="font-bold text-gray-200 capitalize">{status.provider}</span>
                </div>
                <div className="text-[10px] uppercase font-bold text-gray-500 tracking-widest px-2 py-0.5 bg-gray-900 rounded">
                  {status.authenticated ? 'Connected' : 'Disconnected'}
                </div>
              </div>
              
              <div className="p-5 space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-gray-900 rounded-lg">
                    {status.authenticated ? <CheckCircle size={18} className="text-green-400" /> : <AlertTriangle size={18} className="text-amber-400" />}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-tight">Status</div>
                    <div className="text-sm text-gray-200 mt-0.5 font-medium">
                      {status.authenticated ? `Authenticated via ${status.method?.replace(/_/g, ' ')}` : 'Not configured'}
                    </div>
                  </div>
                </div>

                {status.authenticated ? (
                  <div className="pt-2">
                    <button 
                      onClick={() => handleRevoke(status.provider)}
                      className="w-full flex items-center justify-center space-x-2 p-2.5 rounded-lg bg-red-900 bg-opacity-20 text-red-400 hover:bg-opacity-30 border border-red-900 border-opacity-30 transition font-bold text-xs"
                    >
                      <LogOut size={14} />
                      <span>REVOKE ACCESS</span>
                    </button>
                  </div>
                ) : (
                  <div className="pt-2">
                    <button
                      onClick={() => setActivePicker(status.provider)}
                      className="w-full flex items-center justify-center space-x-2 p-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20 transition font-bold text-xs"
                    >
                      <Key size={14} />
                      <span>CONFIGURE AGENT</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <section className="bg-blue-900 bg-opacity-10 border border-blue-900 border-opacity-30 rounded-xl p-5">
          <h3 className="text-blue-400 font-bold text-sm flex items-center space-x-2 mb-2">
            < Lock size={16} />
            <span>Security Note</span>
          </h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            ATLAS stores your API keys encrypted on your local disk using 
            <code className="text-blue-300 font-mono mx-1">Electron safeStorage</code>. 
            Credentials never leave your machine and are only accessible by the ATLAS main process. 
            OAuth flows utilize PKCE for maximum security.
          </p>
        </section>
      </div>
    </div>
  );
};
