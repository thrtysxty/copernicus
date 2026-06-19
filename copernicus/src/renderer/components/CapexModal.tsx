import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useIpcError } from '../hooks/useIpcError';
import { Search, Plus, ChevronDown, X } from 'lucide-react';
import { unwrapIpc } from '../types/ipc'

interface CapexModalProps {
  type: 'start' | 'close';
  isOpen: boolean;
  onClose: () => void;
  session?: any;
}

export function CapexModal({ type, isOpen, onClose, session }: CapexModalProps) {
  const invoke = useIpcError();
  const [formData, setFormData] = useState({
    financial_category: 'CAPEX',
    repo_path: '',
    repo_name: '',
    phase: 'DEVELOPMENT',
    story: '',
    description: '',
    capitalizable: true,
  });

  const [repos, setRepos] = useState<any[]>([]);
  const [repoSearch, setRepoSearch] = useState('');
  const [stories, setStories] = useState<string[]>([]);
  const [durationStr, setDurationStr] = useState('');
  const [value, setValue] = useState(0);
  const [showNewRepoInput, setShowNewRepoInput] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [showRepoDropdown, setShowRepoDropdown] = useState(false);

  // Fetch repos from workspace root
  useEffect(() => {
    if (isOpen) {
      if (type === 'start') {
        invoke<any>('app:get-root-path').then((r: any) => {
          const rootPath: string = unwrapIpc<any>(r);
          invoke<any>('fs:list-dir', rootPath).then(res => {
            const data = unwrapIpc<any[]>(res)
            if (Array.isArray(data)) {
              setRepos(data.filter((item: any) => item.isDir));
            }
          });
        });

        invoke<any>('devtime:defaults').then((raw: any) => {
          const defaults = unwrapIpc<any>(raw) ?? {};
          setFormData(prev => ({
            ...prev,
            financial_category: defaults.financial_category || 'CAPEX',
            phase: 'DEVELOPMENT',
          }));
        });
      } else if (type === 'close' && session) {
        const durHours = (session.duration_seconds / 3600);
        setDurationStr(`${durHours.toFixed(2)}h`);
        setValue(durHours * 65);
        setFormData(prev => ({
            ...prev,
            capitalizable: true,
            description: '',
        }));
      }
    }
  }, [isOpen, type, session, invoke]);

  // Fetch stories when repo changes
  useEffect(() => {
    if (formData.repo_path) {
      invoke<any>('devtime:list-stories', formData.repo_path).then((raw: any) => {
        const res: string[] = unwrapIpc<any>(raw) ?? [];
        setStories(res);
        if (res.length > 0 && res[0]) {
            setFormData(prev => ({ ...prev, story: res[0]! }));
        } else {
            setFormData(prev => ({ ...prev, story: '' }));
        }
      });
    }
  }, [formData.repo_path, invoke]);

  const filteredRepos = useMemo(() => {
    return repos.filter(r => r.name.toLowerCase().includes(repoSearch.toLowerCase()));
  }, [repos, repoSearch]);

  const handleSubmit = async () => {
    if (type === 'start') {
      await invoke('devtime:start', {
        financial_category: formData.financial_category,
        component: formData.repo_name, // Mapping repo_name to component field in DB
        phase: formData.phase,
        story_id: formData.story,
        repo_path: formData.repo_path
      });
      onClose();
    } else {
      await invoke('devtime:close', {
        description: formData.description,
        capitalizable: formData.capitalizable,
      });
      await invoke('app:quit');
    }
  };

  const handleCreateRepo = async () => {
    if (!newRepoName.trim()) return;
    const _rawRoot = await invoke<any>('app:get-root-path');
    const rootPath: string = unwrapIpc<any>(_rawRoot);
    const fullPath = `${rootPath}/${newRepoName.trim()}`;
    setFormData({
        ...formData,
        repo_name: newRepoName.trim(),
        repo_path: fullPath
    });
    setShowNewRepoInput(false);
    setNewRepoName('');
  };

  const handleSkip = async () => {
    if (type === 'close') {
      await invoke('app:quit');
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100]">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-copernicus-bg border border-copernicus-steel w-[520px] shadow-2xl relative overflow-hidden font-mono"
        >
          <div className="h-8 bg-copernicus-bg border-b border-copernicus-steel flex items-center justify-between px-3">
            <span className="text-xs uppercase tracking-widest text-copernicus-phosphor font-bold">
              {type === 'start' ? 'Start Dev Session' : 'Close Dev Session'}
            </span>
          </div>

          <div className="p-6 overflow-y-auto max-h-[80vh]">
            {type === 'start' ? (
              <div className="space-y-5 text-zinc-300">

                 {/* Repo Selection Dropdown */}
                 <div className="space-y-2 relative">
                    <div className="flex items-center justify-between">
                        <label className="block text-[11px] uppercase text-zinc-500">Target Repository</label>
                        <button
                            onClick={() => {
                                setShowNewRepoInput(!showNewRepoInput);
                                if (showNewRepoInput) setNewRepoName('');
                            }}
                            className="text-[11px] text-copernicus-phosphor flex items-center gap-1 hover:underline"
                        >
                            {showNewRepoInput ? <><X size={10} /> Cancel</> : <><Plus size={10} /> New Repo</>}
                        </button>
                    </div>

                    {showNewRepoInput ? (
                        <div className="flex gap-2">
                            <input
                                className="flex-1 bg-[#080808] border border-zinc-800 text-zinc-300 p-2 text-xs focus:border-copernicus-phosphor focus:outline-none"
                                value={newRepoName}
                                onChange={e => setNewRepoName(e.target.value)}
                                placeholder="New repository name..."
                                autoFocus
                            />
                            <button
                                onClick={handleCreateRepo}
                                className="bg-copernicus-phosphor text-black px-3 py-1 text-[11px] font-bold uppercase"
                            >
                                Create
                            </button>
                        </div>
                    ) : (
                        <div className="relative">
                            <button
                                onClick={() => setShowRepoDropdown(!showRepoDropdown)}
                                className="w-full bg-[#080808] border border-zinc-800 text-zinc-300 p-2 text-xs flex items-center justify-between focus:border-copernicus-phosphor focus:outline-none"
                            >
                                <span className={formData.repo_name ? 'text-zinc-200' : 'text-zinc-600'}>
                                    {formData.repo_name || 'Select a repository...'}
                                </span>
                                <ChevronDown size={14} className={`text-zinc-600 transition-transform ${showRepoDropdown ? 'rotate-180' : ''}`} />
                            </button>

                            {showRepoDropdown && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-[#111] border border-copernicus-steel rounded shadow-2xl z-[110] max-h-60 flex flex-col">
                                    <div className="p-2 border-b border-zinc-800">
                                        <div className="relative">
                                            <Search className="absolute left-2 top-2 text-zinc-600" size={12} />
                                            <input
                                                className="w-full bg-black/40 border border-zinc-800 text-zinc-300 pl-8 pr-2 py-1.5 text-[11px] focus:border-copernicus-phosphor focus:outline-none"
                                                value={repoSearch}
                                                onChange={e => setRepoSearch(e.target.value)}
                                                placeholder="Search repos..."
                                                autoFocus
                                            />
                                        </div>
                                    </div>
                                    <div className="overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-zinc-800">
                                        {filteredRepos.length > 0 ? filteredRepos.map(r => (
                                            <button
                                                key={r.path}
                                                onClick={() => {
                                                    setFormData({...formData, repo_name: r.name, repo_path: r.path});
                                                    setShowRepoDropdown(false);
                                                }}
                                                className={`w-full text-left px-3 py-2 text-[11px] hover:text-zinc-300 transition-colors truncate ${formData.repo_path === r.path ? 'bg-copernicus-phosphor/5 text-copernicus-phosphor' : 'text-zinc-400'}`}
                                            >
                                                {r.name}
                                            </button>
                                        )) : (
                                            <div className="px-3 py-4 text-[11px] text-zinc-600 italic text-center uppercase tracking-widest">No repos found</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[11px] uppercase text-zinc-500 mb-1">Financial Type</label>
                        <select
                            className="w-full bg-[#080808] border border-zinc-800 text-zinc-300 p-2 text-xs focus:border-copernicus-phosphor focus:outline-none"
                            value={formData.financial_category}
                            onChange={e => setFormData({...formData, financial_category: e.target.value})}
                        >
                            <option value="CAPEX">CAPEX</option>
                            <option value="OPEX">OPEX</option>
                            <option value="NONE">NONE</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] uppercase text-zinc-500 mb-1">Phase</label>
                        <select
                            className="w-full bg-[#080808] border border-zinc-800 text-zinc-300 p-2 text-xs focus:border-copernicus-phosphor focus:outline-none"
                            value={formData.phase}
                            onChange={e => setFormData({...formData, phase: e.target.value})}
                        >
                            <option value="PLANNING">PLANNING</option>
                            <option value="DEVELOPMENT">DEVELOPMENT</option>
                            <option value="BUG_FIXING">BUG FIXING</option>
                            <option value="MAINTENANCE">MAINTENANCE</option>
                        </select>
                    </div>
                 </div>

                 <div>
                    <label className="block text-[11px] uppercase text-zinc-500 mb-1">Story Context (Optional)</label>
                    <select
                        className="w-full bg-[#080808] border border-zinc-800 text-zinc-300 p-2 text-xs focus:border-copernicus-phosphor focus:outline-none"
                        value={formData.story}
                        onChange={e => setFormData({...formData, story: e.target.value})}
                    >
                        <option value="">-- No Story Linked --</option>
                        {stories.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <p className="text-[8px] text-zinc-600 mt-1 uppercase italic">Selection based on kanban stories in {formData.repo_name || 'repo'}</p>
                 </div>
              </div>
            ) : (
              <div className="space-y-4">
                 <div className="flex justify-between items-center text-sm p-3 bg-[#080808] border border-zinc-800">
                    <span className="text-zinc-500">Duration</span>
                    <span className="text-white font-mono">{durationStr}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm p-3 bg-[#080808] border border-zinc-800">
                    <span className="text-zinc-500">Capitalizable Value</span>
                    <span className="text-copernicus-phosphor font-mono">${value.toFixed(2)}</span>
                 </div>

                 <div className="flex items-center gap-2 py-2">
                    <input
                        type="checkbox"
                        id="cap-check"
                        className="accent-copernicus-phosphor"
                        checked={formData.capitalizable}
                        onChange={e => setFormData({...formData, capitalizable: e.target.checked})}
                    />
                    <label htmlFor="cap-check" className="text-xs text-zinc-400 select-none cursor-pointer font-bold">MARK AS CAPITALIZABLE ✅</label>
                 </div>

                 <div>
                    <label className="block text-[11px] uppercase text-zinc-500 mb-1">Description</label>
                    <textarea
                        className="w-full bg-[#080808] border border-zinc-800 text-zinc-300 p-2 text-xs focus:border-copernicus-phosphor focus:outline-none h-20 resize-none"
                        value={formData.description}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                        placeholder="Brief description of work..."
                        autoFocus
                    />
                 </div>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-8">
                <button
                    onClick={handleSkip}
                    className="px-4 py-2 text-[11px] uppercase tracking-wider text-zinc-500 hover:text-white transition-colors"
                >
                    {type === 'start' ? 'Skip Tracking' : 'Quit Without Saving'}
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={type === 'start' && !formData.repo_path}
                    className="px-6 py-2 text-[11px] uppercase tracking-wider font-bold bg-copernicus-phosphor text-black hover:bg-copernicus-phosphor/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    {type === 'start' ? 'Start Session' : 'Save & Quit'}
                </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
