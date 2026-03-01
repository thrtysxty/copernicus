import React, { useEffect, useState } from 'react';
import { Github, Lock, Globe, Plus, Link, GitBranch } from 'lucide-react';
import { useIpcError } from '../../hooks/useIpcError';

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

export const GithubDashboard: React.FC = () => {
  const invoke = useIpcError();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const userData = await invoke<User>('github:user');
      const reposData = await invoke<Repo[]>('github:list-repos');

      setUser(userData);
      setRepos(Array.isArray(reposData) ? reposData : []);
    } catch (error) {
      console.error('Failed to fetch GitHub data:', error);
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
      fetchData(); // Refresh the list
    } catch (error) {
      console.error('Failed to create repo:', error);
    } finally {
      setCreating(false);
    }
  };

  if (loading && !user) {
    return (
      <div className="flex items-center justify-center h-full text-copernicus-phosphor animate-pulse text-xs font-mono">
        INITIALIZING UPLINK...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-copernicus-bg text-zinc-300 relative overflow-hidden font-sans">

      {/* Header */}
      <div className="h-8 flex items-center justify-between px-3 border-b border-hairline border-copernicus-steel bg-copernicus-bg/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Github className="w-4 h-4 text-copernicus-phosphor" />
          <span className="text-xs font-bold text-copernicus-phosphor tracking-wider uppercase">GitHub Dashboard</span>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="p-1 hover:bg-zinc-800 rounded transition-colors"
          title="New Repository"
        >
          <Plus className="w-4 h-4 text-copernicus-phosphor" />
        </button>
      </div>

      {/* User Status */}
      {user && (
        <div className="p-4 border-b border-hairline border-copernicus-steel flex items-center gap-3">
          <img
            src={user.avatar_url}
            alt={user.login}
            className="w-10 h-10 rounded-full border border-copernicus-steel"
          />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-white">{user.login}</span>
            <div className="flex items-center gap-1 text-[10px] text-copernicus-phosphor">
              <span className="w-2 h-2 rounded-full bg-copernicus-phosphor animate-pulse"></span>
              CONNECTED
            </div>
          </div>
        </div>
      )}

      {/* Repo List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-copernicus-steel">
        <div className="px-2 py-1 text-[10px] uppercase text-zinc-500 font-bold tracking-widest sticky top-0 bg-copernicus-bg/95 backdrop-blur z-0">
          Repositories ({repos.length})
        </div>

        {repos.map((repo) => (
          <div
            key={repo.name}
            className="group flex flex-col p-2 rounded hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-all cursor-default"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                {repo.private ? (
                  <Lock className="w-3 h-3 text-yellow-500/80" />
                ) : (
                  <Globe className="w-3 h-3 text-blue-400/80" />
                )}
                <span className="text-xs font-mono text-zinc-300 group-hover:text-white transition-colors">
                  {repo.name}
                </span>
              </div>
              <span className="text-[9px] text-zinc-600 font-mono">
                {new Date(repo.updated_at).toLocaleDateString()}
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
               <button className="text-[10px] text-zinc-400 hover:text-copernicus-phosphor flex items-center gap-1 hover:bg-zinc-800 px-1 rounded">
                 <GitBranch className="w-3 h-3" /> Clone
               </button>
               <button className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 hover:bg-zinc-800 px-1 rounded">
                 <Link className="w-3 h-3" /> Open
               </button>
            </div>
          </div>
        ))}

        {repos.length === 0 && !loading && (
          <div className="text-center py-8 text-xs text-zinc-600">
            No repositories found.
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
                   <span className={!isPrivate ? "text-white" : "text-zinc-500"}>Public</span>
                 </label>
                 <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                   <input
                     type="radio"
                     name="visibility"
                     checked={isPrivate}
                     onChange={() => setIsPrivate(true)}
                     className="accent-copernicus-phosphor"
                   />
                   <span className={isPrivate ? "text-white" : "text-zinc-500"}>Private</span>
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
                {creating ? "Creating..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
