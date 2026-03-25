import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, DollarSign, Check, ArrowRight, ArrowLeft,
         ShieldCheck, Key, Zap, Github, Layout, Sparkles, Loader2 } from 'lucide-react';
import { useIpcError } from '../../hooks/useIpcError';
import { unwrapIpc } from '../../types/ipc'
import { LocalAIStep } from './LocalAIStep';

interface WizardProps {
  onComplete: () => void;
}

const Wizard: React.FC<WizardProps> = ({ onComplete: onWizardComplete }) => {
  const invoke = useIpcError();
  const [step, setStep] = useState(1);
  const [hasAnyKey, setHasAnyKey] = useState(false);
  const [cliStatus, setCliStatus] = useState<Record<string, boolean> | null>(null);
  const [workspacePath, setWorkspacePath] = useState('');
  const [hourlyRate, setHourlyRate] = useState('65');

  // Step 4 State
  const [availableProjects, setAvailableProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [workspaceIsRepo, setWorkspaceIsRepo] = useState(false);
  const [billingMode, setBillingMode] = useState<'CAPEX' | 'OPEX' | 'NONE'>('CAPEX');
  const [invalidGitRepoWarning, setInvalidGitRepoWarning] = useState<string | null>(null);

  // Step 5: Genesis (new project only)
  const [genesisIdea, setGenesisIdea] = useState('');
  const [genesisAudience, setGenesisAudience] = useState('');
  const [genesisCoreValue, setGenesisCoreValue] = useState('');
  const [genesisStack, setGenesisStack] = useState('react-electron');
  const [genesisLoading, setGenesisLoading] = useState(false);

  // Anthropic
  const [anthropicMethod, setAnthropicMethod] = useState<'cli' | 'apikey' | null>(null);
  const [anthropicKey, setAnthropicKey] = useState('');

  // Other providers
  const [googleKey, setGoogleKey] = useState('');
  const [ollamaKey, setOllamaKey] = useState('');
  const googleOAuthClientId = ''; // Static for now
  
  // GitHub
  const [githubUser, setGithubUser] = useState<{ login: string; avatar_url: string } | null>(null);
  const [showPatInput, setShowPatInput] = useState(false);
  const [patInput, setPatInput] = useState('');

  // Fetch CLI status in background
  useEffect(() => {
    invoke<any>('check-cli-tools').then((result) => {
      setCliStatus(unwrapIpc<any>(result));
    });
  }, [invoke]);

  // Initial Load: Check for existing credentials and workspace
  useEffect(() => {
    // 1. Check Preferences (Workspace)
    invoke<any>('settings:load').then((prefs) => {
      const p = unwrapIpc<any>(prefs);
      if (p?.workspace) setWorkspacePath(p.workspace);
      if (p?.capex?.rate) setHourlyRate(String(p.capex.rate));
    });

    // 2. Check Auth Status (API Keys)
    invoke<any>('auth:status').then((raw) => {
      const status: any[] = unwrapIpc<any>(raw) ?? []
      const active = status.filter(p => p.isActive && p.hasKey);
      setHasAnyKey(active.length > 0);
      
      status.forEach(p => {
        if (p.hasKey) {
          if (p.provider === 'anthropic') {
            if (p.type === 'cli') setAnthropicMethod('cli')
            else { setAnthropicMethod('apikey'); setAnthropicKey('saved') }
          }
          if (p.provider === 'google') setGoogleKey('saved');
          if (p.provider === 'github') {
             invoke<any>('github:test-connection').then(res => {
               const user = unwrapIpc<any>(res);
               if (user) setGithubUser(user);
             }).catch(() => {});
          }
        }
      });
    });
    
    // 3. Check Ollama separately
    invoke<any>('auth:get-api-key', 'ollama').then((res: any) => {
      const key = unwrapIpc<any>(res);
      if (key) setOllamaKey('saved');
    }).catch(() => {});
  }, [invoke]);

  // Load projects when entering step 4 (after workspace is set in step 3)
  useEffect(() => {
    if (step === 4 && workspacePath) {
      console.log('[Wizard] Step 4 entered, workspacePath:', workspacePath);
      invoke<any>('fs:list-dir', workspacePath).then((result) => {
        const nodes = unwrapIpc<any[]>(result) ?? [];
        // Check whether the workspace itself is a repo
        const isRepo = nodes.some((n: any) => n.name === '.git' && n.isDir);
        setWorkspaceIsRepo(isRepo);
        if (isRepo) {
          // Workspace IS the project — no subdir list needed
          setAvailableProjects([]);
          setSelectedProject('');
          return;
        }
        const dirs = nodes
          .filter(n => n.isDir && !n.name.startsWith('.') && n.name !== 'node_modules')
          .map(n => n.name);
        console.log('[Wizard] found sub-projects:', dirs);
        setAvailableProjects(dirs);
        if (dirs.length > 0 && !selectedProject) {
          setSelectedProject(dirs[0]);
        } else if (dirs.length === 0) {
          setIsCreatingNew(true);
        }
      }).catch(err => {
        console.error('[Wizard] fs:list-dir failed:', err);
      });
    }
  }, [step, workspacePath, invoke]);

  const handleBrowseProject = async () => {
    try {
      const result = await invoke<any>('dialog:open-folder');
      const path = unwrapIpc<string | null>(result);
      if (path) {
        if (isCreatingNew) {
          setNewProjectName(path);
        } else {
          setSelectedProject(path);
          // Check if valid git repo
          invoke<any>('fs:list-dir', path).then((res) => {
             const nodes = unwrapIpc<any[]>(res) ?? [];
             if (!nodes.some(n => n.name === '.git' && n.isDir)) {
                 setInvalidGitRepoWarning('Warning: The selected folder is not a valid git repository.');
             } else {
                 setInvalidGitRepoWarning(null);
             }
          }).catch(() => setInvalidGitRepoWarning(null));
        }
      }
    } catch (error: unknown) {
      console.error('Folder selection failed:', error);
    }
  };

  // Whether Genesis step (5) is active for this session
  const showGenesisStep = isCreatingNew && !workspaceIsRepo;

  const handleNext = () => {
    if (step === 1) {
      if (hasAnyKey) setStep(3);
      else setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      if (showGenesisStep) setStep(5);
      else handleFinish();
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (step === 5) {
      setStep(4);
    } else if (step === 4) {
      setStep(3);
    } else if (step === 3) {
      if (hasAnyKey) setStep(1);
      else setStep(2);
    } else if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSelectFolder = async () => {
    try {
      const result = await invoke<any>('select-folder');
      const selectedPath = unwrapIpc<string | null>(result);
      if (selectedPath) {
        setWorkspacePath(selectedPath);
        await invoke('app:set-root-path', selectedPath);
        // Detect whether the selected folder is itself a git repo.
        // If it is, we treat it as the project root directly — no subdir picker needed.
        invoke<any>('fs:list-dir', selectedPath).then((res) => {
          const nodes = unwrapIpc<any[]>(res) ?? [];
          const isRepo = nodes.some((n: any) => n.name === '.git' && n.isDir);
          setWorkspaceIsRepo(isRepo);
          if (isRepo) {
            // Workspace IS the project — clear any lingering subdir selection
            setAvailableProjects([]);
            setSelectedProject('');
          }
        }).catch(() => setWorkspaceIsRepo(false));
      }
    } catch (error: unknown) {
      console.error('Folder selection failed:', error);
    }
  };

  const handleGoogleOAuth = async () => {
    try {
      await invoke<{ ok: boolean }>('app:start-oauth-listener');
    } catch (e: unknown) {
      const message = e instanceof Error ? (e as any).message : String(e)
      console.error('OAuth start failed:', message);
    }
  };

  const handlePatSubmit = async () => {
    if (!patInput.trim()) return;
    try {
      await invoke('auth:store-api-key', 'github', patInput.trim());
      const res = await invoke<any>('github:test-connection');
      const user = unwrapIpc<any>(res);
      if (user) {
        setGithubUser(user);
        setShowPatInput(false);
        setPatInput('');
      } else {
        alert('GitHub PAT saved, but profile fetch failed.');
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? (e as any).message : String(e);
      alert('GitHub Connection Error: ' + message);
    }
  };

  useEffect(() => {
    const removeGoogle = window.ipcRenderer.on('oauth:google-complete', (_event: any, data: any) => {
      if (data.ok) { setGoogleKey('oauth'); }
    });
    return () => { removeGoogle(); };
  }, []);

  const handleFinish = async () => {
    // 1. Validate Step 3 requirements
    const projectName = isCreatingNew ? newProjectName.trim() : selectedProject;
    console.log('[Wizard][handleFinish] workspacePath:', workspacePath, '| selectedProject:', selectedProject, '| isCreatingNew:', isCreatingNew, '| newProjectName:', newProjectName);
    if (!projectName) {
      alert('Please select or create an initial project to continue.');
      return;
    }

    // 2. Final Key Commit
    if (anthropicMethod === 'cli') {
      await invoke('auth:store-api-key', 'anthropic', '__cli__', undefined, 'cli').catch(() => {})
    } else if (anthropicMethod === 'apikey' && anthropicKey && anthropicKey !== 'saved') {
      await invoke('auth:store-api-key', 'anthropic', anthropicKey).catch(() => {})
    }
    
    if (ollamaKey && ollamaKey !== 'saved') {
      await invoke('auth:store-api-key', 'ollama', ollamaKey).catch(() => {})
    }

    if (googleKey && googleKey !== 'saved' && googleKey !== 'oauth') {
      await invoke('auth:store-api-key', 'google', googleKey).catch(() => {})
    }

    // 3. Final Preferences Commit
    const preferences = {
      workspace: workspacePath,
      googleOAuthClientId: googleOAuthClientId.trim(),
      capex: { rate: parseFloat(hourlyRate), currency: 'USD' },
      ui: { theme: 'technical-phosphor' }
    };
    
    if (!workspacePath) {
      alert('A repository store directory is required to initialize COPERNICUS.');
      setStep(3);
      return;
    }
    
    try {
      await invoke('save-preferences', preferences);
      
      // Target the resolved project path so StoriesManager syncs existing stories
      // For browsed paths (absolute), use directly; otherwise combine with workspacePath
      // If the workspace itself is a git repo, use it directly — no subdir append.
      // If creating new with a relative name, combine workspace + name.
      // If creating new with an absolute path (from browse), use it directly.
      // If selecting existing from the dropdown (always a relative name), combine.
      let fullPath: string
      if (workspaceIsRepo) {
        fullPath = workspacePath
      } else if (isCreatingNew) {
        const name = newProjectName.trim()
        fullPath = name.startsWith('/') ? name : `${workspacePath}/${name}`
      } else {
        const sel = selectedProject
        fullPath = sel.startsWith('/') ? sel : `${workspacePath}/${sel}`
      }
      console.log('[Wizard][handleFinish] workspacePath:', workspacePath, '| workspaceIsRepo:', workspaceIsRepo, '| isCreatingNew:', isCreatingNew, '| selectedProject:', selectedProject, '| fullPath:', fullPath)
      if (fullPath) {
        await invoke('app:set-root-path', fullPath).catch(() => {})
        await invoke('stories:target-project', fullPath).catch(() => {})
      }

      // 4. Genesis — scaffold new repo and generate backlog (step 5 path)
      if (showGenesisStep && fullPath) {
        setGenesisLoading(true);
        const genesisPayload = {
          projectName: isCreatingNew ? newProjectName.trim() : (workspacePath.split('/').pop() || 'project'),
          idea: genesisIdea.trim() || 'A new software project.',
          audience: genesisAudience.trim() || 'Developers',
          coreValue: genesisCoreValue.trim() || 'Productivity',
          stack: genesisStack,
          repoPath: fullPath,
          isNewRepo: true,
        };
        await invoke('genesis:run', genesisPayload).catch((err: unknown) => {
          console.warn('[Wizard] genesis:run failed (non-fatal):', err);
        });
        setGenesisLoading(false);
      }

      // 5. Project billing + github target
      await invoke('project:save-billing', {
        id: `${githubUser?.login || 'local'}/${projectName}`,
        path: projectName,
        billing_mode: billingMode,
        billing_details: JSON.stringify({ hourly_rate: parseFloat(hourlyRate) })
      });

      // Target this repo
      await invoke('github:set-target-repo', `${githubUser?.login || 'local'}/${projectName}`);
      
      onWizardComplete();
    } catch (error: unknown) {
      alert(`Initialization failed: ${(error as Error).message}`);
    }
  };

  const claudeDetected = cliStatus?.claude === true;

  return (
    <div className="flex flex-col h-screen w-screen bg-copernicus-bg text-zinc-300 font-sans select-none overflow-hidden">
      <div className="h-8 w-full flex-none pl-20" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col p-8 overflow-hidden">
        <header className="mb-8 flex items-center justify-between border-b border-copernicus-steel/20 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-copernicus-phosphor rounded-full animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.5)]" />
            <h1 className="text-xl font-bold tracking-widest text-copernicus-phosphor uppercase">COPERNICUS SETUP</h1>
          </div>
          <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-[0.2em]">
            {(() => {
              const total = (hasAnyKey ? 3 : 4) + (showGenesisStep ? 1 : 0);
              let display = step;
              if (step === 2 && !hasAnyKey) display = 2;
              else if (step === 3) display = hasAnyKey ? 2 : 3;
              else if (step === 4) display = hasAnyKey ? 3 : 4;
              else if (step === 5) display = hasAnyKey ? 4 : 5;
              return `Step ${display} of ${total}`;
            })()}
          </div>
        </header>

        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              data-testid={`wizard-step-${step}`}
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="absolute w-full h-full flex flex-col overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-zinc-800"
            >

              {/* ── Phase 1: Authentication ─────────────────────────────────── */}
              {step === 1 && (
                <div className="space-y-6 max-w-2xl mx-auto w-full py-2">
                  <div className="flex flex-col gap-1 mb-4 border-l-2 border-copernicus-phosphor pl-4">
                    <h2 className="text-lg font-bold text-white uppercase tracking-tight flex items-center gap-3">
                      <Key size={18} className="text-copernicus-phosphor" /> Intelligence Bus Connectivity
                    </h2>
                    <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Provisioning secure access to primary model orchestrators</p>
                  </div>

                  <div className="space-y-4">
                    {/* Anthropic / Claude */}
                    <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Provider: Anthropic</span>
                        {anthropicMethod && <span className="flex items-center gap-1.5 text-[10px] text-copernicus-phosphor font-bold uppercase"><Check size={11} /> Ready</span>}
                      </div>
                      
                      <div className="grid grid-cols-1 gap-3">
                        <button
                          onClick={() => setAnthropicMethod('cli')}
                          disabled={!claudeDetected}
                          className={`w-full text-left p-3 rounded border transition-all ${anthropicMethod === 'cli' ? 'border-copernicus-phosphor bg-copernicus-phosphor/10' : 'border-zinc-800 hover:border-zinc-700 opacity-60'}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold uppercase tracking-wide flex items-center gap-2"><Zap size={12} /> Use Claude Code (CLI)</span>
                            {claudeDetected ? <span className="text-[9px] bg-copernicus-phosphor/20 text-copernicus-phosphor px-1.5 rounded">DETECTED</span> : <span className="text-[9px] text-zinc-600">NOT FOUND</span>}
                          </div>
                          <p className="text-[10px] text-zinc-500 leading-tight">Leverages existing <code className="text-zinc-400">claude login</code> credentials.</p>
                        </button>

                        <div className={`p-3 rounded border transition-all ${anthropicMethod === 'apikey' ? 'border-copernicus-phosphor bg-copernicus-phosphor/10' : 'border-zinc-800 opacity-60'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold uppercase tracking-wide flex items-center gap-2"><Key size={12} /> Direct API Access</span>
                            <button onClick={() => invoke('app:open-external', 'https://console.anthropic.com/')} className="text-[9px] text-zinc-500 hover:text-white underline">Manage Keys</button>
                          </div>
                          <input
                            type="password"
                            className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white outline-none focus:border-copernicus-phosphor transition-colors font-mono"
                            placeholder={anthropicKey === 'saved' ? 'CREDENTIALS ENCRYPTED' : 'sk-ant-api03-...'}
                            value={anthropicKey === 'saved' ? '' : anthropicKey}
                            onChange={(e) => { setAnthropicKey(e.target.value); setAnthropicMethod('apikey'); }}
                            onFocus={() => { if (anthropicMethod !== 'apikey') setAnthropicMethod('apikey') }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* GitHub Connection */}
                    <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2"><Github size={12}/> Repository Access (GitHub)</span>
                        {githubUser && <span className="flex items-center gap-1.5 text-[10px] text-copernicus-phosphor font-bold uppercase"><Check size={11} /> {githubUser.login}</span>}
                      </div>
                      <button
                        onClick={() => setShowPatInput(true)}
                        className="w-full bg-white/5 hover:bg-white/10 border border-zinc-800 hover:border-zinc-700 text-white py-2.5 rounded text-[11px] font-bold uppercase tracking-[0.2em] transition-all"
                      >
                        {githubUser ? 'Swap GitHub Identity' : 'Connect via PAT'}
                      </button>
                      {showPatInput && (
                        <div className="mt-2 space-y-2">
                          <input
                            type="password"
                            autoFocus
                            className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white outline-none focus:border-copernicus-phosphor transition-colors font-mono"
                            placeholder="ghp_..."
                            value={patInput}
                            onChange={e => setPatInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handlePatSubmit()}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handlePatSubmit}
                              className="flex-1 py-1.5 bg-copernicus-phosphor/10 text-copernicus-phosphor border border-copernicus-phosphor/30 rounded text-[11px] font-bold uppercase"
                            >Connect</button>
                            <button
                              onClick={() => { setShowPatInput(false); setPatInput(''); }}
                              className="px-3 py-1.5 text-zinc-500 hover:text-zinc-300 text-[11px] uppercase"
                            >Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Ollama Cloud */}
                    <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-3">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2"><Zap size={12} className="text-copernicus-phosphor" /> High-Intelligence Tier (Ollama Cloud)</span>
                        {ollamaKey === 'saved' && <span className="text-[10px] text-copernicus-phosphor font-bold uppercase">AUTHENTICATED</span>}
                      </div>
                      <input
                        type="password"
                        className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white outline-none focus:border-copernicus-phosphor transition-colors font-mono"
                        placeholder={ollamaKey === 'saved' ? 'CLOUD TOKEN SECURED' : 'Ollama Bearer Token'}
                        value={ollamaKey === 'saved' ? '' : ollamaKey}
                        onChange={(e) => setOllamaKey(e.target.value)}
                      />
                    </div>

                    {/* Google / Gemini */}
                    <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Google / Gemini</span>
                        {googleKey === 'saved' || googleKey === 'oauth' ? <span className="text-[10px] text-copernicus-phosphor font-bold uppercase">SESSION ACTIVE</span> : <button onClick={handleGoogleOAuth} className="text-[10px] text-copernicus-phosphor font-bold uppercase hover:underline">Start OAuth Flow</button>}
                      </div>
                      <input
                        type="password"
                        className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white outline-none focus:border-copernicus-phosphor transition-colors font-mono"
                        placeholder={googleKey === 'saved' || googleKey === 'oauth' ? 'OAUTH CREDENTIALS ACTIVE' : 'API Key Override (Optional)'}
                        value={googleKey === 'saved' || googleKey === 'oauth' ? '' : googleKey}
                        onChange={(e) => setGoogleKey(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Phase 1.5: Local AI Fallback ───────────────────────────── */}
              {step === 2 && (
                <LocalAIStep onNext={handleNext} />
              )}

              {/* ── Phase 2: File System ────────────────────────────────────── */}
              {step === 3 && (
                <div className="space-y-6 max-w-2xl mx-auto w-full py-12">
                  <div className="flex flex-col gap-1 mb-6 text-center">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center justify-center gap-4">
                      <FolderOpen size={32} className="text-copernicus-phosphor" /> Repository Store
                    </h2>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-[0.4em] opacity-60">Configuring project discovery root</p>
                  </div>
                  
                  <div className="bg-black/40 border border-copernicus-steel/20 rounded-2xl p-10 space-y-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-copernicus-phosphor/20 to-transparent" />
                    
                    <div className="flex flex-col gap-3">
                      <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest ml-1">Repository Store Root</label>
                      <div className="flex gap-3">
                        <input
                          type="text"
                          readOnly
                          className="flex-1 bg-black/60 border border-copernicus-steel/40 rounded-xl p-4 text-xs text-zinc-300 font-mono truncate shadow-inner"
                          value={workspacePath || 'Selection required...'}
                        />
                        <button 
                          onClick={handleSelectFolder} 
                          data-testid="wizard-select-folder"
                          className="bg-copernicus-phosphor text-black px-8 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all hover:brightness-110 active:scale-95 shadow-lg shadow-copernicus-phosphor/20"
                        >
                          Select Store
                        </button>
                      </div>
                    </div>
                    
                    {workspacePath ? (
                      <div className="flex items-start gap-4 p-5 bg-green-900/10 border border-green-900/20 rounded-xl text-green-400/80">
                        <ShieldCheck size={24} className="flex-none text-green-400" />
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-green-400 uppercase tracking-wide">Path Synchronized</p>
                          <p className="text-[10px] font-mono opacity-70 leading-relaxed">Directory is now registered as the root for project discovery and indexing.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 border border-dashed border-zinc-800 rounded-xl text-center">
                        <p className="text-[11px] text-zinc-500 italic leading-relaxed">
                          Select the parent directory where your projects are stored. <br/> COPERNICUS will use this root to discover and manage your repositories.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Phase 3: Economics & Initial Project ─────────────────────── */}
              {step === 4 && (
                <div className="space-y-8 max-w-2xl mx-auto w-full py-6">
                  <div className="flex flex-col gap-1 mb-2 text-center">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center justify-center gap-4">
                      <DollarSign size={32} className="text-copernicus-phosphor" /> CapEx Dynamics
                    </h2>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-[0.4em] opacity-60">Configuring initial project and billing</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Project Selection */}
                    <div className="bg-black/40 border border-copernicus-steel/20 rounded-2xl p-6 space-y-4 shadow-2xl">
                      <div className="flex items-center gap-2 text-copernicus-phosphor mb-2">
                        <Layout size={18} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Initial Project</span>
                      </div>
                      
                      <div className="space-y-3">
                        {workspaceIsRepo ? (
                          /* Workspace IS the project — no sub-picker needed */
                          <div className="flex items-start gap-3 p-3 bg-copernicus-phosphor/5 border border-copernicus-phosphor/20 rounded-lg">
                            <Check size={14} className="flex-none text-copernicus-phosphor mt-0.5" />
                            <div>
                              <p className="text-[10px] font-bold text-copernicus-phosphor uppercase tracking-wide">Repository detected</p>
                              <p className="text-[9px] font-mono text-zinc-400 mt-0.5 break-all">{workspacePath}</p>
                              <p className="text-[9px] text-zinc-600 italic mt-1">Your workspace folder is itself a git repository and will be used as the active project.</p>
                            </div>
                          </div>
                        ) : (
                          <>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-zinc-500 uppercase font-mono">Selection Mode</span>
                          <button
                            onClick={() => setIsCreatingNew(!isCreatingNew)}
                            className="text-[9px] text-copernicus-phosphor hover:underline uppercase font-bold"
                          >
                            {isCreatingNew ? 'Pick Existing' : 'Create New'}
                          </button>
                        </div>

                        {isCreatingNew ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              autoFocus
                              className="w-full bg-black/60 border border-zinc-800 rounded-lg p-3 text-xs text-white font-mono outline-none focus:border-copernicus-phosphor transition-colors"
                              placeholder="my-new-project"
                              value={newProjectName}
                              onChange={e => setNewProjectName(e.target.value)}
                            />
                            <p className="text-[9px] text-zinc-600 italic">Type a name — COPERNICUS will create and init the repo under your workspace.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {availableProjects.length > 0 ? (
                              <select
                                className="w-full bg-black/60 border border-zinc-800 rounded-lg p-3 text-xs text-white font-mono outline-none focus:border-copernicus-phosphor transition-colors"
                                value={selectedProject}
                                onChange={e => setSelectedProject(e.target.value)}
                              >
                                {availableProjects.map(p => (
                                  <option key={p} value={p}>{p}</option>
                                ))}
                              </select>
                            ) : (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  readOnly
                                  className="flex-1 bg-black/60 border border-zinc-800 rounded-lg p-3 text-xs text-white font-mono outline-none focus:border-copernicus-phosphor transition-colors truncate"
                                  placeholder="Select existing repo..."
                                  value={selectedProject}
                                />
                                <button
                                  onClick={handleBrowseProject}
                                  className="bg-copernicus-phosphor/20 hover:bg-copernicus-phosphor/30 text-copernicus-phosphor border border-copernicus-phosphor/30 px-4 py-2 rounded-lg font-bold uppercase tracking-widest text-[9px] transition-all"
                                >
                                  Browse
                                </button>
                              </div>
                            )}
                            {invalidGitRepoWarning && (
                              <p className="text-[9px] text-amber-500 italic mt-1">{invalidGitRepoWarning}</p>
                            )}
                          </div>
                        )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Billing Configuration */}
                    <div className="bg-black/40 border border-copernicus-steel/20 rounded-2xl p-6 space-y-4 shadow-2xl">
                      <div className="flex items-center gap-2 text-copernicus-phosphor mb-2">
                        <DollarSign size={18} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Billing Model</span>
                      </div>

                      <div className="flex flex-col gap-2">
                        {(['CAPEX', 'OPEX', 'NONE'] as const).map(mode => (
                          <button
                            key={mode}
                            onClick={() => setBillingMode(mode)}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-all ${billingMode === mode ? 'border-copernicus-phosphor bg-copernicus-phosphor/10 text-white' : 'border-zinc-800 bg-black/20 text-zinc-500 hover:border-zinc-700'}`}
                          >
                            <span className="text-[10px] font-black uppercase tracking-widest">{mode}</span>
                            {billingMode === mode && <Check size={12} className="text-copernicus-phosphor" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Global Rate */}
                  <div className="bg-black/40 border border-copernicus-steel/20 rounded-2xl p-8 flex flex-col items-center gap-6 shadow-2xl relative">
                    <div className="flex items-center gap-6">
                      <span className="text-4xl text-zinc-700 font-extralight select-none">$</span>
                      <input
                        type="number"
                        className="bg-transparent text-6xl font-black text-white w-40 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none hover:text-copernicus-phosphor transition-colors"
                        value={hourlyRate}
                        onChange={(e) => setHourlyRate(e.target.value)}
                      />
                      <span className="text-zinc-700 text-2xl font-mono tracking-tighter select-none">/HR</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-[0.3em] text-center leading-relaxed">
                      Default hourly implementation rate for CapEx tracking.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Phase 4: Genesis — new project scaffold ───────────────── */}
              {step === 5 && (
                <div className="space-y-6 max-w-2xl mx-auto w-full py-6">
                  <div className="flex flex-col gap-1 mb-2 text-center">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center justify-center gap-4">
                      <Sparkles size={28} className="text-copernicus-phosphor" /> Project Genesis
                    </h2>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-[0.4em] opacity-60">Describe your project — COPERNICUS generates your first sprint backlog</p>
                  </div>

                  <div className="bg-black/40 border border-copernicus-steel/20 rounded-2xl p-8 space-y-5 shadow-2xl">
                    <div className="space-y-2">
                      <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">What are you building?</label>
                      <textarea
                        rows={3}
                        className="w-full bg-black/60 border border-zinc-800 rounded-lg p-3 text-xs text-white font-mono outline-none focus:border-copernicus-phosphor transition-colors resize-none"
                        placeholder="A prop rental platform for the midwest film industry..."
                        value={genesisIdea}
                        onChange={e => setGenesisIdea(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Who is it for?</label>
                        <input
                          type="text"
                          className="w-full bg-black/60 border border-zinc-800 rounded-lg p-3 text-xs text-white font-mono outline-none focus:border-copernicus-phosphor transition-colors"
                          placeholder="Film crews, prop houses..."
                          value={genesisAudience}
                          onChange={e => setGenesisAudience(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Core value proposition</label>
                        <input
                          type="text"
                          className="w-full bg-black/60 border border-zinc-800 rounded-lg p-3 text-xs text-white font-mono outline-none focus:border-copernicus-phosphor transition-colors"
                          placeholder="Same-day delivery, local inventory..."
                          value={genesisCoreValue}
                          onChange={e => setGenesisCoreValue(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Stack template</label>
                      <select
                        className="w-full bg-black/60 border border-zinc-800 rounded-lg p-3 text-xs text-white font-mono outline-none focus:border-copernicus-phosphor transition-colors"
                        value={genesisStack}
                        onChange={e => setGenesisStack(e.target.value)}
                      >
                        <option value="react-electron">React + Electron (Desktop IDE)</option>
                        <option value="react-flask">React + Flask (Web App)</option>
                        <option value="nextjs">Next.js (Full-stack Web)</option>
                        <option value="react-native">React Native (Mobile)</option>
                        <option value="python-cli">Python CLI / Scripts</option>
                        <option value="other">Other / Custom</option>
                      </select>
                    </div>
                    <p className="text-[9px] text-zinc-600 italic">All fields optional — leave blank to scaffold without AI generation.</p>
                  </div>

                  {genesisLoading && (
                    <div className="flex items-center justify-center gap-3 p-4 text-copernicus-phosphor">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="text-[11px] font-bold uppercase tracking-widest">Generating project backlog...</span>
                    </div>
                  )}
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="mt-8 flex justify-between border-t border-copernicus-steel/20 pt-8 flex-none">
          <button
            onClick={handleBack}
            disabled={step === 1}
            data-testid="wizard-back-button"
            className={`flex items-center gap-3 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${step === 1 ? 'opacity-0 pointer-events-none' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <button
            onClick={handleNext}
            disabled={genesisLoading}
            data-testid="wizard-next-button"
            className="group flex items-center gap-4 bg-copernicus-phosphor text-black px-12 py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.3em] transition-all hover:scale-[1.02] hover:brightness-110 active:scale-95 shadow-xl shadow-copernicus-phosphor/20 disabled:opacity-50 disabled:pointer-events-none"
          >
            {genesisLoading
              ? <><Loader2 size={14} className="animate-spin" /> Generating...</>
              : step === 5
                ? <>'Generate &amp; Launch' <Sparkles size={16} className="group-hover:scale-110 transition-transform" /></>
                : step === 4
                  ? (showGenesisStep ? <>Next: Genesis <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></> : <>Launch COPERNICUS <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>)
                  : step === 3
                    ? <>Initialize Core <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
                    : <>Advance <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
            }
          </button>
        </footer>
      </motion.div>
    </div>
  );
};

export default Wizard;
