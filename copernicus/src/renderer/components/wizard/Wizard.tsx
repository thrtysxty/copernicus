import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, DollarSign, Check, ArrowRight, ArrowLeft,
         Loader2, ExternalLink, ShieldCheck, Cpu, Key, Zap, Github } from 'lucide-react';
import { useIpcError } from '../../hooks/useIpcError';
import { unwrapIpc } from '../../types/ipc'

type OAuthState = 'idle' | 'waiting' | 'success' | 'error'

interface WizardProps {
  onComplete: () => void;
}

const Wizard: React.FC<WizardProps> = ({ onComplete: onWizardComplete }) => {
  const invoke = useIpcError();
  const [step, setStep] = useState(1);
  const [cliStatus, setCliStatus] = useState<Record<string, boolean> | null>(null);
  const [workspacePath, setWorkspacePath] = useState('');
  const [hourlyRate, setHourlyRate] = useState('65');

  // Anthropic: user explicitly picks CLI or API key
  const [anthropicMethod, setAnthropicMethod] = useState<'cli' | 'apikey' | null>(null);
  const [anthropicKey, setAnthropicKey] = useState('');

  // Other providers
  const [googleKey, setGoogleKey] = useState('');
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [deepInfraKey, setDeepInfraKey] = useState('');
  const [ollamaKey, setOllamaKey] = useState('');
  const [googleOAuthClientId, setGoogleOAuthClientId] = useState('');
  const [googleOAuth, setGoogleOAuth] = useState<{ state: OAuthState; email?: string; error?: string }>({ state: 'idle' });
  const [openRouterOAuth, setOpenRouterOAuth] = useState<{ state: OAuthState; error?: string }>({ state: 'idle' });
  
  // GitHub
  const [githubUser, setGithubUser] = useState<{ login: string; avatar_url: string } | null>(null);

  // Fetch CLI status in background
  useEffect(() => {
    invoke<any>('check-cli-tools').then((result) => {
      setCliStatus(unwrapIpc<any>(result));
    });
  }, [invoke]);

  // Step 1: Check for existing credentials
  useEffect(() => {
    if (step === 1) {
      invoke<any>('auth:status').then((raw) => {
        const status: any[] = unwrapIpc<any>(raw) ?? []
        status.forEach(p => {
          if (p.hasKey) {
            if (p.provider === 'anthropic') {
              if (p.type === 'cli') setAnthropicMethod('cli')
              else { setAnthropicMethod('apikey'); setAnthropicKey('saved') }
            }
            if (p.provider === 'google') setGoogleKey('saved');
            if (p.provider === 'openrouter') setOpenRouterKey('saved');
            if (p.provider === 'deepinfra') setDeepInfraKey('saved');
            if (p.provider === 'github') {
               invoke<any>('github:test-connection').then(res => setGithubUser(unwrapIpc<any>(res)));
            }
          }
        });
      });
      
      // Check for Ollama Cloud Key
      invoke<any>('auth:get-api-key', 'ollama').then((res: any) => {
        if (unwrapIpc<any>(res)) setOllamaKey('saved');
      });
    }
  }, [step, invoke]);

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else handleFinish();
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSelectFolder = async () => {
    try {
      const _rawPath = await invoke<any>('select-folder');
      const path: string | null = unwrapIpc<any>(_rawPath);
      if (path) {
        setWorkspacePath(path);
        // Save the directory immediately to ensure persistence
        await invoke('app:set-root-path', path);
      }
    } catch (error: any) {
      console.error('Failed to select folder:', error);
    }
  };

  const handleGoogleOAuth = async () => {
    setGoogleOAuth({ state: 'waiting' });
    try {
      await invoke<{ ok: boolean }>('app:start-oauth-listener');
    } catch (e: any) {
      setGoogleOAuth({ state: 'error', error: e.message });
    }
  };

  const handleOpenRouterOAuth = async () => {
    setOpenRouterOAuth({ state: 'waiting' });
    const result = await invoke<{ ok: boolean; error?: string }>('oauth:start-openrouter');
    if (!(result as any).ok) {
      setOpenRouterOAuth({ state: 'error', error: (result as any).error });
    }
  };

  const handleGithubAuth = async () => {
    // For now, prompt for PAT if not already handled by a dedicated flow
    const pat = prompt('Please enter your GitHub Personal Access Token (PAT):');
    if (pat) {
      try {
        await invoke('auth:store-api-key', 'github', pat);
        const res = await invoke<any>('github:test-connection');
        setGithubUser(unwrapIpc<any>(res));
      } catch (e) {
        alert('Failed to connect to GitHub. Check your token.');
      }
    }
  };

  useEffect(() => {
    const removeGoogle = window.ipcRenderer.on('oauth:google-complete', (_event: any, data: any) => {
      if (data.ok) { setGoogleOAuth({ state: 'success', email: data.email }); setGoogleKey('oauth'); }
      else setGoogleOAuth({ state: 'error', error: data.error });
    });
    const removeLegacy = window.ipcRenderer.on('oauth:callback', (_event: any, data: any) => {
      if (data.provider === 'google') {
        if (data.ok) { setGoogleOAuth({ state: 'success', email: data.email }); setGoogleKey('oauth'); }
        else setGoogleOAuth({ state: 'error', error: data.error });
      } else if (data.provider === 'openrouter') {
        if (data.ok) { setOpenRouterOAuth({ state: 'success' }); setOpenRouterKey('oauth'); }
        else setOpenRouterOAuth({ state: 'error', error: data.error });
      }
    });
    return () => { removeGoogle(); removeLegacy(); };
  }, []);

  const handleFinish = async () => {
    // Save Anthropic method
    if (anthropicMethod === 'cli') {
      await invoke('auth:store-api-key', 'anthropic', '__cli__', undefined, 'cli').catch(() => {})
    } else if (anthropicMethod === 'apikey' && anthropicKey && anthropicKey !== 'saved') {
      await invoke('auth:store-api-key', 'anthropic', anthropicKey).catch(() => {})
    }
    
    // Save Ollama Cloud key if provided
    if (ollamaKey && ollamaKey !== 'saved') {
      await invoke('auth:store-api-key', 'ollama', ollamaKey).catch(() => {})
    }

    const preferences = {
      workspace: workspacePath,
      googleOAuthClientId: googleOAuthClientId.trim(),
      capex: { rate: parseFloat(hourlyRate), currency: 'USD' },
      keys: { google: googleKey, openrouter: openRouterKey, deepinfra: deepInfraKey },
      ui: { theme: 'technical-phosphor' }
    };
    
    // Validate workspace path before saving
    if (!workspacePath) {
      alert('Please select a workspace directory before completing setup.');
      setStep(2); // Navigate back to workspace step
      return;
    }
    
    try {
      await invoke('save-preferences', preferences);
      onWizardComplete();
    } catch (error: any) {
      console.error('Failed to save preferences:', error);
      alert(`Failed to save preferences: ${error.message}`);
    }
  };

  const claudeDetected = cliStatus?.claude === true;

  const variants = {
    enter: { opacity: 0, x: 20 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-copernicus-bg text-zinc-300 font-sans select-none">
      <div className="h-8 w-full flex-none pl-20" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col p-8 overflow-hidden">
        <header className="mb-8 flex items-center justify-between border-b border-copernicus-steel/20 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-copernicus-phosphor rounded-full animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.5)]" />
            <h1 className="text-xl font-bold tracking-widest text-copernicus-phosphor uppercase">COPERNICUS SETUP</h1>
          </div>
          <div className="text-xs text-zinc-500 font-mono">Step {step}/3</div>
        </header>

        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="absolute w-full h-full flex flex-col overflow-y-auto pr-4"
            >

              {/* ── Step 1: Credentials ─────────────────────────────────────── */}
              {step === 1 && (
                <div className="space-y-6 max-w-2xl mx-auto w-full py-4">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Key size={18} /> Credentials & Accounts
                    </h2>
                    <p className="text-sm text-zinc-400 font-mono tracking-tighter uppercase opacity-60">Identity Management // V0.1</p>
                  </div>

                  <div className="space-y-5">
                    {/* ── Anthropic ──────────────────────────────────────────── */}
                    <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-4">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                        <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Anthropic / Claude</span>
                        {anthropicMethod && (
                          <span className="flex items-center gap-1.5 text-[10px] text-copernicus-phosphor">
                            <Check size={11} />
                            {anthropicMethod === 'cli' ? 'Claude Code CLI selected' : 'API key saved'}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-zinc-500 leading-relaxed">
                        Choose how COPERNICUS connects to Claude. You can change this later in Settings → Providers.
                      </p>

                      {/* Option A: Claude Code CLI */}
                      <button
                        onClick={() => setAnthropicMethod('cli')}
                        disabled={!claudeDetected}
                        className={`w-full text-left p-3 rounded border transition-all ${
                          anthropicMethod === 'cli'
                            ? 'border-copernicus-phosphor bg-copernicus-phosphor/10 text-white'
                            : claudeDetected
                              ? 'border-zinc-700 hover:border-zinc-500 text-zinc-300'
                              : 'border-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Zap size={14} className={anthropicMethod === 'cli' ? 'text-copernicus-phosphor' : 'text-zinc-500'} />
                            <span className="text-[11px] font-bold uppercase tracking-wide">Use Claude Code (recommended)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {claudeDetected
                              ? <span className="text-[9px] bg-copernicus-phosphor/20 text-copernicus-phosphor px-1.5 py-0.5 rounded">DETECTED</span>
                              : <span className="text-[9px] bg-zinc-800 text-zinc-600 px-1.5 py-0.5 rounded">NOT FOUND</span>
                            }
                            {anthropicMethod === 'cli' && <Check size={13} className="text-copernicus-phosphor" />}
                          </div>
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-1.5 ml-6">
                          Uses your existing <code className="text-zinc-400">claude login</code> session — no separate API key needed.
                        </p>
                      </button>

                      {/* Option B: API Key */}
                      <div
                        className={`p-3 rounded border transition-all ${
                          anthropicMethod === 'apikey'
                            ? 'border-copernicus-phosphor bg-copernicus-phosphor/10'
                            : 'border-zinc-700 hover:border-zinc-600'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Key size={14} className={anthropicMethod === 'apikey' ? 'text-copernicus-phosphor' : 'text-zinc-500'} />
                            <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-300">Use API Key</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => invoke('app:open-external', 'https://console.anthropic.com/settings/keys')}
                              className="text-[9px] text-zinc-500 hover:text-white flex items-center gap-1"
                            >
                              Get key <ExternalLink size={8} />
                            </button>
                            {anthropicMethod === 'apikey' && <Check size={13} className="text-copernicus-phosphor" />}
                          </div>
                        </div>
                        <div className="relative">
                          <input
                            type="password"
                            className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white focus:border-copernicus-phosphor outline-none transition-colors"
                            placeholder={anthropicKey === 'saved' ? 'API key already saved' : 'sk-ant-api03-…'}
                            value={anthropicKey === 'saved' ? '' : anthropicKey}
                            onChange={(e) => {
                              setAnthropicKey(e.target.value);
                              if (e.target.value) setAnthropicMethod('apikey');
                            }}
                            onFocus={() => { if (anthropicMethod !== 'apikey') setAnthropicMethod('apikey') }}
                          />
                          {(anthropicKey === 'saved' || (anthropicMethod === 'apikey' && anthropicKey)) && (
                            <div className="absolute right-2 top-2 text-copernicus-phosphor">
                              <ShieldCheck size={16} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ── GitHub ──────────────────────────────────────────────── */}
                    <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                        <div className="flex items-center gap-2">
                          <Github size={14} className="text-zinc-400" />
                          <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">GitHub Connection</span>
                        </div>
                        {githubUser ? (
                          <span className="flex items-center gap-1.5 text-[10px] text-copernicus-phosphor">
                            <Check size={11} /> Connected as {githubUser.login}
                          </span>
                        ) : (
                          <button
                            onClick={handleGithubAuth}
                            className="text-[10px] text-copernicus-phosphor hover:bg-copernicus-phosphor/10 px-2 py-1 rounded border border-copernicus-phosphor/30 uppercase tracking-wide transition-all"
                          >
                            Connect GitHub
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-500 leading-relaxed italic">
                        Required for repository management, Jules session synchronization, and PR automation.
                      </p>
                    </div>

                    {/* ── Ollama Cloud ────────────────────────────────────────── */}
                    <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                        <div className="flex items-center gap-2">
                          <Zap size={14} className="text-copernicus-phosphor" />
                          <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Ollama Cloud (High-Intel)</span>
                        </div>
                        {ollamaKey === 'saved' && (
                          <span className="flex items-center gap-1.5 text-[10px] text-copernicus-phosphor">
                            <Check size={11} /> Token active
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type="password"
                          className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white focus:border-copernicus-phosphor outline-none transition-colors"
                          placeholder={ollamaKey === 'saved' ? 'Token already saved' : 'Ollama Bearer Token'}
                          value={ollamaKey === 'saved' ? '' : ollamaKey}
                          onChange={(e) => setOllamaKey(e.target.value)}
                        />
                        {(ollamaKey === 'saved' || ollamaKey) && (
                          <div className="absolute right-2 top-2 text-copernicus-phosphor">
                            <ShieldCheck size={16} />
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-600 font-mono tracking-tighter">
                        Enables the Architect, Researcher, and Thinker personas via high-tier cloud infrastructure.
                      </p>
                    </div>

                    {/* ── Google / Gemini / Jules ─────────────────────────────── */}
                    <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                        <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Google / Gemini / Jules</span>
                        {googleOAuth.state === 'success'
                          ? <span className="flex items-center gap-1.5 text-[10px] text-copernicus-phosphor"><Check size={11} /> Authenticated{googleOAuth.email ? ` as ${googleOAuth.email}` : ''}</span>
                          : (
                            <button
                              onClick={handleGoogleOAuth}
                              disabled={googleOAuth.state === 'waiting'}
                              className="flex items-center gap-1.5 text-[10px] text-copernicus-phosphor hover:bg-copernicus-phosphor/10 px-2 py-1 rounded border border-copernicus-phosphor/30 uppercase tracking-wide transition-all disabled:opacity-50"
                            >
                              {googleOAuth.state === 'waiting' ? <><Loader2 size={10} className="animate-spin" /> Waiting...</> : 'Sign in with Google'}
                            </button>
                          )
                        }
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] text-zinc-500 uppercase tracking-tight">OAuth Client ID (Optional)</label>
                          <button onClick={() => invoke('app:open-external', 'https://console.cloud.google.com/apis/credentials')} className="text-[9px] text-zinc-500 hover:text-white flex items-center gap-1 underline">
                            Create your own <ExternalLink size={8} />
                          </button>
                        </div>
                        <input
                          type="text"
                          className="w-full bg-black/60 border border-copernicus-steel/40 rounded p-2 text-xs text-white focus:border-copernicus-phosphor outline-none font-mono"
                          placeholder="Leave blank to use default Copernicus Client"
                          value={googleOAuthClientId}
                          onChange={(e) => setGoogleOAuthClientId(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* ── Pro Providers ───────────────────────────────────────── */}
                    <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-4">
                      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
                        <Cpu size={14} className="text-zinc-500" />
                        <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Pro Providers (API Keys)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] text-zinc-500 uppercase tracking-tight">OpenRouter</label>
                            {openRouterOAuth.state === 'success'
                              ? <Check size={10} className="text-copernicus-phosphor" />
                              : <button onClick={handleOpenRouterOAuth} disabled={openRouterOAuth.state === 'waiting'} className="text-[8px] text-copernicus-phosphor hover:underline uppercase disabled:opacity-50">
                                  {openRouterOAuth.state === 'waiting' ? '...' : 'Sign in'}
                                </button>
                            }
                          </div>
                          <div className="relative">
                            <input
                              type="password"
                              className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white focus:border-copernicus-phosphor outline-none transition-colors"
                              placeholder={openRouterKey === 'saved' ? 'Detected' : 'sk-or-…'}
                              value={openRouterKey === 'oauth' || openRouterKey === 'saved' ? '' : openRouterKey}
                              onChange={(e) => setOpenRouterKey(e.target.value)}
                            />
                            {(openRouterKey === 'oauth' || openRouterKey === 'saved') && (
                              <div className="absolute right-2 top-2 text-copernicus-phosphor"><ShieldCheck size={12} /></div>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] text-zinc-500 uppercase tracking-tight">DeepInfra</label>
                            <button onClick={() => invoke('app:open-external', 'https://deepinfra.com/dash/api_keys')} className="text-[8px] text-zinc-600 hover:text-white underline">Get Key</button>
                          </div>
                          <div className="relative">
                            <input
                              type="password"
                              className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white focus:border-copernicus-phosphor outline-none transition-colors"
                              placeholder={deepInfraKey === 'saved' ? 'Detected' : 'API Key'}
                              value={deepInfraKey === 'saved' ? '' : deepInfraKey}
                              onChange={(e) => setDeepInfraKey(e.target.value)}
                            />
                            {deepInfraKey === 'saved' && <div className="absolute right-2 top-2 text-copernicus-phosphor"><ShieldCheck size={12} /></div>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 2: Workspace ───────────────────────────────────────── */}
              {step === 2 && (
                <div className="space-y-6 max-w-2xl mx-auto w-full py-8">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2"><FolderOpen size={18} /> Workspace Setup</h2>
                  <p className="text-sm text-zinc-400">Where should COPERNICUS store your projects and memory?</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      className="flex-1 bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-zinc-400 font-mono truncate"
                      value={workspacePath || 'No folder selected'}
                    />
                    <button onClick={handleSelectFolder} className="bg-copernicus-steel/20 hover:bg-copernicus-steel/40 text-white px-3 py-2 rounded border border-copernicus-steel/30 transition-colors">
                      Browse
                    </button>
                  </div>
                  {workspacePath && (
                    <div className="bg-green-900/10 border border-green-700/30 rounded p-3 text-[11px] text-green-400 leading-relaxed">
                      Workspace directory selected: <code className="text-green-300 font-mono">{workspacePath}</code>
                    </div>
                  )}
                </div>
              )}

              {/* ── Step 3: CapEx ───────────────────────────────────────────── */}
              {step === 3 && (
                <div className="space-y-6 max-w-2xl mx-auto w-full py-8">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2"><DollarSign size={18} /> CapEx Setup</h2>
                  <p className="text-sm text-zinc-400">Set your hourly rate for development cost tracking.</p>
                  <div className="flex items-center gap-4 bg-black/40 p-4 rounded border border-copernicus-steel/20">
                    <span className="text-2xl text-copernicus-phosphor">$</span>
                    <input
                      type="number"
                      className="bg-transparent text-4xl font-bold text-white w-32 outline-none"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(e.target.value)}
                    />
                    <span className="text-zinc-500 text-xl">/ hour</span>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="mt-8 flex justify-between border-t border-copernicus-steel/20 pt-4 flex-none">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className={`flex items-center gap-2 px-4 py-2 rounded text-sm transition-colors ${step === 1 ? 'opacity-0 cursor-default' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
          >
            <ArrowLeft size={16} /> Back
          </button>
          <button
            onClick={handleNext}
            className="flex items-center gap-2 bg-copernicus-phosphor/10 hover:bg-copernicus-phosphor/20 text-copernicus-phosphor border border-copernicus-phosphor/50 px-6 py-2 rounded text-sm font-semibold transition-all"
          >
            {step === 3 ? 'Finish' : 'Next'} <ArrowRight size={16} />
          </button>
        </footer>
      </motion.div>
    </div>
  );
};

export default Wizard;
