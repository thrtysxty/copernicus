import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, DollarSign, Check, ArrowRight, ArrowLeft,
         ShieldCheck, Key, Zap, Github, Plus, Layout } from 'lucide-react';
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
  const [availableProjects, setAvailableProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [billingMode, setBillingMode] = useState<'CAPEX' | 'OPEX' | 'NONE'>('CAPEX');

  // Anthropic
  const [anthropicMethod, setAnthropicMethod] = useState<'cli' | 'apikey' | null>(null);
  const [anthropicKey, setAnthropicKey] = useState('');

  // Other providers
  const [googleKey, setGoogleKey] = useState('');
  const [ollamaKey, setOllamaKey] = useState('');
  const googleOAuthClientId = ''; // Static for now
  
  // GitHub
  const [githubUser, setGithubUser] = useState<{ login: string; avatar_url: string } | null>(null);

  // Fetch CLI status in background
  useEffect(() => {
    invoke<any>('check-cli-tools').then((result) => {
      setCliStatus(unwrapIpc<any>(result));
    });
  }, [invoke]);

  // Initial Load: Check for existing credentials and workspace
  useEffect(() => {
    // 1. Check Preferences (Workspace)
    invoke<any>('get-preferences').then((prefs) => {
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

  // Load projects when entering step 3
  useEffect(() => {
    if (step === 3 && workspacePath) {
      invoke<any>('fs:list-dir', workspacePath).then((result) => {
        const nodes = unwrapIpc<any[]>(result) ?? [];
        const dirs = nodes.filter(n => n.isDir).map(n => n.name);
        setAvailableProjects(dirs);
        if (dirs.length > 0 && !selectedProject) {
          setSelectedProject(dirs[0]);
        } else if (dirs.length === 0) {
          setIsCreatingNew(true);
        }
      });
    }
  }, [step, workspacePath, invoke]);

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else handleFinish();
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSelectFolder = async () => {
    try {
      const result = await invoke<any>('select-folder');
      const path = unwrapIpc<string | null>(result);
      if (path) {
        setWorkspacePath(path);
        // AC-1: Immediately sync path to system root
        await invoke('app:set-root-path', path);
      }
    } catch (error: any) {
      console.error('Folder selection failed:', error);
    }
  };

  const handleGoogleOAuth = async () => {
    try {
      await invoke<{ ok: boolean }>('app:start-oauth-listener');
    } catch (e: any) {
      console.error('OAuth start failed:', e.message);
    }
  };

  const handleGithubAuth = async () => {
    const pat = prompt('Enter your GitHub Personal Access Token (PAT):');
    if (pat) {
      try {
        await invoke('auth:store-api-key', 'github', pat);
        const res = await invoke<any>('github:test-connection');
        const user = unwrapIpc<any>(res);
        if (user) {
          setGithubUser(user);
        } else {
          alert('GitHub PAT saved, but profile fetch failed.');
        }
      } catch (e: any) {
        alert('GitHub Connection Error: ' + e.message);
      }
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
      setStep(2);
      return;
    }
    
    try {
      await invoke('save-preferences', preferences);
      
      // 4. Project Initialization
      // We pass the projectName; the backend resolves it against the workspace root.
      
      // Save billing mode for this project
      await invoke('project:save-billing', {
        id: `${githubUser?.login || 'local'}/${projectName}`,
        path: projectName,
        billing_mode: billingMode,
        billing_details: JSON.stringify({ hourly_rate: parseFloat(hourlyRate) })
      });

      // Target this repo
      await invoke('github:set-target-repo', `${githubUser?.login || 'local'}/${projectName}`);
      
      onWizardComplete();
    } catch (error: any) {
      alert(`Initialization failed: ${error.message}`);
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
          <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-[0.2em]">Step {step} of 3</div>
        </header>

        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
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
                        onClick={handleGithubAuth}
                        className="w-full bg-white/5 hover:bg-white/10 border border-zinc-800 hover:border-zinc-700 text-white py-2.5 rounded text-[11px] font-bold uppercase tracking-[0.2em] transition-all"
                      >
                        {githubUser ? 'Swap GitHub Identity' : 'Connect via PAT'}
                      </button>
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
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Google / Gemini / Jules</span>
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

              {/* ── Phase 2: File System ────────────────────────────────────── */}
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
              {step === 3 && (
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
                              placeholder="new-project-name"
                              value={newProjectName}
                              onChange={(e) => setNewProjectName(e.target.value)}
                            />
                            <p className="text-[9px] text-zinc-600 italic">Will be created in your Repository Store.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <select
                              className="w-full bg-black/60 border border-zinc-800 rounded-lg p-3 text-xs text-white font-mono outline-none focus:border-copernicus-phosphor appearance-none cursor-pointer"
                              value={selectedProject}
                              onChange={(e) => setSelectedProject(e.target.value)}
                            >
                              {availableProjects.length > 0 ? (
                                availableProjects.map(p => <option key={p} value={p}>{p}</option>)
                              ) : (
                                <option value="" disabled>No projects found in store</option>
                              )}
                            </select>
                            {availableProjects.length === 0 && (
                              <button 
                                onClick={() => setIsCreatingNew(true)}
                                className="w-full py-2 border border-dashed border-zinc-800 rounded-lg text-[9px] text-zinc-500 hover:text-zinc-300 transition-colors uppercase font-bold"
                              >
                                <Plus size={10} className="inline mr-1" /> Create First Project
                              </button>
                            )}
                          </div>
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

            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="mt-8 flex justify-between border-t border-copernicus-steel/20 pt-8 flex-none">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className={`flex items-center gap-3 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${step === 1 ? 'opacity-0 pointer-events-none' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <button
            onClick={handleNext}
            className="group flex items-center gap-4 bg-copernicus-phosphor text-black px-12 py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.3em] transition-all hover:scale-[1.02] hover:brightness-110 active:scale-95 shadow-xl shadow-copernicus-phosphor/20"
          >
            {step === 3 ? 'Initialize Core' : 'Advance'} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </footer>
      </motion.div>
    </div>
  );
};

export default Wizard;
