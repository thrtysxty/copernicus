import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, ArrowRight, X, Sparkles, User, Target, 
  Terminal, Globe, Cpu, Smartphone, Layout, Wrench,
  CheckCircle2, FolderPlus, FolderOpen, Loader2
} from 'lucide-react';
import { useIpcError } from '../../hooks/useIpcError';
import { unwrapIpc } from '../../types/ipc';

const CYCLING_PLACEHOLDERS: Record<string, string[]> = {
  idea: [
    'A SaaS tool for managing invoices…',
    'A mobile app for tracking fitness goals…',
    'A browser extension for research workflows…',
  ],
  audience: [
    'Film crews and prop houses',
    'Freelancers and small businesses',
    'Teachers and students',
    'Indie game developers',
  ],
  coreValue: [
    'Same-day local inventory, no Chicago shipping delays',
    'Save hours of manual work every week',
    'Zero setup, works out of the box',
    'Makes complex workflows feel simple',
  ],
  projectName: ['PropVault', 'InvoiceFlow', 'FitTrack', 'ResearchLens'],
};

export function useCyclingPlaceholder(fieldId: keyof typeof CYCLING_PLACEHOLDERS) {
  const examples = CYCLING_PLACEHOLDERS[fieldId] ?? [];
  const [placeholder, setPlaceholder] = useState(examples[0] ?? '');
  const indexRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasValueRef = useRef(false);

  const start = useCallback(() => {
    if (hasValueRef.current || examples.length === 0) return;
    intervalRef.current = setInterval(() => {
      indexRef.current = (indexRef.current + 1) % examples.length;
      setPlaceholder(examples[indexRef.current] ?? '');
    }, 2500);
  }, [examples]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    start();
    return stop;
  }, [start, stop]);

  const onFocus = useCallback(() => stop(), [stop]);
  const onBlur = useCallback((value: string) => {
    hasValueRef.current = value.length > 0;
    if (!hasValueRef.current) start();
  }, [start]);

  return { placeholder, onFocus, onBlur };
}

interface GenesisPayload {
  idea: string;
  audience: string;
  coreValue: string;
  projectName: string;
  stack: string;
  repoPath: string;
  isNewRepo: boolean;
}

interface GenesisWizardProps {
  onComplete: () => void;
  repoPath?: string;
  projectName?: string;
}

const ALL_STEPS = [
  { id: 'idea', label: 'Idea' },
  { id: 'stack', label: 'Stack' },
  { id: 'repo', label: 'Repo' },
  { id: 'review', label: 'Review' },
];

const STACKS = [
  { id: 'react-electron', label: 'React + Electron', desc: 'Desktop App', icon: Cpu },
  { id: 'react-flask', label: 'React + Flask', desc: 'Web App', icon: Globe },
  { id: 'nextjs', label: 'Next.js', desc: 'Web / Full-stack', icon: Layout },
  { id: 'react-native', label: 'React Native', desc: 'Mobile', icon: Smartphone },
  { id: 'python-cli', label: 'Python CLI', desc: 'Scripting / Automation', icon: Terminal },
  { id: 'custom', label: 'Custom', desc: "I'll configure manually", icon: Wrench },
];

const GenesisWizard: React.FC<GenesisWizardProps> = ({ onComplete, repoPath, projectName }) => {
  const invoke = useIpcError();
  const [step, setStep] = useState(1);
  const ideaPlaceholder = useCyclingPlaceholder('idea');
  const audiencePlaceholder = useCyclingPlaceholder('audience');
  const coreValuePlaceholder = useCyclingPlaceholder('coreValue');
  const projectNamePlaceholder = useCyclingPlaceholder('projectName');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState('');

  const isWizardMode = !!repoPath;
  const STEPS = isWizardMode
    ? ALL_STEPS.filter(s => s.id !== 'repo')
    : ALL_STEPS;

  const [formData, setFormData] = useState<GenesisPayload>({
    idea: '',
    audience: '',
    coreValue: '',
    projectName: projectName || '',
    stack: 'react-electron',
    repoPath: repoPath || '',
    isNewRepo: true,
  });

  useEffect(() => {
    invoke<any>('settings:load').then((prefs) => {
      const p = unwrapIpc<any>(prefs);
      if (p?.workspace) {
        setWorkspace(p.workspace);
        if (!repoPath) {
          setFormData(prev => ({ ...prev, repoPath: p.workspace }));
        }
      }
    });
  }, [invoke, repoPath]);

  const handleNext = () => {
    if (STEPS[step - 1]?.id === 'idea' && !formData.projectName) {
      const autoName = formData.idea.split(' ').slice(0, 4).join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (autoName) {
        setFormData(prev => ({ ...prev, projectName: autoName }));
      }
    }
    setStep(prev => prev + 1);
  };

  const handleBack = () => setStep(prev => prev - 1);

  const isStepValid = () => {
    const currentStepId = STEPS[step - 1]?.id;
    if (currentStepId === 'idea') return formData.idea.trim() && formData.audience.trim() && formData.coreValue.trim();
    if (currentStepId === 'stack') return !!formData.stack;
    if (currentStepId === 'repo') return formData.repoPath.trim();
    return true;
  };

  const handleLaunch = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<any>('genesis:run', formData);
      unwrapIpc<any>(result);
      onComplete();
    } catch (e: any) {
      if (e.message === 'NO_MODEL_CONFIGURED') {
        setError('Configure a model in Settings first.');
      } else if (e.message === 'MODEL_TOO_SMALL') {
        setError(
          'Genesis requires a capable AI model. Switch to a cloud provider (Anthropic, Google, OpenRouter) or run Ollama with a 7B+ model in Settings → Models.'
        );
      } else {
        setError('Project setup failed — please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (workspace) {
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex items-center justify-center p-8">
      <div className="w-full max-w-4xl h-[700px] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* Header */}
        <header className="flex-none h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500/10 rounded flex items-center justify-center">
              <Sparkles size={18} className="text-indigo-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-widest">Genesis</h2>
              <p className="text-[10px] text-zinc-500 uppercase tracking-tighter">New Project Protocol</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {STEPS.map((s, idx) => {
              const isActive = step === idx + 1;
              const isCompleted = step > idx + 1;
              return (
                <div 
                  key={s.id}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${isActive ? 'bg-indigo-500 text-white shadow-[0_0_12px_rgba(99,102,241,0.5)]' : isCompleted ? 'bg-indigo-950 text-indigo-400 border border-indigo-500/30' : 'bg-zinc-800 text-zinc-500'}`}
                >
                  {idx + 1}
                </div>
              );
            })}
          </div>

          <button 
            onClick={handleCancel}
            className="p-2 text-zinc-500 hover:text-zinc-100 transition-colors"
          >
            <X size={20} />
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 p-8 overflow-y-auto"
            >
              {STEPS[step - 1]?.id === 'idea' && (
                <div className="max-w-2xl mx-auto space-y-6">
                  <div className="space-y-4">
                    <label className="block">
                      <span className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                        <Sparkles size={12} className="text-indigo-500" /> What are you building?
                      </span>
                      <textarea
                        required
                        className="w-full h-24 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-100 placeholder:text-zinc-700 outline-none focus:border-indigo-500/50 transition-colors resize-none"
                        placeholder={ideaPlaceholder.placeholder}
                        value={formData.idea}
                        onFocus={ideaPlaceholder.onFocus}
                        onBlur={e => ideaPlaceholder.onBlur(e.target.value)}
                        onChange={e => setFormData({ ...formData, idea: e.target.value })}
                      />
                    </label>

                    <label className="block">
                      <span className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                        <User size={12} className="text-indigo-500" /> Who is it for?
                      </span>
                      <input
                        required
                        type="text"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-100 placeholder:text-zinc-700 outline-none focus:border-indigo-500/50 transition-colors"
                        placeholder={audiencePlaceholder.placeholder}
                        value={formData.audience}
                        onFocus={audiencePlaceholder.onFocus}
                        onBlur={e => audiencePlaceholder.onBlur(e.target.value)}
                        onChange={e => setFormData({ ...formData, audience: e.target.value })}
                      />
                    </label>

                    <label className="block">
                      <span className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                        <Target size={12} className="text-indigo-500" /> What's the core value?
                      </span>
                      <textarea
                        required
                        className="w-full h-24 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-100 placeholder:text-zinc-700 outline-none focus:border-indigo-500/50 transition-colors resize-none"
                        placeholder={coreValuePlaceholder.placeholder}
                        value={formData.coreValue}
                        onFocus={coreValuePlaceholder.onFocus}
                        onBlur={e => coreValuePlaceholder.onBlur(e.target.value)}
                        onChange={e => setFormData({ ...formData, coreValue: e.target.value })}
                      />
                    </label>

                    <label className="block">
                      <span className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                        Project name (Optional)
                      </span>
                      <input
                        type="text"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-100 placeholder:text-zinc-700 outline-none focus:border-indigo-500/50 transition-colors"
                        placeholder={projectNamePlaceholder.placeholder}
                        value={formData.projectName}
                        onFocus={projectNamePlaceholder.onFocus}
                        onBlur={e => projectNamePlaceholder.onBlur(e.target.value)}
                        onChange={e => setFormData({ ...formData, projectName: e.target.value })}
                      />
                    </label>
                  </div>
                </div>
              )}

              {STEPS[step - 1]?.id === 'stack' && (
                <div className="max-w-3xl mx-auto space-y-6">
                  <div className="text-center mb-8">
                    <h3 className="text-lg font-bold text-white uppercase tracking-tight">Select your stack</h3>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Base architecture for project generation</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {STACKS.map(stack => {
                      const Icon = stack.icon;
                      const selected = formData.stack === stack.id;
                      return (
                        <button
                          key={stack.id}
                          onClick={() => setFormData({ ...formData, stack: stack.id })}
                          className={`flex flex-col items-center justify-center p-6 border rounded-xl transition-all ${selected ? 'border-indigo-500 bg-indigo-950/30' : 'border-zinc-800 bg-zinc-950/50 hover:border-zinc-700'}`}
                        >
                          <Icon size={24} className={selected ? 'text-indigo-400' : 'text-zinc-600'} />
                          <span className={`text-xs font-bold mt-4 ${selected ? 'text-white' : 'text-zinc-400'}`}>{stack.label}</span>
                          <span className="text-[9px] text-zinc-600 uppercase tracking-tighter mt-1">{stack.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {STEPS[step - 1]?.id === 'repo' && (
                <div className="max-w-2xl mx-auto space-y-8 py-12">
                  <div className="flex items-center justify-center gap-8">
                    <button
                      onClick={() => setFormData({ ...formData, isNewRepo: true })}
                      className={`flex-1 flex flex-col items-center gap-4 p-8 border rounded-xl transition-all relative ${formData.isNewRepo ? 'border-indigo-500 bg-indigo-950/20' : 'border-zinc-800 opacity-50'}`}
                    >
                      <div className={`absolute top-4 right-4 w-4 h-4 rounded-full border flex items-center justify-center ${formData.isNewRepo ? 'border-indigo-500' : 'border-zinc-600'}`}>
                        {formData.isNewRepo && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                      </div>
                      <FolderPlus size={32} className={formData.isNewRepo ? 'text-indigo-500' : 'text-zinc-600'} />
                      <span className="text-xs font-bold uppercase tracking-widest">New repo</span>
                    </button>
                    <button
                      onClick={() => setFormData({ ...formData, isNewRepo: false })}
                      className={`flex-1 flex flex-col items-center gap-4 p-8 border rounded-xl transition-all relative ${!formData.isNewRepo ? 'border-indigo-500 bg-indigo-950/20' : 'border-zinc-800 opacity-50'}`}
                    >
                      <div className={`absolute top-4 right-4 w-4 h-4 rounded-full border flex items-center justify-center ${!formData.isNewRepo ? 'border-indigo-500' : 'border-zinc-600'}`}>
                        {!formData.isNewRepo && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                      </div>
                      <FolderOpen size={32} className={!formData.isNewRepo ? 'text-indigo-500' : 'text-zinc-600'} />
                      <span className="text-xs font-bold uppercase tracking-widest">Existing repo</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    <label className="block">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Path</span>
                      <input
                        type="text"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-xs text-zinc-300 font-mono mt-2"
                        value={formData.repoPath}
                        onChange={e => setFormData({ ...formData, repoPath: e.target.value })}
                      />
                    </label>
                    <p className="text-[10px] text-zinc-600 font-mono italic">
                      {formData.isNewRepo ? "New repo: directory will be created." : "Existing repo: config files will be added."}
                    </p>
                  </div>
                </div>
              )}

              {STEPS[step - 1]?.id === 'review' && (
                <div className="max-w-2xl mx-auto space-y-8">
                  <div className="text-center">
                    <CheckCircle2 size={48} className="text-indigo-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white uppercase tracking-tighter">Ready for genesis</h3>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Confirm your project specifications</p>
                  </div>

                  <div className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-8">
                      <div>
                        <span className="text-[9px] text-zinc-600 uppercase font-bold block mb-1">Project Name</span>
                        <span className="text-sm text-zinc-100 font-mono">{formData.projectName}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-600 uppercase font-bold block mb-1">Stack</span>
                        <span className="text-sm text-zinc-100 font-mono uppercase">{formData.stack}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-600 uppercase font-bold block mb-1">Target Directory</span>
                      <span className="text-[11px] text-zinc-400 font-mono">{formData.repoPath}/{formData.isNewRepo ? formData.projectName : ''}</span>
                    </div>
                    <div className="pt-4 border-t border-zinc-800/50">
                      <p className="text-xs text-zinc-500 italic">
                        Will generate: 1 Epic, ~3–5 Stories, AGENTS.md, CLAUDE.md
                      </p>
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
                      <p className="text-xs text-red-400">{error}</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <footer className="flex-none h-20 border-t border-zinc-800 flex items-center justify-between px-8 bg-zinc-900/50">
          <button
            onClick={handleBack}
            disabled={step === 1 || loading}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold uppercase transition-all ${step === 1 ? 'opacity-0 pointer-events-none' : 'text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800'}`}
          >
            <ArrowLeft size={14} /> Back
          </button>
          
          <button
            onClick={step === STEPS.length ? handleLaunch : handleNext}
            disabled={!isStepValid() || loading}
            className={`flex items-center gap-2 px-8 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${!isStepValid() || loading ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20'}`}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : step === STEPS.length ? (
              <>Launch Project <Sparkles size={16} /></>
            ) : (
              <>Next <ArrowRight size={16} /></>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default GenesisWizard;
