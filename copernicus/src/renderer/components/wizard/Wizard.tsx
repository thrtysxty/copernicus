import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, Terminal, FolderOpen, DollarSign, Check, X, ArrowRight, ArrowLeft, Loader2, ExternalLink, ShieldCheck, Cpu } from 'lucide-react';
import { useIpcError } from '../../hooks/useIpcError';

type OAuthState = 'idle' | 'waiting' | 'success' | 'error'

interface WizardProps {
  onComplete: () => void;
}

const Wizard: React.FC<WizardProps> = ({ onComplete: onWizardComplete }) => {
  const invoke = useIpcError();
  const [step, setStep] = useState(0);
  const [cliStatus, setCliStatus] = useState<Record<string, boolean> | null>(null);
  const [workspacePath, setWorkspacePath] = useState('');
  const [hourlyRate, setHourlyRate] = useState('65');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [googleKey, setGoogleKey] = useState('');
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [deepInfraKey, setDeepInfraKey] = useState('');
  const [googleOAuthClientId, setGoogleOAuthClientId] = useState('');
  const [googleOAuth, setGoogleOAuth] = useState<{ state: OAuthState; email?: string; error?: string }>({ state: 'idle' });
  const [anthropicOAuth, setAnthropicOAuth] = useState<{ state: OAuthState; error?: string }>({ state: 'idle' });
  const [openRouterOAuth, setOpenRouterOAuth] = useState<{ state: OAuthState; error?: string }>({ state: 'idle' });
  const [showAnthropicWebview, setShowAnthropicWebview] = useState(false);

  // Step 0: Detect CLI Tools
  useEffect(() => {
    if (step === 0) {
      invoke<any>('check-cli-tools').then((result) => {
        setCliStatus((result as any)?.data ?? result);
      });
    }
  }, [step, invoke]);

  // Check for existing credentials when entering Step 1
  useEffect(() => {
    if (step === 1) {
      invoke<any>('auth:status').then((raw) => {
        const status: any[] = (raw as any)?.data ?? raw ?? []
        status.forEach(p => {
          if (p.hasKey) {
            if (p.provider === 'anthropic') setAnthropicKey('saved');
            if (p.provider === 'google') setGoogleKey('saved');
            if (p.provider === 'openrouter') setOpenRouterKey('saved');
            if (p.provider === 'deepinfra') setDeepInfraKey('saved');
          }
        });
      });
    }
  }, [step, invoke]);

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleSelectFolder = async () => {
    const _rawPath = await invoke<any>('select-folder');
    const path: string | null = (_rawPath as any)?.data ?? _rawPath;
    if (path) {
      setWorkspacePath(path);
    }
  };

  const handleOpenAuth = (url: string) => {
    if (url.includes('claude.ai')) {
      setShowAnthropicWebview(true);
    } else {
      invoke('app:open-external', url);
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

  const handleAnthropicOAuth = async () => {
    setAnthropicOAuth({ state: 'waiting' });
    const result = await invoke<{ ok: boolean; error?: string }>('oauth:start-anthropic');
    if (!result.ok) {
      setAnthropicOAuth({ state: 'error', error: result.error });
    }
  };

  const handleOpenRouterOAuth = async () => {
    setOpenRouterOAuth({ state: 'waiting' });
    const result = await invoke<{ ok: boolean; error?: string }>('oauth:start-openrouter');
    if (!result.ok) {
      setOpenRouterOAuth({ state: 'error', error: result.error });
    }
  };

  useEffect(() => {
    const removeGoogle = window.ipcRenderer.on('oauth:google-complete', (_event: any, data: any) => {
      if (data.ok) {
        setGoogleOAuth({ state: 'success', email: data.email });
        setGoogleKey('oauth');
      } else {
        setGoogleOAuth({ state: 'error', error: data.error });
      }
    });

    const removeLegacy = window.ipcRenderer.on('oauth:callback', (_event: any, data: any) => {
      if (data.provider === 'google') {
        if (data.ok) {
          setGoogleOAuth({ state: 'success', email: data.email });
          setGoogleKey('oauth');
        } else {
          setGoogleOAuth({ state: 'error', error: data.error });
        }
      } else if (data.provider === 'anthropic') {
        if (data.ok) {
          setAnthropicOAuth({ state: 'success' });
          setAnthropicKey('oauth');
        } else {
          setAnthropicOAuth({ state: 'error', error: data.error });
        }
      } else if (data.provider === 'openrouter') {
        if (data.ok) {
          setOpenRouterOAuth({ state: 'success' });
          setOpenRouterKey('oauth');
        } else {
          setOpenRouterOAuth({ state: 'error', error: data.error });
        }
      }
    });
    return () => {
      removeGoogle();
      removeLegacy();
    };
  }, []);

  const handleFinish = async () => {
    const preferences = {
      workspace: workspacePath,
      googleOAuthClientId: googleOAuthClientId.trim(),
      capex: {
        rate: parseFloat(hourlyRate),
        currency: 'USD'
      },
      keys: {
        anthropic: anthropicKey,
        google: googleKey,
        openrouter: openRouterKey,
        deepinfra: deepInfraKey
      },
      ui: {
        theme: 'technical-phosphor'
      }
    };

    await invoke('save-preferences', preferences);
    // REMOVED: restart-app - we now transition smoothly
    onWizardComplete();
  };

  const variants = {
    enter: { opacity: 0, x: 20 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-copernicus-bg text-zinc-300 font-sans select-none">
      {/* Draggable Title Region */}
      <div className="h-8 w-full flex-none pl-20" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}></div>

      {/* Anthropic claude.ai webview overlay */}
      {showAnthropicWebview && (
        <div className="absolute inset-0 z-50 flex flex-col bg-[#050505]">
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-[#0A0A0A]">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">claude.ai — Session Auth</span>
            <button
              onClick={() => setShowAnthropicWebview(false)}
              className="text-zinc-500 hover:text-zinc-200 transition-colors text-[10px] font-mono uppercase"
            >
              ✕ Close
            </button>
          </div>
          {/* @ts-ignore — webview is a native Electron element */}
          <webview
            src="https://claude.ai"
            partition="persist:claude"
            style={{ flex: 1, width: '100%' }}
          />
        </div>
      )}

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-1 flex flex-col p-8"
      >
        <header className="mb-8 flex items-center justify-between border-b border-copernicus-steel/20 pb-4">
          <div className="flex items-center gap-2">
             <div className="w-3 h-3 bg-copernicus-phosphor rounded-full animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.5)]"></div>
             <h1 className="text-xl font-bold tracking-widest text-copernicus-phosphor uppercase">COPERNICUS SETUP</h1>
          </div>
          <div className="text-xs text-zinc-500 font-mono">Step {step + 1}/4</div>
        </header>

        <div className="flex-1 relative">
            <AnimatePresence mode='wait'>
            <motion.div
                key={step}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2 }}
                className="absolute w-full h-full flex flex-col overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-copernicus-steel"
            >
                {step === 0 && (
                <div className="space-y-6 max-w-2xl mx-auto w-full py-8">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Terminal size={18} /> CLI Tool Detection</h2>
                    <p className="text-sm text-zinc-400">Scanning your environment for required AI agents...</p>

                    <div className="bg-black/40 rounded p-4 font-mono text-xs space-y-2 border border-copernicus-steel/20">
                    {cliStatus ? Object.entries(cliStatus).map(([tool, found]) => (
                        <div key={tool} className="flex items-center justify-between">
                        <span className="uppercase">{tool}</span>
                        {found ? (
                            <span className="text-copernicus-phosphor flex items-center gap-1"><Check size={12} /> FOUND</span>
                        ) : (
                            <span className="text-red-400 flex items-center gap-1"><X size={12} /> MISSING</span>
                        )}
                        </div>
                    )) : (
                        <div className="text-zinc-500 animate-pulse">Scanning...</div>
                    )}
                    </div>
                </div>
                )}

                {step === 1 && (
                <div className="space-y-6 max-w-2xl mx-auto w-full py-8">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Maximize2 size={18} /> Credentials</h2>
                    <p className="text-sm text-zinc-400">Configure your AI providers (stored securely in OS Keychain).</p>

                    <div className="space-y-5">
                        {/* Anthropic */}
                        <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3">
                            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                                <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Anthropic</span>
                                <div className="flex items-center gap-3">
                                    {anthropicOAuth.state === 'success' ? (
                                        <span className="flex items-center gap-1.5 text-[10px] text-copernicus-phosphor">
                                            <Check size={11} /> Session Authenticated
                                        </span>
                                    ) : (
                                        <button
                                            onClick={handleAnthropicOAuth}
                                            disabled={anthropicOAuth.state === 'waiting'}
                                            className="flex items-center gap-1.5 text-[10px] text-copernicus-phosphor hover:bg-copernicus-phosphor/10 px-2 py-1 rounded border border-copernicus-phosphor/30 uppercase tracking-wide transition-all disabled:opacity-50"
                                        >
                                            {anthropicOAuth.state === 'waiting'
                                                ? <><Loader2 size={10} className="animate-spin" /> Waiting...</>
                                                : 'Sign in with Anthropic'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] text-zinc-500 uppercase tracking-tight block">Direct API Key (Optional Override)</label>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleOpenAuth('https://console.anthropic.com/settings/keys')}
                                            className="flex items-center gap-1 text-[9px] text-zinc-500 hover:text-white uppercase tracking-wide"
                                        >
                                            Get API Key <ExternalLink size={8} />
                                        </button>
                                        <span className="text-zinc-800 text-[8px]">|</span>
                                        <button
                                            onClick={() => handleOpenAuth('https://claude.ai/settings')}
                                            className="flex items-center gap-1 text-[9px] text-zinc-500 hover:text-white uppercase tracking-wide"
                                        >
                                            Claude.ai account <ExternalLink size={8} />
                                        </button>
                                    </div>
                                </div>
                                <div className="relative">
                                    <input
                                        type="password"
                                        className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white focus:border-copernicus-phosphor outline-none transition-colors"
                                        placeholder={anthropicKey === 'saved' ? 'Detected from Environment/System' : 'sk-ant-... (API key from developer console)'}
                                        value={anthropicKey === 'oauth' || anthropicKey === 'saved' ? '' : anthropicKey}
                                        onChange={(e) => setAnthropicKey(e.target.value)}
                                    />
                                    {(anthropicKey === 'oauth' || anthropicKey === 'saved') && (
                                        <div className="absolute right-2 top-2 text-copernicus-phosphor" title="Using Browser Session or Saved Key">
                                            <ShieldCheck size={16} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {anthropicOAuth.state === 'error' && (
                                <p className="text-[10px] text-red-400 bg-red-900/10 border border-red-900/20 p-2 rounded">{anthropicOAuth.error}</p>
                            )}

                            <p className="text-[10px] text-zinc-600 leading-relaxed">
                                API key holders: paste above. Monthly Claude.ai subscribers: click "Sign in" to use your browser session.
                            </p>
                        </div>

                        {/* Google */}
                        <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3">
                            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                                <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Google / Gemini / Jules</span>
                                {googleOAuth.state === 'success' ? (
                                    <span className="flex items-center gap-1.5 text-[10px] text-copernicus-phosphor">
                                        <Check size={11} /> Authenticated{googleOAuth.email ? ` as ${googleOAuth.email}` : ''}
                                    </span>
                                ) : (
                                    <button
                                        onClick={handleGoogleOAuth}
                                        disabled={googleOAuth.state === 'waiting'}
                                        className="flex items-center gap-1.5 text-[10px] text-copernicus-phosphor hover:bg-copernicus-phosphor/10 px-2 py-1 rounded border border-copernicus-phosphor/30 uppercase tracking-wide transition-all disabled:opacity-50"
                                    >
                                        {googleOAuth.state === 'waiting'
                                            ? <><Loader2 size={10} className="animate-spin" /> Waiting...</>
                                            : 'Sign in with Google'}
                                    </button>
                                )}
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] text-zinc-500 uppercase tracking-tight">OAuth Client ID (Optional)</label>
                                    <button
                                        onClick={() => handleOpenAuth('https://console.cloud.google.com/apis/credentials')}
                                        className="text-[9px] text-zinc-500 hover:text-white flex items-center gap-1 underline"
                                    >
                                        Create your own <ExternalLink size={8} />
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    className={`w-full bg-black/60 border rounded p-2 text-xs text-white focus:border-copernicus-phosphor outline-none transition-colors font-mono ${googleOAuth.state === 'error' ? 'border-red-500/50' : 'border-copernicus-steel/40'}`}
                                    placeholder="Leave blank to use default Copernicus Client"
                                    value={googleOAuthClientId}
                                    onChange={(e) => {
                                        setGoogleOAuthClientId(e.target.value);
                                        if (googleOAuth.state === 'error') setGoogleOAuth({ state: 'idle' });
                                    }}
                                />
                            </div>

                            {googleOAuth.state === 'error' && (
                                <p className="text-[10px] text-red-400 bg-red-900/10 border border-red-900/20 p-2 rounded">{googleOAuth.error}</p>
                            )}

                            <div className="pt-2 border-t border-zinc-800">
                                <label className="text-[10px] text-zinc-500 uppercase tracking-tight block mb-1">Direct API Key (Optional Override)</label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white focus:border-copernicus-phosphor outline-none transition-colors"
                                        placeholder={googleKey === 'saved' ? 'Detected from Environment/System' : 'AIza... (from Google AI Studio)'}
                                        value={googleKey === 'oauth' || googleKey === 'saved' ? '' : googleKey}
                                        onChange={(e) => setGoogleKey(e.target.value)}
                                    />
                                    {(googleKey === 'oauth' || googleKey === 'saved') && (
                                        <div className="absolute right-2 top-2 text-copernicus-phosphor" title="Using Browser Session or Saved Key">
                                            <ShieldCheck size={16} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Pro Providers (OpenRouter / DeepInfra) */}
                        <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-4">
                            <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
                                <Cpu size={14} className="text-zinc-500" />
                                <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Pro Providers (API Keys)</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-[10px] text-zinc-500 uppercase tracking-tight">OpenRouter</label>
                                        {openRouterOAuth.state === 'success' ? (
                                            <Check size={10} className="text-copernicus-phosphor" />
                                        ) : (
                                            <button
                                                onClick={handleOpenRouterOAuth}
                                                disabled={openRouterOAuth.state === 'waiting'}
                                                className="text-[8px] text-copernicus-phosphor hover:underline uppercase transition-all disabled:opacity-50"
                                            >
                                                {openRouterOAuth.state === 'waiting' ? '...' : 'Sign in'}
                                            </button>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="password"
                                            className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white focus:border-copernicus-phosphor outline-none transition-colors"
                                            placeholder={openRouterKey === 'saved' ? 'Detected' : 'sk-or-...'}
                                            value={openRouterKey === 'oauth' || openRouterKey === 'saved' ? '' : openRouterKey}
                                            onChange={(e) => setOpenRouterKey(e.target.value)}
                                        />
                                        {(openRouterKey === 'oauth' || openRouterKey === 'saved') && (
                                            <div className="absolute right-2 top-2 text-copernicus-phosphor">
                                                <ShieldCheck size={12} />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] text-zinc-500 uppercase tracking-tight">DeepInfra</label>
                                        <button onClick={() => handleOpenAuth('https://deepinfra.com/dash/api_keys')} className="text-[8px] text-zinc-600 hover:text-white underline">Get Key</button>
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

                {step === 2 && (
                <div className="space-y-6 max-w-2xl mx-auto w-full">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2"><FolderOpen size={18} /> Workspace Setup</h2>
                    <p className="text-sm text-zinc-400">Where should COPERNICUS store your projects and memory?</p>

                    <div className="flex gap-2">
                        <input
                            type="text"
                            readOnly
                            className="flex-1 bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-zinc-400 font-mono truncate"
                            value={workspacePath || "No folder selected"}
                        />
                        <button
                            onClick={handleSelectFolder}
                            className="bg-copernicus-steel/20 hover:bg-copernicus-steel/40 text-white px-3 py-2 rounded border border-copernicus-steel/30 transition-colors"
                        >
                            Browse
                        </button>
                    </div>
                </div>
                )}

                {step === 3 && (
                <div className="space-y-6 max-w-2xl mx-auto w-full">
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
                disabled={step === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded text-sm transition-colors ${step === 0 ? 'opacity-0 cursor-default' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
            >
                <ArrowLeft size={16} /> Back
            </button>

            <button
                onClick={handleNext}
                className="flex items-center gap-2 bg-copernicus-phosphor/10 hover:bg-copernicus-phosphor/20 text-copernicus-phosphor border border-copernicus-phosphor/50 px-6 py-2 rounded text-sm font-semibold transition-all shadow-[0_0_15px_rgba(74,222,128,0.1)] hover:shadow-[0_0_20px_rgba(74,222,128,0.3)]"
            >
                {step === 3 ? 'Finish' : 'Next'} <ArrowRight size={16} />
            </button>
        </footer>
      </motion.div>
    </div>
  );
};

export default Wizard;
