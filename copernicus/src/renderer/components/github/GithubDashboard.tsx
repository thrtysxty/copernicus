import React, { useEffect, useState } from 'react';
import { Github, Lock, Globe, Plus, Link, Shield, ShieldOff, Trash2, Copy, Check, Search, Target, Download } from 'lucide-react';
import { useIpcError } from '../../hooks/useIpcError';
import { useToastStore } from '../../store/toastStore';
import log from '../../utils/logger'
import { unwrapIpc } from '../../types/ipc'

type Tab = 'repos' | 'access' | 'invite';

interface Repo {
  name: string;
  full_name: string;
  private: boolean;
  updated_at: string;
  html_url?: string;
  description: string | null;
  stargazers_count: number;
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
  const [searchQuery, setSearchQuery] = useState('');
  const [targetRepo, setTargetRepo] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [_rawUser, _rawRepos, _rawTrust, _rawTarget] = await Promise.all([
        invoke<any>('github:user'),
        invoke<any>('github:list-repos'),
        invoke<any>('github:get-trust-list'),
        invoke<any>('github:get-target-repo'),
      ]);
      const userData: User = unwrapIpc<any>(_rawUser);
      const reposData: Repo[] = unwrapIpc<any>(_rawRepos);
      const trustData: TrustList = unwrapIpc<any>(_rawTrust);
      setUser(userData);
      setRepos(Array.isArray(reposData) ? reposData : []);
      setTrustList(trustData ?? { trusted: [], tracked: [] });
      setTargetRepo(unwrapIpc<any>(_rawTarget));
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
      const result: { tracked: string[] } = unwrapIpc<any>(_rawAdd);
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

  
  const handleSetTarget = async (repoFullName: string) => {
    try {
      const result = await invoke<any>('github:set-target-repo', repoFullName);
      if (result && (result as any).ok) {
        setTargetRepo(repoFullName);
        addToast(`Target set to ${repoFullName}`, 'success');
      }
    } catch (e) {
      log.error('Failed to set target repo', e);
    }
  };

  const handleCloneRepo = async (repoUrl: string, repoName: string) => {
    try {
      await invoke('github:clone-repo', { repoUrl, repoName });
      addToast(`Cloning ${repoName}...`, 'info');
    } catch (e) {
      log.error('Failed to clone repo', e);
    }
  };

  const filteredRepos = repos.filter(repo => 
    repo.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (repo.description && repo.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
          <div className="p-2 space-y-2">
            <div className="px-2 py-1 flex items-center justify-between">
              <span className="text-[9px] uppercase text-zinc-600 font-bold tracking-widest">
                Repositories ({filteredRepos.length})
              </span>
              <div className="relative">
                <Search className="w-3 h-3 absolute left-1.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-black border border-zinc-800 text-[10px] pl-6 pr-2 py-0.5 text-white focus:border-copernicus-phosphor focus:outline-none placeholder:text-zinc-700 font-mono rounded w-32 transition-all focus:w-48"
                />
              </div>
            </div>
            
            <div className="space-y-1">
              {filteredRepos.map((repo) => {
                const isTrusted = trustList.trusted.includes(repo.name);
                const isTarget = targetRepo === repo.full_name;
                return (
                  <div
                    key={repo.full_name}
                    className={`group flex items-center gap-2 p-2 rounded border transition-all
                      ${isTarget 
                        ? 'bg-copernicus-phosphor/5 border-copernicus-phosphor/30' 
                        : 'bg-transparent border-transparent hover:bg-zinc-900 hover:border-zinc-800'}`}
                  >
                    {repo.private ? (
                      <Lock className="w-3 h-3 text-yellow-500/80 flex-shrink-0" />
                    ) : (
                      <Globe className="w-3 h-3 text-blue-400/80 flex-shrink-0" />
                    )}
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-zinc-300 truncate">{repo.name}</span>
                        {isTarget && (
                          <span className="text-[8px] font-bold uppercase tracking-wider bg-copernicus-phosphor text-black px-1 rounded-sm">
                            ACTIVE
                          </span>
                        )}
                        <span className="ml-auto text-[9px] text-zinc-600 flex items-center gap-1">
                          <span className="text-yellow-500/80">★</span> {repo.stargazers_count || 0}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate mb-1">
                        {repo.description || 'No description provided.'}
                      </div>
                      <span className="text-[9px] text-zinc-600 font-mono">
                        {new Date(repo.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleSetTarget(repo.full_name)}
                        className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded transition-colors
                          ${isTarget
                            ? 'text-copernicus-phosphor bg-copernicus-phosphor/10'
                            : 'text-zinc-600 hover:text-copernicus-phosphor hover:bg-copernicus-phosphor/10'}`}
                        title="Set Target"
                      >
                        <Target className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleSetTrust(repo.name, !isTrusted)}
                        className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded transition-colors
                          ${isTrusted
                            ? 'text-copernicus-phosphor bg-copernicus-phosphor/10 hover:bg-copernicus-phosphor/20'
                            : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800'}`}
                        title={isTrusted ? 'Revoke trust' : 'Trust this repo'}
                      >
                        {isTrusted ? <Shield className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
                      </button>
                      <button 
                        onClick={() => repo.html_url && handleCloneRepo(repo.html_url, repo.name)}
                        className="text-zinc-600 hover:text-copernicus-phosphor p-0.5 rounded hover:bg-zinc-800 transition-colors" 
                        title="Clone"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={async () => {
                          if (repo.html_url) {
                            const res = await invoke<any>('app:open-external', repo.html_url);
                            if (!res || !res.ok) return;
                          }
                        }}
                        className="text-zinc-600 hover:text-zinc-300 p-0.5 rounded hover:bg-zinc-800 transition-colors" 
                        title="Open"
                      >
                        <Link className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {filteredRepos.length === 0 && !loading && (
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
