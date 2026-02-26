import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, Terminal, FolderOpen, DollarSign, Check, X, ArrowRight, ArrowLeft } from 'lucide-react';
import { useIpcError } from '../../hooks/useIpcError';

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

  const handleFinish = async () => {
    const preferences = {
      workspace: workspacePath,
      capex: {
        rate: parseFloat(hourlyRate),
        currency: 'USD'
      },
      keys: {
        anthropic: anthropicKey ? 'saved' : null,
        google: googleKey ? 'saved' : null
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
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-copernicus-bg text-zinc-300 font-sans select-none p-8">
      <div className="w-full max-w-lg bg-zinc-900/50 border border-copernicus-steel/30 rounded-lg p-6 backdrop-blur-md shadow-2xl">
        <header className="mb-8 flex items-center justify-between border-b border-copernicus-steel/20 pb-4">
          <div className="flex items-center gap-2">
             <div className="w-3 h-3 bg-copernicus-phosphor rounded-full animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.5)]"></div>
             <h1 className="text-xl font-bold tracking-widest text-copernicus-phosphor uppercase">COPERNICUS SETUP</h1>
          </div>
          <div className="text-xs text-zinc-500 font-mono">Step {step + 1}/4</div>
        </header>

        <div className="min-h-[300px] relative">
            <AnimatePresence mode='wait'>
            <motion.div
                key={step}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2 }}
                className="absolute w-full"
            >
                {step === 0 && (
                <div className="space-y-4">
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
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Maximize2 size={18} /> Credentials</h2>
                    <p className="text-sm text-zinc-400">Configure your AI providers (stored securely in OS Keychain).</p>
                    
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-mono text-zinc-500 mb-1">ANTHROPIC_API_KEY</label>
                            <input 
                                type="password" 
                                className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white focus:border-copernicus-phosphor outline-none transition-colors"
                                placeholder="sk-ant-..."
                                value={anthropicKey}
                                onChange={(e) => setAnthropicKey(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-mono text-zinc-500 mb-1">GOOGLE_API_KEY</label>
                            <input 
                                type="password" 
                                className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white focus:border-copernicus-phosphor outline-none transition-colors"
                                placeholder="AIza..."
                                value={googleKey}
                                onChange={(e) => setGoogleKey(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
                )}

                {step === 2 && (
                <div className="space-y-4">
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
                <div className="space-y-4">
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

        <footer className="mt-8 flex justify-between border-t border-copernicus-steel/20 pt-4">
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
