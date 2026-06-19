import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { useIpcError } from '../../hooks/useIpcError';
import GenesisWizard from '../genesis/GenesisWizard';
import { WizardNarration } from './WizardNarration';
import { useWizardFlow } from '../../hooks/useWizardFlow';
import { AuthStep } from './steps/AuthStep';
import { StoreStep } from './steps/StoreStep';
import { ProjectStep } from './steps/ProjectStep';
import { BillingStep } from './steps/BillingStep';

interface WizardProps {
  onComplete: (workspacePath: string) => void;
}

const Wizard: React.FC<WizardProps> = ({ onComplete }) => {
  const invoke = useIpcError();
  const { state, updateState, ...handlers } = useWizardFlow(onComplete);
  const [showGenesisModal, setShowGenesisModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNext = () => {
    const result = handlers.handleNext(setError);
    if (result === 'showGenesisModal') {
      setShowGenesisModal(true);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-copernicus-bg text-zinc-300 font-sans select-none overflow-hidden">
      <div className="h-8 w-full flex-none pl-20" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col p-8 overflow-hidden">
        <header className="mb-8 flex items-center justify-between border-b border-copernicus-steel/20 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-copernicus-phosphor rounded-full animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.5)]" />
            <h1 className="text-xl font-bold tracking-widest text-copernicus-phosphor uppercase">COPERNICUS SETUP</h1>
          </div>
          <div className="text-[11px] text-zinc-500 font-mono uppercase tracking-[0.2em]">
            {`Step ${state.step} of 4`}
          </div>
        </header>

        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={state.step}
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="absolute w-full h-full flex flex-col overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-zinc-800"
            >
              <WizardNarration step={state.step} wizardMode={state.wizardMode} />

              {state.step === 1 && <AuthStep state={state} updateState={updateState} invoke={invoke} />}
              {state.step === 2 && <StoreStep state={state} updateState={updateState} handlers={handlers} invoke={invoke} />}
              {state.step === 3 && <ProjectStep state={state} updateState={updateState} handlers={handlers} invoke={invoke} />}
              {state.step === 4 && <BillingStep state={state} updateState={updateState} handlers={handlers} />}

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center mt-4 max-w-2xl mx-auto w-full">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="mt-8 flex justify-between border-t border-copernicus-steel/20 pt-8 flex-none">
          <button
            onClick={handlers.handleBack}
            disabled={state.step === 1}
            className={`flex items-center gap-3 px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all ${state.step === 1 ? 'opacity-0 pointer-events-none' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <button
            onClick={handleNext}
            disabled={(state.step === 3 && !state.wizardMode) || (state.step === 3 && state.wizardMode === 'existing' && (!state.selectedProject || state.repoStatus === 'no-git')) || (state.step === 3 && state.wizardMode === 'new' && !state.newProjectName.trim()) || (state.step === 2 && !state.workspacePath)}
            className="group flex items-center gap-4 bg-copernicus-phosphor text-black px-12 py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.3em] transition-all hover:scale-[1.02] hover:brightness-110 active:scale-95 shadow-xl shadow-copernicus-phosphor/20 disabled:opacity-50 disabled:pointer-events-none"
          >
            {state.step === 4
              ? <>Launch COPERNICUS <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
              : state.step === 3 && state.wizardMode === 'new'
                ? <>Configure Idea <Sparkles size={16} className="group-hover:scale-110 transition-transform" /></>
                : state.step === 3 && state.wizardMode === 'existing'
                  ? <>Next: Billing <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
                  : state.step === 2
                    ? <>Next: Project <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
                    : <>Advance <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
            }
          </button>
        </footer>
      </motion.div>

      {showGenesisModal && (
        <GenesisWizard
          repoPath={`${state.workspacePath}/${state.newProjectName.trim()}`}
          projectName={state.newProjectName.trim()}
          onComplete={() => {
            setShowGenesisModal(false);
            updateState({ step: 4 });
          }}
        />
      )}
    </div>
  );
};

export default Wizard;
