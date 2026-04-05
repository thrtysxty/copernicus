import log from '../../utils/logger'
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, DollarSign, Check, ArrowRight, ArrowLeft,
         ShieldCheck, Key, Zap, Layout, Sparkles, Loader2, Monitor } from 'lucide-react';
import { useIpcError } from '../../hooks/useIpcError';
import { unwrapIpc, IpcResult } from '../../types/ipc'
import GenesisWizard from '../genesis/GenesisWizard';
import AuthCliWidget from './AuthCliWidget';
import { AUTH_CLI_CONFIGS, PROVIDER_METADATA, getProviderIcon } from './providerRegistry';
import { WizardNarration } from './WizardNarration';

interface WizardProps {
  onComplete: (workspacePath: string) => void;
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
  const [repoStatus, setRepoStatus] = useState<'checking' | 'has-git' | 'no-git' | null>(null);
  const [repoInitError, setRepoInitError] = useState<string | null>(null);
  const [hasHarness, setHasHarness] = useState<boolean | null>(null);
  const [scaffoldSuccessMessage, setScaffoldSuccessMessage] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [billingMode, setBillingMode] = useState<'CAPEX' | 'OPEX' | 'NONE'>('CAPEX');
  // Genesis fields (New mode — used by startGenesisBackground retry path)
  const [genesisIdea, _setGenesisIdea] = useState('');
  const [genesisAudience, _setGenesisAudience] = useState('');
  const [genesisCoreValue, _setGenesisCoreValue] = useState('');
  const [genesisStack, _setGenesisStack] = useState('react-electron');
  const [genesisTargetDevice, setGenesisTargetDevice] = useState('AGNOSTIC');
  const [genesisProgress, setGenesisProgress] = useState<'pending' | 'complete' | 'failed' | null>(null);

  const [showGenesisModal, setShowGenesisModal] = useState(false);


  // Anthropic
  const [anthropicMethod, setAnthropicMethod] = useState<'cli' | 'apikey' | null>(null);
  const [anthropicKey, setAnthropicKey] = useState('');

  // Other providers
  const [googleKey, setGoogleKey] = useState('');
  const [googleMethod, setGoogleMethod] = useState<'cli' | 'apikey' | null>(null);
  const [ollamaKey, setOllamaKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [deepinfraKey, setDeepinfraKey] = useState('');
  const [tavilyKey, setTavilyKey] = useState('');
  const [context7Key, setContext7Key] = useState('');
  const [julesKey, setJulesKey] = useState('');
  const [stitchKey, setStitchKey] = useState('');
  const googleOAuthClientId = ''; // Static for now
  
  const [error, setError] = useState<string | null>(null);

  // GitHub
  const [githubUser, setGithubUser] = useState<{ login: string; avatar_url: string } | null>(null);
  const [githubMethod, setGithubMethod] = useState<'cli' | 'apikey' | null>(null);
  const [showPatInput, setShowPatInput] = useState(false);
  const [patInput, setPatInput] = useState('');

  // Fast-path state
  const [editAnthropic, setEditAnthropic] = useState(false);
  const [editGoogle, setEditGoogle] = useState(false);
  const [editGithub, setEditGithub] = useState(false);
  const [editOllama, setEditOllama] = useState(false);

  // Widget active states
  const [activeAnthropicWidget, setActiveAnthropicWidget] = useState(false);
  const [activeGoogleWidget, setActiveGoogleWidget] = useState(false);
  const [activeGithubWidget, setActiveGithubWidget] = useState(false);

  const isAnthropicConfigured = anthropicMethod === 'cli' || anthropicKey === 'saved';
  const isGoogleConfigured = googleKey === 'saved' || googleKey === 'oauth';
  const isGithubConfigured = githubUser !== null;
  const isOllamaConfigured = ollamaKey === 'saved';

  const isFastPathReady = isAnthropicConfigured || isGoogleConfigured;

  // Local Ollama (missing from explicit UI)
  const [localOllamaKey, setLocalOllamaKey] = useState('');

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
      if (!prefs.ok) return;
      const p = unwrapIpc<any>(prefs);
      if (p?.workspace) {
        invoke<any>('fs:path-has-git', p.workspace).then(res => {
          if (!res.ok) return;
          const isGitRepo = unwrapIpc<boolean>(res);
          if (!isGitRepo) {
            setWorkspacePath(p.workspace);
          }
        }).catch(() => {});
      }
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
          if (p.provider === 'google') {
            setGoogleKey('saved');
            setGoogleMethod(p.type === 'cli' ? 'cli' : 'apikey');
          }
          if (p.provider === 'openai') setOpenaiKey('saved');
          if (p.provider === 'openrouter') setOpenrouterKey('saved');
          if (p.provider === 'deepinfra') setDeepinfraKey('saved');
          if (p.provider === 'tavily') setTavilyKey('saved');
          if (p.provider === 'context7') setContext7Key('saved');
          if (p.provider === 'jules') setJulesKey('saved');
          if (p.provider === 'stitch') setStitchKey('saved');
          if (p.provider === 'github') {
             // Only test connection if it's explicitly saved or env, preventing 401 on missing file credentials
             if (p.source !== 'none' && p.type !== 'none') {
               setGithubMethod(p.type === 'cli' ? 'cli' : 'apikey');
               invoke<IpcResult<{ login: string; avatar_url: string }>>('github:test-connection').then(res => {
                 if (!res.ok) return;
                 const user = unwrapIpc<{ login: string; avatar_url: string }>(res);
                 if (user && user.login) setGithubUser(user);
               }).catch(() => {});
             }
          }
        }
      });
    });
    
    // 3. Check Ollamas separately
    invoke<any>('auth:get-api-key', 'ollama-cloud').then((res: any) => {
      const key = unwrapIpc<any>(res);
      if (key) setOllamaKey('saved');
    }).catch(() => {});
    invoke<any>('auth:get-api-key', 'ollama').then((res: any) => {
      const key = unwrapIpc<any>(res);
      if (key) setLocalOllamaKey('saved');
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

  useEffect(() => {
    if (wizardMode === 'existing' && selectedProject) {
      setRepoStatus('checking');
      setHasHarness(null);
      setScaffoldSuccessMessage(null);
      const fullPath = selectedProject.startsWith('/') ? selectedProject : `${workspacePath}/${selectedProject}`;
      invoke<{ hasGit: boolean }>('git:check-repo', { path: fullPath }).then(res => {
        const data = unwrapIpc<{ hasGit: boolean }>(res);
        setRepoStatus(data?.hasGit ? 'has-git' : 'no-git');

        if (data?.hasGit) {
          invoke<boolean>('genesis:check-harness', fullPath).then(harnessRes => {
            const harnessData = unwrapIpc<boolean>(harnessRes);
            setHasHarness(harnessData || false);
          }).catch(() => {
            setHasHarness(false);
          });
        }
      }).catch(() => {
        setRepoStatus('no-git');
      });
    } else {
      setRepoStatus(null);
      setHasHarness(null);
      setScaffoldSuccessMessage(null);
    }
  }, [selectedProject, wizardMode, workspacePath, invoke]);

  const handleBrowseProject = async () => {
    try {
      const result = await invoke<any>('dialog:open-folder');
      const path = unwrapIpc<string | null>(result);
      if (path) {
        setSelectedProject(path);
        setWizardMode('existing');
      }
    } catch (error: unknown) {
      log.error('Folder selection failed:', error);
    }
  };

  const handleInitGitRepo = async () => {
    setRepoInitError(null);
    setRepoStatus('checking');
    const fullPath = selectedProject.startsWith('/') ? selectedProject : `${workspacePath}/${selectedProject}`;

    const res = await invoke<any>('git:init-repo', { path: fullPath });
    if (!res.ok) {
      setRepoInitError(res.error || 'Failed to initialize git repository');
      setRepoStatus('no-git');
      return;
    }

    setRepoStatus('has-git');
    // Offer genesis by pre-filling the project name and switching mode
    const folderName = fullPath.split('/').pop() || '';
    setNewProjectName(folderName);
    setWizardMode('new');
  };

  const startGenesisBackground = () => {
    const fullPath = `${workspacePath}/${newProjectName.trim()}`;
    setGenesisProgress('pending');
    invoke<any>('genesis:run', {
      projectName: newProjectName.trim(),
      idea: genesisIdea.trim() || 'A new software project.',
      audience: genesisAudience.trim() || 'Developers',
      coreValue: genesisCoreValue.trim() || 'Productivity',
      stack: genesisStack,
      repoPath: fullPath,
      isNewRepo: true,
      targetDevice: genesisTargetDevice,
    }).then(res => {
      if (!res.ok) {
        setGenesisProgress('failed');
        return;
      }
      unwrapIpc<any>(res);
      setGenesisProgress('complete');
    }).catch(() => {
      setGenesisProgress('failed');
    });
  };

  const handleScaffoldHarness = async () => {
    const fullPath = selectedProject.startsWith('/') ? selectedProject : `${workspacePath}/${selectedProject}`;
    const res = await invoke<any>('genesis:scaffold-harness', fullPath);
    if (!res.ok) {
      setError(res.error || 'Failed to scaffold Copernicus harness.');
      return;
    }
    setHasHarness(true);
    setScaffoldSuccessMessage('Created docs/stories/, docs/reference/, CLAUDE.md, and AGENTS.md');
  };

  const handleNext = () => {
    setError(null);
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      if (wizardMode === 'existing') {
        setStep(4);
      } else if (wizardMode === 'new') {
        if (!newProjectName.trim()) {
          setError('Please enter a project name.');
          return;
        }
        setShowGenesisModal(true);
      }
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    setError(null);
    if (step === 4) {
      setStep(3);
    } else if (step === 3) {
      setStep(2);
    } else if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSelectFolder = async () => {
    try {
      const result = await invoke<any>('select-folder');
      if (!result.ok) {
        if (result.error) log.error('Folder selection failed:', result.error);
        return;
      }
      const selectedPath = unwrapIpc<string | null>(result);
      if (selectedPath) {
        // Step 2 Validation: Check if the selected path contains a .git directory
        const gitRes = await invoke<any>('fs:path-has-git', selectedPath);
        if (gitRes.ok && unwrapIpc<boolean>(gitRes)) {
          // If it is a git repo, display an inline warning and clear workspacePath
          setError('This directory is a git repository. COPERNICUS needs the parent folder that contains your projects, not the project itself.');
          setWorkspacePath('');
          return;
        } else {
          setError(null);
        }

        setWorkspacePath(selectedPath);
        await invoke('app:set-root-path', selectedPath);
        // Reset project selection when workspace changes
        setSelectedProject('');
        setWizardMode(null);
      }
    } catch (error: unknown) {
      log.error('Folder selection failed:', error);
    }
  };

  const handleGoogleOAuth = async () => {
    try {
      await invoke<{ ok: boolean }>('app:start-oauth-listener');
    } catch (e: unknown) {
      const message = e instanceof Error ? (e as any).message : String(e)
      log.error('OAuth start failed:', message);
    }
  };

  const handlePatSubmit = async () => {
    if (!patInput.trim()) return;
    try {
      const storeRes = await invoke<any>('auth:store-api-key', 'github', patInput.trim());
      if (!storeRes.ok) {
         throw new Error(storeRes.error || 'Failed to store API key.');
      }
      const res = await invoke<IpcResult<{ login: string; avatar_url: string }>>('github:test-connection');
      if (!res.ok) {
        throw new Error(res.error || 'GitHub connection test failed');
      }
      const user = unwrapIpc<{ login: string; avatar_url: string }>(res);
      if (user && user.login) {
        setGithubUser(user);
        setShowPatInput(false);
        setPatInput('');
        setError(null);
      } else {
        setError('GitHub PAT saved, but profile fetch failed or returned invalid data.');
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? (e as any).message : String(e);
      setError('GitHub Connection Error: ' + message);
    }
  };

  useEffect(() => {
    const removeGoogle = window.ipcRenderer.on('oauth:google-complete', (_event: any, data: any) => {
      if (data.ok) { setGoogleKey('oauth'); setGoogleMethod('apikey'); }
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
      await invoke('auth:store-api-key', 'ollama-cloud', ollamaKey).catch(() => {})
    }
    if (localOllamaKey && localOllamaKey !== 'saved') {
      await invoke('auth:store-api-key', 'ollama', localOllamaKey).catch(() => {})
    }
    if (googleKey && googleKey !== 'saved' && googleKey !== 'oauth') {
      await invoke('auth:store-api-key', 'google', googleKey).catch(() => {})
    }
    if (openaiKey && openaiKey !== 'saved') {
      await invoke('auth:store-api-key', 'openai', openaiKey).catch(() => {})
    }
    if (openrouterKey && openrouterKey !== 'saved') {
      await invoke('auth:store-api-key', 'openrouter', openrouterKey).catch(() => {})
    }
    if (deepinfraKey && deepinfraKey !== 'saved') {
      await invoke('auth:store-api-key', 'deepinfra', deepinfraKey).catch(() => {})
    }
    if (tavilyKey && tavilyKey !== 'saved') {
      await invoke('auth:store-api-key', 'tavily', tavilyKey).catch(() => {})
    }
    if (context7Key && context7Key !== 'saved') {
      await invoke('auth:store-api-key', 'context7', context7Key).catch(() => {})
    }
    if (julesKey && julesKey !== 'saved' && julesKey !== 'inherited') {
      await invoke('auth:store-api-key', 'jules', julesKey).catch(() => {})
    }
    if (stitchKey && stitchKey !== 'saved') {
      await invoke('auth:store-api-key', 'stitch', stitchKey).catch(() => {})
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

      await invoke('project:save-billing', {
        id: `${githubUser?.login || 'local'}/${projectName}`,
        path: projectName,
        billing_mode: billingMode,
        billing_details: JSON.stringify({ hourly_rate: parseFloat(hourlyRate) })
      }).catch(() => {});

      await invoke('github:set-target-repo', `${githubUser?.login || 'local'}/${projectName}`).catch(() => {});

      onWizardComplete(fullPath);
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
            {`Step ${step} of 4`}
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

              <WizardNarration step={step} wizardMode={wizardMode} />

              {/* ── Phase 1: Authentication ─────────────────────────────────── */}
              {step === 1 && (
                <div className="space-y-6 max-w-2xl mx-auto w-full py-2">
                  {isFastPathReady && (
                    <div className="flex items-center justify-between p-4 mb-4 bg-zinc-900 border border-copernicus-phosphor/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Check size={18} className="text-copernicus-phosphor" />
                        <div>
                          <p className="text-xs font-bold text-copernicus-phosphor uppercase tracking-wide">Providers Ready</p>
                          <p className="text-[10px] text-zinc-400 font-mono">Your providers are set up. Continue to workspace setup or review below.</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setStep(2)}
                        className="bg-copernicus-phosphor text-black px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-all hover:brightness-110 active:scale-95 flex items-center gap-2"
                      >
                        Continue <ArrowRight size={14} />
                      </button>
                    </div>
                  )}

                  <div className="flex flex-col gap-1 mb-4 border-l-2 border-copernicus-phosphor pl-4">
                    <h2 className="text-lg font-bold text-white uppercase tracking-tight flex items-center gap-3">
                      <Key size={18} className="text-copernicus-phosphor" /> Intelligence Bus Connectivity
                    </h2>
                    <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Provisioning secure access to primary model orchestrators</p>
                  </div>

                  <div className="space-y-4">
                    {/* Anthropic / Claude */}
                    <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3 transition-all duration-300">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                          {React.createElement(getProviderIcon('anthropic'), { size: 12 })}
                          {PROVIDER_METADATA['anthropic']?.displayName || 'Anthropic'}
                        </span>
                        {isAnthropicConfigured && !editAnthropic ? (
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1.5 text-[10px] text-black font-bold uppercase bg-copernicus-phosphor px-2 py-0.5 rounded"><Check size={11} /> READY · {anthropicMethod === 'cli' ? 'CLI' : 'API KEY'}</span>
                            <button onClick={() => { setEditAnthropic(true); setActiveAnthropicWidget(false); }} className="text-[10px] text-zinc-500 hover:text-white uppercase tracking-wider underline">Change</button>
                          </div>
                        ) : anthropicMethod && (
                          <span className="flex items-center gap-1.5 text-[10px] text-copernicus-phosphor font-bold uppercase"><Check size={11} /> Selected</span>
                        )}
                      </div>
                      
                      {(!isAnthropicConfigured || editAnthropic) && (
                        <div className="grid grid-cols-1 gap-3">
                          <button
                            onClick={() => { setAnthropicMethod('cli'); setActiveAnthropicWidget(true); }}
                            disabled={!claudeDetected}
                            className={`w-full text-left p-3 rounded border transition-all ${anthropicMethod === 'cli' ? 'border-copernicus-phosphor bg-copernicus-phosphor text-black' : 'border-zinc-800 hover:border-zinc-700 opacity-60'}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-bold uppercase tracking-wide flex items-center gap-2"><Zap size={12} /> Use Claude Code (CLI)</span>
                              {claudeDetected ? <span className="text-[9px] bg-copernicus-phosphor/20 text-copernicus-phosphor px-1.5 rounded">DETECTED</span> : <span className="text-[9px] text-zinc-600">NOT FOUND</span>}
                            </div>
                            <p className="text-[10px] text-zinc-500 leading-tight">Leverages existing <code className="text-zinc-400">claude login</code> credentials.</p>
                          </button>

                          {anthropicMethod === 'cli' && activeAnthropicWidget && AUTH_CLI_CONFIGS['anthropic'] ? (
                            <AuthCliWidget
                              config={AUTH_CLI_CONFIGS['anthropic']}
                              onComplete={() => { setAnthropicMethod('cli'); setAnthropicKey('saved'); setEditAnthropic(false); setActiveAnthropicWidget(false); }}
                              onCancel={() => { setAnthropicMethod(null); setActiveAnthropicWidget(false); }}
                            />
                          ) : (
                            <div className={`p-3 rounded border transition-all ${anthropicMethod === 'apikey' ? 'border-copernicus-phosphor bg-copernicus-phosphor text-black' : 'border-zinc-800 opacity-60'}`}>
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
                          )}
                        </div>
                      )}
                    </div>

                    {/* GitHub Connection */}
                    <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3 transition-all duration-300">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                          {React.createElement(getProviderIcon('github'), { size: 12 })}
                          {PROVIDER_METADATA['github']?.displayName || 'GitHub'}
                        </span>
                        {isGithubConfigured && !editGithub ? (
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1.5 text-[10px] text-black font-bold uppercase bg-copernicus-phosphor px-2 py-0.5 rounded"><Check size={11} /> READY · {githubMethod === 'cli' ? 'CLI' : 'API KEY'}</span>
                            <button onClick={() => { setEditGithub(true); setActiveGithubWidget(false); }} className="text-[10px] text-zinc-500 hover:text-white uppercase tracking-wider underline">Change</button>
                          </div>
                        ) : githubUser && (
                          <span className="flex items-center gap-1.5 text-[10px] text-copernicus-phosphor font-bold uppercase"><Check size={11} /> {githubUser.login}</span>
                        )}
                      </div>

                      {(!isGithubConfigured || editGithub) && (
                        <>
                          {!showPatInput && (
                            <button
                              onClick={() => { setPatInput('cli'); setActiveGithubWidget(true); }}
                              className="w-full bg-white/5 hover:bg-white/10 border border-zinc-800 hover:border-zinc-700 text-white py-2.5 rounded text-[11px] font-bold uppercase tracking-[0.2em] transition-all mb-2"
                            >
                              Use CLI
                            </button>
                          )}
                          {patInput === 'cli' && activeGithubWidget && AUTH_CLI_CONFIGS['github'] && (
                            <AuthCliWidget
                              config={AUTH_CLI_CONFIGS['github']}
                              onComplete={() => {
                                invoke<IpcResult<{ login: string; avatar_url: string }>>('github:test-connection').then(res => {
                                  if (!res.ok) return;
                                  const user = unwrapIpc<{ login: string; avatar_url: string }>(res);
                                  if (user && user.login) {
                                    setGithubMethod('cli');
                                    setGithubUser(user);
                                    setEditGithub(false);
                                    setActiveGithubWidget(false);
                                    setPatInput('');
                                  }
                                }).catch(() => {});
                              }}
                              onCancel={() => { setPatInput(''); setActiveGithubWidget(false); }}
                            />
                          )}
                          {(!activeGithubWidget) && (
                            <button
                              onClick={() => setShowPatInput(true)}
                              className="w-full bg-white/5 hover:bg-white/10 border border-zinc-800 hover:border-zinc-700 text-white py-2.5 rounded text-[11px] font-bold uppercase tracking-[0.2em] transition-all"
                            >
                              {githubUser ? 'Swap GitHub Identity' : 'Connect via PAT'}
                            </button>
                          )}
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
                                  onClick={() => {
                                    setGithubMethod('apikey');
                                    handlePatSubmit();
                                  }}
                                  className="flex-1 py-1.5 bg-copernicus-phosphor text-black border border-copernicus-phosphor/30 rounded text-[11px] font-bold uppercase"
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
                        </>
                      )}
                    </div>

                    {/* Local Ollama */}
                    <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                          {React.createElement(getProviderIcon('ollama'), { size: 12 })}
                          {PROVIDER_METADATA['ollama']?.displayName || 'Local Inference (Ollama)'}
                        </span>
                        {localOllamaKey === 'saved' && <span className="text-[10px] text-copernicus-phosphor font-bold uppercase">READY</span>}
                      </div>
                      <input
                        type="text"
                        className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white outline-none focus:border-copernicus-phosphor transition-colors font-mono"
                        placeholder={localOllamaKey === 'saved' ? 'http://localhost:11434' : 'http://localhost:11434'}
                        value={localOllamaKey === 'saved' ? '' : localOllamaKey}
                        onChange={(e) => setLocalOllamaKey(e.target.value)}
                      />
                    </div>

                    {/* Ollama Cloud */}
                    <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 transition-all duration-300">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-3">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                          {React.createElement(getProviderIcon('ollama-cloud'), { size: 12 })}
                          {PROVIDER_METADATA['ollama-cloud']?.displayName || 'High-Intelligence Tier (Ollama Cloud)'}
                        </span>
                        {isOllamaConfigured && !editOllama ? (
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1.5 text-[10px] text-black font-bold uppercase bg-copernicus-phosphor px-2 py-0.5 rounded"><Check size={11} /> READY</span>
                            <button onClick={() => setEditOllama(true)} className="text-[10px] text-zinc-500 hover:text-white uppercase tracking-wider underline">Change</button>
                          </div>
                        ) : ollamaKey === 'saved' && (
                          <span className="text-[10px] text-copernicus-phosphor font-bold uppercase">AUTHENTICATED</span>
                        )}
                      </div>

                      {(!isOllamaConfigured || editOllama) && (
                        <input
                          type="password"
                          className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white outline-none focus:border-copernicus-phosphor transition-colors font-mono"
                          placeholder={ollamaKey === 'saved' ? 'CLOUD TOKEN SECURED' : 'Ollama Bearer Token'}
                          value={ollamaKey === 'saved' ? '' : ollamaKey}
                          onChange={(e) => setOllamaKey(e.target.value)}
                        />
                      )}
                    </div>

                    {/* Google / Gemini */}
                    <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3 transition-all duration-300">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                          {React.createElement(getProviderIcon('google'), { size: 12 })}
                          {PROVIDER_METADATA['google']?.displayName || 'Google / Gemini'}
                        </span>
                        {isGoogleConfigured && !editGoogle ? (
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1.5 text-[10px] text-black font-bold uppercase bg-copernicus-phosphor px-2 py-0.5 rounded"><Check size={11} /> READY · {googleMethod === 'cli' ? 'CLI' : 'API KEY'}</span>
                            <button onClick={() => { setEditGoogle(true); setActiveGoogleWidget(false); }} className="text-[10px] text-zinc-500 hover:text-white uppercase tracking-wider underline">Change</button>
                          </div>
                        ) : (googleKey === 'saved' || googleKey === 'oauth') ? (
                          <span className="text-[10px] text-copernicus-phosphor font-bold uppercase">SESSION ACTIVE</span>
                        ) : (
                          <button onClick={handleGoogleOAuth} className="text-[10px] text-copernicus-phosphor font-bold uppercase hover:underline">Start OAuth Flow</button>
                        )}
                      </div>

                      {(!isGoogleConfigured || editGoogle) && (
                        <>
                          {googleKey === 'cli' && activeGoogleWidget && AUTH_CLI_CONFIGS['google'] ? (
                            <AuthCliWidget
                              config={AUTH_CLI_CONFIGS['google']}
                              onComplete={() => { setGoogleKey('saved'); setGoogleMethod('cli'); setEditGoogle(false); setActiveGoogleWidget(false); }}
                              onCancel={() => { setGoogleKey(''); setActiveGoogleWidget(false); }}
                            />
                          ) : (
                            <>
                              <button
                                onClick={() => { setGoogleKey('cli'); setActiveGoogleWidget(true); }}
                                className="w-full bg-white/5 hover:bg-white/10 border border-zinc-800 hover:border-zinc-700 text-white py-2.5 rounded text-[11px] font-bold uppercase tracking-[0.2em] transition-all mb-2"
                              >
                                Use CLI
                              </button>
                              <input
                                type="password"
                                className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white outline-none focus:border-copernicus-phosphor transition-colors font-mono"
                                placeholder={googleKey === 'saved' || googleKey === 'oauth' ? 'OAUTH CREDENTIALS ACTIVE' : 'API Key Override (Optional)'}
                                value={googleKey === 'saved' || googleKey === 'oauth' ? '' : googleKey}
                                onChange={(e) => { setGoogleKey(e.target.value); setGoogleMethod('apikey'); }}
                              />
                            </>
                          )}
                        </>
                      )}
                    </div>

                    {/* Google Jules */}
                    <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                          {React.createElement(getProviderIcon('jules'), { size: 12 })}
                          {PROVIDER_METADATA['jules']?.displayName || 'Google Jules'}
                          <span className="text-[9px] bg-copernicus-phosphor/20 text-copernicus-phosphor px-1.5 rounded">Same CLI as Gemini</span>
                        </span>
                        {julesKey === 'saved' ? <span className="text-[10px] text-copernicus-phosphor font-bold uppercase">READY</span> : (googleKey === 'saved' || googleKey === 'oauth' || googleKey === 'cli') ? <span className="text-[10px] text-copernicus-phosphor font-bold uppercase">SAME ACCOUNT AS GEMINI — INHERITED</span> : null}
                      </div>
                      <input
                        type="password"
                        className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white outline-none focus:border-copernicus-phosphor transition-colors font-mono"
                        placeholder={julesKey === 'saved' ? 'CREDENTIALS ENCRYPTED' : ((googleKey === 'saved' || googleKey === 'oauth' || googleKey === 'cli') ? 'INHERITED FROM GEMINI' : 'Jules API Key')}
                        value={julesKey === 'saved' ? '' : (julesKey === 'inherited' ? '' : julesKey)}
                        onChange={(e) => setJulesKey(e.target.value)}
                        disabled={googleKey === 'saved' || googleKey === 'oauth' || googleKey === 'cli'}
                      />
                    </div>

                    {/* Google Stitch */}
                    <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                          {React.createElement(getProviderIcon('stitch'), { size: 12 })}
                          {PROVIDER_METADATA['stitch']?.displayName || 'Google Stitch'}
                          <span className="text-[9px] bg-copernicus-phosphor/20 text-copernicus-phosphor px-1.5 rounded">Same CLI as Gemini</span>
                        </span>
                        {stitchKey === 'saved' && <span className="text-[10px] text-copernicus-phosphor font-bold uppercase">READY</span>}
                      </div>
                      <input
                        type="password"
                        className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white outline-none focus:border-copernicus-phosphor transition-colors font-mono"
                        placeholder={stitchKey === 'saved' ? 'CREDENTIALS ENCRYPTED' : 'Stitch API Key'}
                        value={stitchKey === 'saved' ? '' : stitchKey}
                        onChange={(e) => setStitchKey(e.target.value)}
                      />
                    </div>

                    {/* OpenAI */}
                    <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                          {React.createElement(getProviderIcon('openai'), { size: 12 })}
                          {PROVIDER_METADATA['openai']?.displayName || 'OpenAI'}
                        </span>
                        {openaiKey === 'saved' && <span className="text-[10px] text-copernicus-phosphor font-bold uppercase">READY</span>}
                      </div>
                      <input
                        type="password"
                        className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white outline-none focus:border-copernicus-phosphor transition-colors font-mono"
                        placeholder={openaiKey === 'saved' ? 'CREDENTIALS ENCRYPTED' : 'sk-proj-...'}
                        value={openaiKey === 'saved' ? '' : openaiKey}
                        onChange={(e) => setOpenaiKey(e.target.value)}
                      />
                    </div>

                    {/* OpenRouter */}
                    <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                          {React.createElement(getProviderIcon('openrouter'), { size: 12 })}
                          {PROVIDER_METADATA['openrouter']?.displayName || 'OpenRouter'}
                        </span>
                        {openrouterKey === 'saved' && <span className="text-[10px] text-copernicus-phosphor font-bold uppercase">READY</span>}
                      </div>
                      <input
                        type="password"
                        className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white outline-none focus:border-copernicus-phosphor transition-colors font-mono"
                        placeholder={openrouterKey === 'saved' ? 'CREDENTIALS ENCRYPTED' : 'sk-or-v1-...'}
                        value={openrouterKey === 'saved' ? '' : openrouterKey}
                        onChange={(e) => setOpenrouterKey(e.target.value)}
                      />
                    </div>

                    {/* DeepInfra */}
                    <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                          {React.createElement(getProviderIcon('deepinfra'), { size: 12 })}
                          {PROVIDER_METADATA['deepinfra']?.displayName || 'DeepInfra'}
                        </span>
                        {deepinfraKey === 'saved' && <span className="text-[10px] text-copernicus-phosphor font-bold uppercase">READY</span>}
                      </div>
                      <input
                        type="password"
                        className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white outline-none focus:border-copernicus-phosphor transition-colors font-mono"
                        placeholder={deepinfraKey === 'saved' ? 'CREDENTIALS ENCRYPTED' : 'DeepInfra API Key'}
                        value={deepinfraKey === 'saved' ? '' : deepinfraKey}
                        onChange={(e) => setDeepinfraKey(e.target.value)}
                      />
                    </div>

                    {/* Tavily */}
                    <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                          {React.createElement(getProviderIcon('tavily'), { size: 12 })}
                          {PROVIDER_METADATA['tavily']?.displayName || 'Tavily'}
                        </span>
                        {tavilyKey === 'saved' && <span className="text-[10px] text-copernicus-phosphor font-bold uppercase">READY</span>}
                      </div>
                      <input
                        type="password"
                        className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white outline-none focus:border-copernicus-phosphor transition-colors font-mono"
                        placeholder={tavilyKey === 'saved' ? 'CREDENTIALS ENCRYPTED' : 'tvly-...'}
                        value={tavilyKey === 'saved' ? '' : tavilyKey}
                        onChange={(e) => setTavilyKey(e.target.value)}
                      />
                    </div>

                    {/* Context7 */}
                    <div className="bg-black/30 border border-copernicus-steel/20 rounded p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                          {React.createElement(getProviderIcon('context7'), { size: 12 })}
                          {PROVIDER_METADATA['context7']?.displayName || 'Context7'}
                        </span>
                        {context7Key === 'saved' && <span className="text-[10px] text-copernicus-phosphor font-bold uppercase">READY</span>}
                      </div>
                      <input
                        type="password"
                        className="w-full bg-black/40 border border-copernicus-steel/30 rounded p-2 text-sm text-white outline-none focus:border-copernicus-phosphor transition-colors font-mono"
                        placeholder={context7Key === 'saved' ? 'CREDENTIALS ENCRYPTED' : 'Context7 API Key'}
                        value={context7Key === 'saved' ? '' : context7Key}
                        onChange={(e) => setContext7Key(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="mt-8 text-center opacity-50 text-[10px] text-zinc-500">
                    BitNet embedded agent: active by default
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
                    <p className="text-[10px] text-zinc-500 uppercase tracking-[0.4em] opacity-60">
                      Open an existing repository or start something new
                    </p>
                  </div>
                  {/* Mode selector */}
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => { setWizardMode('existing'); setNewProjectName(''); setError(null); }} className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all ${wizardMode === 'existing' ? 'border-copernicus-phosphor bg-copernicus-phosphor text-black text-white' : 'border-zinc-800 bg-black/30 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'}`}>
                      <FolderOpen size={28} className={wizardMode === 'existing' ? 'text-copernicus-phosphor' : ''} />
                      <div className="text-center">
                        <p className="text-[11px] font-black uppercase tracking-widest">Existing Project</p>
                        <p className="text-[9px] mt-1 opacity-60">Open a repository from your workspace</p>
                      </div>
                    </button>
                    <button onClick={() => { setWizardMode('new'); setSelectedProject(''); setError(null); }} className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all ${wizardMode === 'new' ? 'border-copernicus-phosphor bg-copernicus-phosphor text-black text-white' : 'border-zinc-800 bg-black/30 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'}`}>
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
                        <select className="w-full bg-black/60 border border-zinc-800 rounded-lg p-3 text-xs text-white font-mono outline-none focus:border-copernicus-phosphor transition-colors" value={selectedProject} onChange={e => { setSelectedProject(e.target.value); if (error) setError(null); }}>
                          <option value="">— choose from workspace —</option>
                          {availableProjects.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      )}
                      <button onClick={handleBrowseProject} className="w-full flex items-center justify-center gap-2 py-3 bg-black/40 border border-zinc-700 hover:border-copernicus-phosphor/40 hover:text-white text-zinc-400 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all">
                        <FolderOpen size={13} /> Browse for Repository
                      </button>
                      {selectedProject && (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2 p-2.5 bg-copernicus-phosphor/5 border border-copernicus-phosphor/20 rounded-lg">
                            <Check size={12} className="flex-none text-copernicus-phosphor" />
                            <span className="text-[9px] font-mono text-zinc-300 truncate">{selectedProject.startsWith('/') ? selectedProject : `${workspacePath}/${selectedProject}`}</span>
                          </div>
                          {repoStatus === 'checking' && <div className="flex items-center gap-2 p-2.5 bg-zinc-900/50 border border-zinc-800 rounded-lg text-zinc-400"><Loader2 size={12} className="animate-spin" /><span className="text-[9px] font-mono uppercase">Checking repo status...</span></div>}
                          {repoStatus === 'has-git' && (
                            <>
                              <div className="flex items-center gap-2 p-2.5 bg-copernicus-phosphor border border-copernicus-phosphor/30 rounded-lg text-black"><Check size={12} /><span className="text-[9px] font-mono uppercase">Git repository found</span></div>
                              {hasHarness === false && (
                                <div className="flex flex-col gap-2 p-3 bg-amber-900/10 border border-amber-900/30 rounded-lg">
                                  <div className="flex items-start gap-2 text-amber-500">
                                    <Zap size={14} className="flex-none mt-0.5" />
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-bold uppercase tracking-widest">Missing Project Structure</p>
                                      <p className="text-[9px] opacity-70 leading-relaxed">This repo doesn't have Copernicus project structure. Add it?</p>
                                    </div>
                                  </div>
                                  <div className="flex gap-2 mt-2">
                                    <button onClick={handleScaffoldHarness} className="flex-1 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded text-[9px] font-bold uppercase transition-colors">Yes</button>
                                    <button onClick={() => setHasHarness(true)} className="flex-1 py-1.5 bg-black/40 hover:bg-black/60 text-zinc-400 border border-zinc-800 hover:border-zinc-700 rounded text-[9px] font-bold uppercase transition-colors">Skip</button>
                                  </div>
                                </div>
                              )}
                              {hasHarness === true && scaffoldSuccessMessage && (
                                <div className="flex items-start gap-2 p-2.5 bg-green-900/10 border border-green-900/20 rounded-lg text-green-400/80">
                                  <Check size={12} className="flex-none mt-0.5 text-green-400" />
                                  <span className="text-[9px] font-mono">{scaffoldSuccessMessage}</span>
                                </div>
                              )}
                            </>
                          )}
                          {repoStatus === 'no-git' && (
                            <div className="flex flex-col gap-2 p-3 bg-amber-900/10 border border-amber-900/30 rounded-lg">
                              <div className="flex items-start gap-2 text-amber-500">
                                <Zap size={14} className="flex-none mt-0.5" />
                                <div className="space-y-1"><p className="text-[10px] font-bold uppercase tracking-widest">No git repo found. Initialise one?</p><p className="text-[9px] opacity-70">A git repository is required for COPERNICUS to function.</p></div>
                              </div>
                              {repoInitError && <div className="mt-2 p-2 bg-red-900/20 border border-red-900/40 rounded text-red-500 text-[9px] font-mono break-words">{repoInitError}</div>}
                              <div className="flex gap-2 mt-2">
                                <button onClick={handleInitGitRepo} className="flex-1 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded text-[9px] font-bold uppercase transition-colors">Yes, init & setup</button>
                                <button onClick={handleNext} className="flex-1 py-1.5 bg-black/40 hover:bg-black/60 text-zinc-400 border border-zinc-800 hover:border-zinc-700 rounded text-[9px] font-bold uppercase transition-colors">No, continue anyway</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {/* New: Project Name */}
                  {wizardMode === 'new' && (
                    <div className="bg-black/40 border border-copernicus-steel/20 rounded-2xl p-6 space-y-4 shadow-2xl">
                      <div className="space-y-1">
                        <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Project Name</label>
                        <input type="text" autoFocus className="w-full bg-black/60 border border-zinc-800 rounded-lg p-3 text-xs text-white font-mono outline-none focus:border-copernicus-phosphor transition-colors" placeholder="my-new-project" value={newProjectName} onChange={e => { setNewProjectName(e.target.value); if (error) setError(null); }} />
                      </div>
                    </div>
                  )}
                  {error && step === 3 && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center mt-4"><p className="text-xs text-red-400">{error}</p></div>}
                </div>
              )}
              {/* ── Step 4: CapEx & Billing ────────────────────────── */}
              {step === 4 && (
                <div className="space-y-6 max-w-2xl mx-auto w-full py-4">
                  <div className="flex flex-col gap-1 mb-2 text-center">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center justify-center gap-4">
                      <DollarSign size={28} className="text-copernicus-phosphor" /> Capital Expenditure
                    </h2>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-[0.4em] opacity-60">Configure billing for this project</p>
                  </div>
                  {genesisProgress === 'pending' && (
                    <div className="bg-black/40 border border-copernicus-steel/20 rounded-2xl p-4 flex flex-col gap-2 items-center justify-center">
                      <Loader2 size={24} className="text-copernicus-phosphor animate-spin mb-1" />
                      <p className="text-[10px] text-zinc-400 uppercase tracking-widest">Setting up your project...</p>
                    </div>
                  )}
                  {genesisProgress === 'failed' && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex flex-col gap-2 items-center justify-center text-center">
                      <p className="text-xs text-red-400 mb-1">Genesis project setup failed.</p>
                      <button onClick={startGenesisBackground} className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-1.5 rounded text-[10px] font-bold uppercase transition-colors">Retry</button>
                    </div>
                  )}
                  <div className="bg-black/40 border border-copernicus-steel/20 rounded-2xl p-6 space-y-4 shadow-2xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-copernicus-phosphor">
                        <Monitor size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Target Device</span>
                      </div>
                      <div className="flex gap-2">
                        {(['MOBILE', 'DESKTOP', 'TABLET', 'AGNOSTIC'] as const).map(device => (
                          <button key={device} onClick={() => setGenesisTargetDevice(device)} className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all border ${genesisTargetDevice === device ? 'border-copernicus-phosphor bg-copernicus-phosphor text-black text-white' : 'border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}>{device}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="bg-black/40 border border-copernicus-steel/20 rounded-2xl p-6 space-y-4 shadow-2xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-copernicus-phosphor">
                        <DollarSign size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Billing</span>
                      </div>
                      <div className="flex gap-2">
                        {(['CAPEX', 'OPEX', 'NONE'] as const).map(mode => (
                          <button key={mode} onClick={() => setBillingMode(mode)} className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all border ${billingMode === mode ? 'border-copernicus-phosphor bg-copernicus-phosphor text-black text-white' : 'border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}>{mode}</button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-zinc-700 text-2xl font-extralight">$</span>
                      <input type="number" className="bg-transparent text-4xl font-black text-white w-28 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none hover:text-copernicus-phosphor transition-colors" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} />
                      <span className="text-zinc-700 text-lg font-mono">/HR</span>
                    </div>
                  </div>
                  {error && step === 4 && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center mt-4"><p className="text-xs text-red-400">{error}</p></div>}
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
            disabled={(step === 3 && !wizardMode) || (step === 3 && wizardMode === 'existing' && (!selectedProject || repoStatus === 'no-git')) || (step === 3 && wizardMode === 'new' && !newProjectName.trim()) || (step === 2 && !workspacePath)}
            data-testid="wizard-next-button"
            className="group flex items-center gap-4 bg-copernicus-phosphor text-black px-12 py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.3em] transition-all hover:scale-[1.02] hover:brightness-110 active:scale-95 shadow-xl shadow-copernicus-phosphor/20 disabled:opacity-50 disabled:pointer-events-none"
          >
            {step === 4
              ? <>Launch COPERNICUS <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
              : step === 3 && wizardMode === 'new'
                ? <>Configure Idea <Sparkles size={16} className="group-hover:scale-110 transition-transform" /></>
                : step === 3 && wizardMode === 'existing'
                  ? <>Next: Billing <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
                  : step === 2
                    ? <>Next: Project <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
                    : <>Advance <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
          }
          </button>
        </footer>
      </motion.div>

      {showGenesisModal && (
        <GenesisWizard
          repoPath={`${workspacePath}/${newProjectName.trim()}`}
          projectName={newProjectName.trim()}
          onComplete={() => {
            setShowGenesisModal(false);
            setStep(4);
          }}
        />
      )}
    </div>
  );
};

export default Wizard;
