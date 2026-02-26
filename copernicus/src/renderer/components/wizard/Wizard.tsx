import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, Terminal, FolderOpen, DollarSign, Check, X, ArrowRight, ArrowLeft, Loader2, ExternalLink } from 'lucide-react';
import { useIpcError } from '../../hooks/useIpcError';

type OAuthState = 'idle' | 'waiting' | 'success' | 'error'

interface WizardProps {
  onComplete: () => void;
}

const Wizard: React.FC<WizardProps> = ({ onComplete }) => {
  const invoke = useIpcError();
  const [step, setStep] = useState(0);
  const [cliStatus, setCliStatus] = useState<Record<string, boolean> | null>(null);
  const [workspacePath, setWorkspacePath] = useState('');
  const [hourlyRate, setHourlyRate] = useState('65');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [googleKey, setGoogleKey] = useState('');
  const [googleOAuth, setGoogleOAuth] = useState<{ state: OAuthState; email?: string; error?: string }>({ state: 'idle' });

  // Step 0: Detect CLI Tools
  useEffect(() => {
    if (step === 0) {
      invoke<Record<string, boolean>>('check-cli-tools').then((result) => {
        setCliStatus(result);
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
    const path = await invoke<string>('select-folder');
    if (path) {
      setWorkspacePath(path);
    }
  };

  const handleOpenAuth = (url: string) => {
    invoke('app:open-external', url);
  };

  const handleGoogleOAuth = async () => {
    setGoogleOAuth({ state: 'waiting' });
    const result = await invoke<{ ok: boolean; error?: string }>('oauth:start-google');
    if (!result.ok) {
      setGoogleOAuth({ state: 'error', error: result.error });
    }
    // success is handled by the oauth:callback listener below
  };

  useEffect(() => {
    const remove = window.ipcRenderer.on('oauth:callback', (data: any) => {
      if (data.provider === 'google') {
        if (data.ok) {
          setGoogleOAuth({ state: 'success', email: data.email });
          setGoogleKey('oauth'); // sentinel — actual token stored in keychain
        } else {
          setGoogleOAuth({ state: 'error', error: data.error });
        }
      }
    });
    return () => remove();
  }, []);

  const handleFinish = async () => {
    const preferences = {
      workspace: workspacePath,
      capex: {
        rate: parseFloat(hourlyRate),
        currency: 'USD'
      },
      keys: {
        anthropic: anthropicKey,
        google: googleKey
      },
      ui: {
        theme: 'technical-phosphor'
      }
    };

    await invoke('save-preferences', preferences);
    await invoke('restart-app');
    onComplete();
  };

  const variants = {
    enter: { opacity: 0, x: 20 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-copernicus-bg text-zinc-300 font-sans select-none">
      {/* Draggable Title Region */}
      <div className="h-8 w-full flex-none" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}></div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col p-8">
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
                className="absolute w-full h-full flex flex-col justify-center"
            >
                {step === 0 && (
                <div className="space-y-6 max-w-2xl mx-auto w-full">
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
                <div className="space-y-6 max-w-2xl mx-auto w-full">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Maximize2 size={18} /> Credentials</h2>
                    <p className="text-sm text-zinc-400">Configure your AI providers (stored securely in OS Keychain).</p>

                    <div className="space-y-5">
                        {/* Anthropic — API key only (no public OAuth) */}
                        <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Anthropic</span>
                                <button
                                    onClick={() => handleOpenAuth('https://console.anthropic.com/settings/keys')}
                                    className="flex items-center gap-1 text-[10px] text-copernicus-phosphor hover:underline uppercase tracking-wide"
                                >
                                    Get API Key <ExternalLink size={10} />
                                </button>
                            </div>
                            <input
                                type="password"
                                className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white focus:border-copernicus-phosphor outline-none transition-colors"
                                placeholder="sk-ant-..."
                                value={anthropicKey}
                                onChange={(e) => setAnthropicKey(e.target.value)}
                            />
                            <p className="text-[10px] text-zinc-600">Claude.ai monthly subscribers: get a separate API key from the console above.</p>
                        </div>

                        {/* Google — full OAuth PKCE */}
                        <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Google</span>
                                {googleOAuth.state === 'success' ? (
                                    <span className="flex items-center gap-1.5 text-[10px] text-copernicus-phosphor">
                                        <Check size={11} /> Signed in{googleOAuth.email ? ` as ${googleOAuth.email}` : ''}
                                    </span>
                                ) : (
                                    <button
                                        onClick={handleGoogleOAuth}
                                        disabled={googleOAuth.state === 'waiting'}
                                        className="flex items-center gap-1.5 text-[10px] text-copernicus-phosphor hover:underline uppercase tracking-wide disabled:opacity-50"
                                    >
                                        {googleOAuth.state === 'waiting'
                                            ? <><Loader2 size={10} className="animate-spin" /> Waiting for browser...</>
                                            : 'Sign in with Google'}
                                    </button>
                                )}
                            </div>

                            {googleOAuth.state === 'idle' || googleOAuth.state === 'error' ? (
                                <>
                                    <input
                                        type="password"
                                        className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white focus:border-copernicus-phosphor outline-none transition-colors"
                                        placeholder="AIza... (or use Sign in above)"
                                        value={googleKey === 'oauth' ? '' : googleKey}
                                        onChange={(e) => setGoogleKey(e.target.value)}
                                    />
                                    {googleOAuth.state === 'error' && (
                                        <p className="text-[10px] text-red-400">{googleOAuth.error}</p>
                                    )}
                                </>
                            ) : googleOAuth.state === 'waiting' ? (
                                <p className="text-[10px] text-zinc-500 animate-pulse">Browser opened — sign in and return here automatically.</p>
                            ) : (
                                <p className="text-[10px] text-zinc-600">Token stored securely. You can also paste an API key to override.</p>
                            )}
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
      </div>
    </div>
  );
};

export default Wizard;
