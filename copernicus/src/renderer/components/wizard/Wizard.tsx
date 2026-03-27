import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, DollarSign, Check, ArrowRight, ArrowLeft,
         ShieldCheck, Key, Zap, Github, Layout, Sparkles, Loader2 } from 'lucide-react';
import { useIpcError } from '../../hooks/useIpcError';
import { unwrapIpc } from '../../types/ipc'

interface WizardProps {
  onComplete: () => void;
}

const Wizard: React.FC<WizardProps> = ({ onComplete: onWizardComplete }) => {
  const invoke = useIpcError();
  const [step, setStep] = useState(1);
  const [cliStatus, setCliStatus] = useState<Record<string, boolean> | null>(null);
  const [workspacePath, setWorkspacePath] = useState('');
  const [hourlyRate, setHourlyRate] = useState('65');

  // Step 3 State
  const [wizardMode, setWizardMode] = useState<'new' | 'existing' | null>(null);
  const [availableProjects, setAvailableProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [billingMode, setBillingMode] = useState<'CAPEX' | 'OPEX' | 'NONE'>('CAPEX');
  // Genesis fields (New mode)
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
  
  const [error, setError] = useState<string | null>(null);

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

  // Load workspace subdirs when entering step 3
  useEffect(() => {
    if (step === 3 && workspacePath) {
      invoke<any>('fs:list-dir', workspacePath).then((result) => {
        const nodes = unwrapIpc<any[]>(result) ?? [];
        const dirs = nodes
          .filter(n => n.isDir && !n.name.startsWith('.') && n.name !== 'node_modules')
          .map(n => n.name);
        setAvailableProjects(dirs);
      }).catch(() => setAvailableProjects([]));
    }
  }, [step, workspacePath, invoke]);

  const handleBrowseProject = async () => {
    try {
      const result = await invoke<any>('dialog:open-folder');
      const path = unwrapIpc<string | null>(result);
      if (path) {
        setSelectedProject(path);
        setWizardMode('existing');
      }
    } catch (error: unknown) {
      console.error('Folder selection failed:', error);
    }
  };

  const handleNext = () => {
    setError(null);
    if (step === 1) setStep(2);
    else if (step === 2) setStep(3);
    else handleFinish();
  };

  const handleBack = () => {
    setError(null);
    if (step > 1) setStep(step - 1);
  };

  const handleSelectFolder = async () => {
    try {
      const result = await invoke<any>('select-folder');
      const selectedPath = unwrapIpc<string | null>(result);
      if (selectedPath) {
        setWorkspacePath(selectedPath);
        setError(null);
        await invoke('app:set-root-path', selectedPath);
        // Reset project selection when workspace changes
        setSelectedProject('');
        setWizardMode(null);
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
        setError(null);
      } else {
        setError('GitHub PAT saved, but profile fetch failed.');
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? (e as any).message : String(e);
      setError('GitHub Connection Error: ' + message);
    }
  };

  useEffect(() => {
    const removeGoogle = window.ipcRenderer.on('oauth:google-complete', (_event: any, data: any) => {
      if (data.ok) { setGoogleKey('oauth'); }
    });
    return () => { removeGoogle(); };
  }, []);

  const handleFinish = async () => {
    setError(null);
    if (!workspacePath) {
      setError('A repository store directory is required.');
      setStep(2);
      return;
    }
    if (!wizardMode) {
      setError('Please choose to open an existing project or create a new one.');
      return;
    }

    const projectName = wizardMode === 'new' ? newProjectName.trim() : selectedProject;
    if (!projectName) {
      setError(wizardMode === 'new' ? 'Please enter a project name.' : 'Please select a repository.');
      return;
    }

    // Commit API keys
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

    // Save preferences
    await invoke('save-preferences', {
      workspace: workspacePath,
      googleOAuthClientId: googleOAuthClientId.trim(),
      capex: { rate: parseFloat(hourlyRate), currency: 'USD' },
      ui: { theme: 'technical-phosphor' }
    }).catch(() => {});

    try {
      // Resolve full project path
      const fullPath = projectName.startsWith('/') ? projectName : `${workspacePath}/${projectName}`;

      await invoke('app:set-root-path', fullPath).catch(() => {})
      await invoke('stories:target-project', fullPath).catch(() => {})

      // Genesis — scaffold repo + generate first-sprint backlog for new projects
      if (wizardMode === 'new') {
        setGenesisLoading(true);
        await invoke('genesis:run', {
          projectName: newProjectName.trim(),
          idea: genesisIdea.trim() || 'A new software project.',
          audience: genesisAudience.trim() || 'Developers',
          coreValue: genesisCoreValue.trim() || 'Productivity',
          stack: genesisStack,
          repoPath: fullPath,
          isNewRepo: true,
        }).catch((err: unknown) => console.warn('[Wizard] genesis:run failed (non-fatal):', err));
        setGenesisLoading(false);
      }

      await invoke('project:save-billing', {
        id: `${githubUser?.login || 'local'}/${projectName}`,
        path: projectName,
        billing_mode: billingMode,
        billing_details: JSON.stringify({ hourly_rate: parseFloat(hourlyRate) })
      }).catch(() => {});

      await invoke('github:set-target-repo', `${githubUser?.login || 'local'}/${projectName}`).catch(() => {});

      onWizardComplete();
    } catch (err: unknown) {
      setError(`Initialization failed: ${(err as Error).message}`);
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
            {`Step ${step} of 3`}
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
                            onChange={e => {
                              setPatInput(e.target.value);
                              if (error) setError(null);
                            }}
                            onKeyDown={e => e.key === 'Enter' && handlePatSubmit()}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handlePatSubmit}
                              className="flex-1 py-1.5 bg-copernicus-phosphor/10 text-copernicus-phosphor border border-copernicus-phosphor/30 rounded text-[11px] font-bold uppercase"
                            >Connect</button>
                            <button
                              onClick={() => { setShowPatInput(false); setPatInput(''); setError(null); }}
                              className="px-3 py-1.5 text-zinc-500 hover:text-zinc-300 text-[11px] uppercase"
                            >Cancel</button>
                          </div>
                          {error && step === 1 && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center mt-2">
                              <p className="text-xs text-red-400">{error}</p>
                            </div>
                          )}
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

              {/* ── Phase 2: Repository Store ───────────────────────────────── */}
              {step === 2 && (
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

                    {error && step === 2 && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center mt-4">
                        <p className="text-xs text-red-400">{error}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Step 3: New or Existing Project ────────────────────────── */}
              {step === 3 && (
                <div className="space-y-6 max-w-2xl mx-auto w-full py-4">
                  <div className="flex flex-col gap-1 mb-2 text-center">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center justify-center gap-4">
                      <Layout size={28} className="text-copernicus-phosphor" /> Your Project
                    </h2>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-[0.4em] opacity-60">Open an existing repository or start something new</p>
                  </div>

                  {/* Mode selector */}
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => { setWizardMode('existing'); setNewProjectName(''); setError(null); }}
                      className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all ${wizardMode === 'existing' ? 'border-copernicus-phosphor bg-copernicus-phosphor/10 text-white' : 'border-zinc-800 bg-black/30 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'}`}
                    >
                      <FolderOpen size={28} className={wizardMode === 'existing' ? 'text-copernicus-phosphor' : ''} />
                      <div className="text-center">
                        <p className="text-[11px] font-black uppercase tracking-widest">Existing Project</p>
                        <p className="text-[9px] mt-1 opacity-60">Open a repository from your workspace</p>
                      </div>
                    </button>
                    <button
                      onClick={() => { setWizardMode('new'); setSelectedProject(''); setError(null); }}
                      className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all ${wizardMode === 'new' ? 'border-copernicus-phosphor bg-copernicus-phosphor/10 text-white' : 'border-zinc-800 bg-black/30 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'}`}
                    >
                      <Sparkles size={28} className={wizardMode === 'new' ? 'text-copernicus-phosphor' : ''} />
                      <div className="text-center">
                        <p className="text-[11px] font-black uppercase tracking-widest">New Project</p>
                        <p className="text-[9px] mt-1 opacity-60">Scaffold a repo + generate first sprint</p>
                      </div>
                    </button>
                  </div>

                  {/* Existing: repo picker */}
                  {wizardMode === 'existing' && (
                    <div className="bg-black/40 border border-copernicus-steel/20 rounded-2xl p-6 space-y-4 shadow-2xl">
                      <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Select Repository</p>
                      {availableProjects.length > 0 && (
                        <select
                          className="w-full bg-black/60 border border-zinc-800 rounded-lg p-3 text-xs text-white font-mono outline-none focus:border-copernicus-phosphor transition-colors"
                          value={selectedProject}
                          onChange={e => {
                            setSelectedProject(e.target.value);
                            if (error) setError(null);
                          }}
                        >
                          <option value="">— choose from workspace —</option>
                          {availableProjects.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      )}
                      <button
                        onClick={handleBrowseProject}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-black/40 border border-zinc-700 hover:border-copernicus-phosphor/40 hover:text-white text-zinc-400 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all"
                      >
                        <FolderOpen size={13} /> Browse for Repository
                      </button>
                      {selectedProject && (
                        <div className="flex items-center gap-2 p-2.5 bg-copernicus-phosphor/5 border border-copernicus-phosphor/20 rounded-lg">
                          <Check size={12} className="flex-none text-copernicus-phosphor" />
                          <span className="text-[9px] font-mono text-zinc-300 truncate">{selectedProject.startsWith('/') ? selectedProject : `${workspacePath}/${selectedProject}`}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* New: Genesis form */}
                  {wizardMode === 'new' && (
                    <div className="bg-black/40 border border-copernicus-steel/20 rounded-2xl p-6 space-y-4 shadow-2xl">
                      <div className="space-y-1">
                        <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Project Name</label>
                        <input
                          type="text"
                          autoFocus
                          className="w-full bg-black/60 border border-zinc-800 rounded-lg p-3 text-xs text-white font-mono outline-none focus:border-copernicus-phosphor transition-colors"
                          placeholder="my-new-project"
                          value={newProjectName}
                          onChange={e => {
                            setNewProjectName(e.target.value);
                            if (error) setError(null);
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">What are you building? <span className="opacity-50">(optional)</span></label>
                        <textarea
                          rows={2}
                          className="w-full bg-black/60 border border-zinc-800 rounded-lg p-3 text-xs text-white font-mono outline-none focus:border-copernicus-phosphor transition-colors resize-none"
                          placeholder="A prop rental platform for the midwest film industry..."
                          value={genesisIdea}
                          onChange={e => setGenesisIdea(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Who is it for?</label>
                          <input type="text" className="w-full bg-black/60 border border-zinc-800 rounded-lg p-2.5 text-xs text-white font-mono outline-none focus:border-copernicus-phosphor transition-colors" placeholder="Film crews, prop houses..." value={genesisAudience} onChange={e => setGenesisAudience(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Core value</label>
                          <input type="text" className="w-full bg-black/60 border border-zinc-800 rounded-lg p-2.5 text-xs text-white font-mono outline-none focus:border-copernicus-phosphor transition-colors" placeholder="Same-day, local inventory..." value={genesisCoreValue} onChange={e => setGenesisCoreValue(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Stack template</label>
                        <select className="w-full bg-black/60 border border-zinc-800 rounded-lg p-2.5 text-xs text-white font-mono outline-none focus:border-copernicus-phosphor transition-colors" value={genesisStack} onChange={e => setGenesisStack(e.target.value)}>
                          <option value="react-electron">React + Electron (Desktop IDE)</option>
                          <option value="react-flask">React + Flask (Web App)</option>
                          <option value="nextjs">Next.js (Full-stack Web)</option>
                          <option value="react-native">React Native (Mobile)</option>
                          <option value="python-cli">Python CLI / Scripts</option>
                          <option value="other">Other / Custom</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* CapEx — always required */}
                  <div className="bg-black/40 border border-copernicus-steel/20 rounded-2xl p-6 space-y-4 shadow-2xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-copernicus-phosphor">
                          <DollarSign size={16} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Billing</span>
                        </div>
                        <div className="flex gap-2">
                          {(['CAPEX', 'OPEX', 'NONE'] as const).map(mode => (
                            <button key={mode} onClick={() => setBillingMode(mode)}
                              className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all border ${billingMode === mode ? 'border-copernicus-phosphor bg-copernicus-phosphor/10 text-white' : 'border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                            >{mode}</button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-zinc-700 text-2xl font-extralight">$</span>
                        <input type="number" className="bg-transparent text-4xl font-black text-white w-28 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none hover:text-copernicus-phosphor transition-colors" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} />
                        <span className="text-zinc-700 text-lg font-mono">/HR</span>
                      </div>
                    </div>

                  {error && step === 3 && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center mt-4">
                      <p className="text-xs text-red-400">{error}</p>
                    </div>
                  )}

                  {genesisLoading && (
                    <div className="flex items-center justify-center gap-3 p-4 text-copernicus-phosphor">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="text-[11px] font-bold uppercase tracking-widest">Scaffolding project and generating backlog...</span>
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
            disabled={genesisLoading || (step === 3 && wizardMode === 'existing' && !selectedProject) || (step === 3 && wizardMode === 'new' && !newProjectName.trim()) || (step === 2 && !workspacePath)}
            data-testid="wizard-next-button"
            className="group flex items-center gap-4 bg-copernicus-phosphor text-black px-12 py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.3em] transition-all hover:scale-[1.02] hover:brightness-110 active:scale-95 shadow-xl shadow-copernicus-phosphor/20 disabled:opacity-50 disabled:pointer-events-none"
          >
            {genesisLoading
              ? <><Loader2 size={14} className="animate-spin" /> Scaffolding...</>
              : step === 3 && wizardMode === 'new'
                ? <>Generate &amp; Launch <Sparkles size={16} className="group-hover:scale-110 transition-transform" /></>
                : step === 3
                  ? <>Launch COPERNICUS <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
                  : step === 2
                    ? <>Next: Project <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
                    : <>Advance <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
            }
          </button>
        </footer>
      </motion.div>
    </div>
  );
};

export default Wizard;
