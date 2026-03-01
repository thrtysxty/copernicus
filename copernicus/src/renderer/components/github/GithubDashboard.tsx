import React, { useEffect, useState } from 'react';
import { Github, Lock, Globe, Plus, Link, GitBranch, Shield, ShieldOff, Trash2, Copy, Check } from 'lucide-react';
import { useIpcError } from '../../hooks/useIpcError';
import { useToastStore } from '../../store/toastStore';
import log from '../../utils/logger'

type Tab = 'repos' | 'access' | 'invite';

interface Repo {
  name: string;
  private: boolean;
  updated_at: string;
  html_url?: string;
}

interface User {
  login: string;
  avatar_url: string;
  html_url?: string;
}

interface TrustList {
  trusted: string[];
  tracked: string[];
}

export const GithubDashboard: React.FC = () => {
  const invoke = useIpcError();
  const addToast = useToastStore(s => s.addToast);
  const [activeTab, setActiveTab] = useState<Tab>('repos');
  const [repos, setRepos] = useState<Repo[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [trustList, setTrustList] = useState<TrustList>({ trusted: [], tracked: [] });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [creating, setCreating] = useState(false);
  const [addRepoInput, setAddRepoInput] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [_rawUser, _rawRepos, _rawTrust] = await Promise.all([
        invoke<any>('github:user'),
        invoke<any>('github:list-repos'),
        invoke<any>('github:get-trust-list'),
      ]);
      const userData: User = (_rawUser as any)?.data ?? _rawUser;
      const reposData: Repo[] = (_rawRepos as any)?.data ?? _rawRepos;
      const trustData: TrustList = (_rawTrust as any)?.data ?? _rawTrust;
      setUser(userData);
      setRepos(Array.isArray(reposData) ? reposData : []);
      setTrustList(trustData ?? { trusted: [], tracked: [] });
    } catch (error) {
      log.error('Failed to fetch GitHub data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRepo = async () => {
    if (!newRepoName.trim()) return;
    setCreating(true);
    try {
      await invoke('github:create-repo', { name: newRepoName, description: '', isPrivate });
      setIsModalOpen(false);
      setNewRepoName('');
      fetchData();
    } catch (error) {
      log.error('Failed to create repo:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleSetTrust = async (repoName: string, trusted: boolean) => {
    try {
      await invoke('github:set-trust', repoName, trusted);
      setTrustList(prev => ({
        trusted: trusted
          ? [...prev.trusted.filter(r => r !== repoName), repoName]
          : prev.trusted.filter(r => r !== repoName),
        tracked: prev.tracked,
      }));
      addToast(`${repoName} ${trusted ? 'trusted' : 'untrusted'}`, 'success');
    } catch (e) {
      log.error('Failed to set trust', e);
    }
  };

  const handleAddRepo = async () => {
    if (!addRepoInput.trim()) return;
    try {
      const _rawAdd = await invoke<any>('github:add-repo', addRepoInput.trim());
      const result: { tracked: string[] } = (_rawAdd as any)?.data ?? _rawAdd;
      setTrustList(prev => ({ ...prev, tracked: result?.tracked ?? [...prev.tracked, addRepoInput.trim()] }));
      setAddRepoInput('');
      addToast(`${addRepoInput.trim()} added to tracked repos`, 'success');
    } catch (e) {
      log.error('Failed to add repo', e);
    }
  };

  const handleRemoveRepo = async (repoName: string) => {
    try {
      await invoke('github:remove-repo', repoName);
      setTrustList(prev => ({
        trusted: prev.trusted.filter(r => r !== repoName),
        tracked: prev.tracked.filter(r => r !== repoName),
      }));
      addToast(`${repoName} removed`, 'success');
    } catch (e) {
      log.error('Failed to remove repo', e);
    }
  };

  const handleCopyProfileUrl = () => {
    if (!user) return;
    const url = user.html_url ?? `https://github.com/${user.login}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading && !user) {
    return (
      <div className="flex items-center justify-center h-full text-copernicus-phosphor animate-pulse text-xs font-mono">
        INITIALIZING UPLINK...
      </div>
    );
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'repos',  label: 'Repos' },
    { id: 'access', label: 'Access' },
    { id: 'invite', label: 'Invite / Share' },
  ];

  return (
    <div className="h-full flex flex-col bg-copernicus-bg text-zinc-300 relative overflow-hidden font-sans">

      {/* Header */}
      <div className="h-8 flex items-center justify-between px-3 border-b border-copernicus-steel bg-copernicus-bg/50 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <Github className="w-4 h-4 text-copernicus-phosphor" />
          <span className="text-xs font-bold text-copernicus-phosphor tracking-wider uppercase">GitHub</span>
        </div>
        {activeTab === 'repos' && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="p-1 hover:bg-zinc-800 rounded transition-colors"
            title="New Repository"
          >
            <Plus className="w-4 h-4 text-copernicus-phosphor" />
          </button>
        )}
      </div>

      {/* User Status */}
      {user && (
        <div className="px-3 py-2 border-b border-copernicus-steel flex items-center gap-2 flex-shrink-0">
          <img
            src={user.avatar_url}
            alt={user.login}
            className="w-6 h-6 rounded-full border border-copernicus-steel"
          />
          <span className="text-xs font-semibold text-white">{user.login}</span>
          <span className="w-2 h-2 rounded-full bg-copernicus-phosphor animate-pulse ml-auto" title="Connected" />
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex border-b border-copernicus-steel flex-shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wide transition-colors border-r border-copernicus-steel last:border-r-0
              ${activeTab === tab.id
                ? 'text-copernicus-phosphor bg-copernicus-phosphor/5'
                : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Repos Tab ── */}
        {activeTab === 'repos' && (
          <div className="p-2 space-y-1">
            <div className="px-2 py-1 text-[9px] uppercase text-zinc-600 font-bold tracking-widest">
              Repositories ({repos.length})
            </div>
            {repos.map((repo) => {
              const isTrusted = trustList.trusted.includes(repo.name);
              return (
                <div
                  key={repo.name}
                  className="group flex items-center gap-2 p-2 rounded hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-all"
                >
                  {repo.private ? (
                    <Lock className="w-3 h-3 text-yellow-500/80 flex-shrink-0" />
                  ) : (
                    <Globe className="w-3 h-3 text-blue-400/80 flex-shrink-0" />
                  )}
                  <span className="text-xs font-mono text-zinc-300 flex-1 truncate">{repo.name}</span>
                  <span className="text-[9px] text-zinc-600 font-mono mr-2">
                    {new Date(repo.updated_at).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => handleSetTrust(repo.name, !isTrusted)}
                    className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded transition-colors
                      ${isTrusted
                        ? 'text-copernicus-phosphor bg-copernicus-phosphor/10 hover:bg-copernicus-phosphor/20'
                        : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800'}`}
                    title={isTrusted ? 'Revoke trust' : 'Trust this repo'}
                  >
                    {isTrusted ? <Shield className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
                    {isTrusted ? 'Trusted' : 'Trust'}
                  </button>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="text-zinc-600 hover:text-copernicus-phosphor p-0.5 rounded hover:bg-zinc-800 transition-colors" title="Clone">
                      <GitBranch className="w-3 h-3" />
                    </button>
                    <button className="text-zinc-600 hover:text-zinc-300 p-0.5 rounded hover:bg-zinc-800 transition-colors" title="Open">
                      <Link className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
            {repos.length === 0 && !loading && (
              <div className="text-center py-8 text-xs text-zinc-600">No repositories found.</div>
            )}
          </div>
        )}

        {/* ── Access Tab ── */}
        {activeTab === 'access' && (
          <div className="p-3 space-y-4">
            <div>
              <p className="text-[9px] uppercase tracking-widest text-zinc-600 mb-2">Track a Repository</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={addRepoInput}
                  onChange={e => setAddRepoInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddRepo()}
                  placeholder="owner/repo-name"
                  className="flex-1 bg-black border border-zinc-800 text-xs px-2 py-1.5 text-white focus:border-copernicus-phosphor focus:outline-none placeholder:text-zinc-700 font-mono rounded"
                />
                <button
                  onClick={handleAddRepo}
                  disabled={!addRepoInput.trim()}
                  className="px-3 py-1.5 bg-copernicus-phosphor/10 hover:bg-copernicus-phosphor/20 text-copernicus-phosphor border border-copernicus-phosphor/40 text-[10px] font-mono uppercase rounded transition-colors disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>

            <div>
              <p className="text-[9px] uppercase tracking-widest text-zinc-600 mb-2">
                Tracked Repos ({trustList.tracked.length})
              </p>
              {trustList.tracked.length === 0 ? (
                <p className="text-[10px] text-zinc-600 font-mono">No repos tracked yet.</p>
              ) : (
                <div className="space-y-1">
                  {trustList.tracked.map(name => (
                    <div key={name} className="flex items-center gap-2 px-2 py-1.5 rounded border border-zinc-800 bg-zinc-900/40">
                      <span className="flex-1 text-xs font-mono text-zinc-300">{name}</span>
                      {trustList.trusted.includes(name) && (
                        <span title="Trusted">
                          <Shield className="w-3 h-3 text-copernicus-phosphor" />
                        </span>
                      )}
                      <button
                        onClick={() => handleRemoveRepo(name)}
                        className="text-zinc-600 hover:text-red-400 transition-colors p-0.5 rounded hover:bg-zinc-800"
                        title="Remove"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Invite / Share Tab ── */}
        {activeTab === 'invite' && (
          <div className="p-4 space-y-4">
            <div>
              <p className="text-[9px] uppercase tracking-widest text-zinc-600 mb-2">Your GitHub Profile</p>
              {user ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded font-mono text-xs text-zinc-300">
                  <span className="flex-1 truncate">{user.html_url ?? `https://github.com/${user.login}`}</span>
                  <button
                    onClick={handleCopyProfileUrl}
                    className="text-zinc-500 hover:text-copernicus-phosphor transition-colors flex-shrink-0"
                    title="Copy URL"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-copernicus-phosphor" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ) : (
                <p className="text-[10px] text-zinc-600 font-mono">Connect GitHub to see your profile URL.</p>
              )}
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest text-zinc-600 mb-1">Share this Project</p>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Share your GitHub profile URL with collaborators to invite them to your repositories.
                Trusted repos are accessible to all configured providers in COPERNICUS.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* New Repo Modal */}
      {isModalOpen && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-[#0A0A0A] border border-copernicus-steel rounded shadow-2xl p-4">
            <h3 className="text-xs font-bold text-copernicus-phosphor mb-4 uppercase tracking-wider">
              Create New Repository
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Repository Name</label>
                <input
                  type="text"
                  value={newRepoName}
                  onChange={(e) => setNewRepoName(e.target.value)}
                  className="w-full bg-black border border-zinc-800 text-xs p-2 text-white focus:border-copernicus-phosphor focus:outline-none placeholder:text-zinc-700 font-mono"
                  placeholder="project-name"
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <input
                    type="radio"
                    name="visibility"
                    checked={!isPrivate}
                    onChange={() => setIsPrivate(false)}
                    className="accent-copernicus-phosphor"
                  />
                  <span className={!isPrivate ? 'text-white' : 'text-zinc-500'}>Public</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <input
                    type="radio"
                    name="visibility"
                    checked={isPrivate}
                    onChange={() => setIsPrivate(true)}
                    className="accent-copernicus-phosphor"
                  />
                  <span className={isPrivate ? 'text-white' : 'text-zinc-500'}>Private</span>
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1 text-xs text-zinc-400 hover:text-white transition-colors"
                disabled={creating}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRepo}
                disabled={creating || !newRepoName.trim()}
                className="px-3 py-1 bg-copernicus-phosphor/10 hover:bg-copernicus-phosphor/20 text-copernicus-phosphor border border-copernicus-phosphor/50 text-xs rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-mono uppercase tracking-wide"
              >
                {creating ? 'Creating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
