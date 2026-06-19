import { useState, useEffect } from 'react';
import { useIpcError } from './useIpcError';
import { unwrapIpc, IpcResult } from '../types/ipc';
import log from '../utils/logger';

export interface WizardState {
  step: number;
  cliStatus: Record<string, boolean> | null;
  workspacePath: string;
  hourlyRate: string;
  wizardMode: 'new' | 'existing' | null;
  availableProjects: string[];
  selectedProject: string;
  repoStatus: 'checking' | 'has-git' | 'no-git' | null;
  repoInitError: string | null;
  repoWarning: boolean;
  hasHarness: boolean | null;
  scaffoldSuccessMessage: string | null;
  newProjectName: string;
  billingMode: 'CAPEX' | 'OPEX' | 'NONE';
  genesisTargetDevice: string;
  genesisProgress: 'pending' | 'complete' | 'failed' | null;
  anthropicMethod: 'cli' | 'apikey' | null;
  anthropicKey: string;
  googleKey: string;
  googleMethod: 'cli' | 'apikey' | null;
  ollamaKey: string;
  localOllamaKey: string;
  openaiKey: string;
  openrouterKey: string;
  deepinfraKey: string;
  tavilyKey: string;
  context7Key: string;
  julesKey: string;
  stitchKey: string;
  githubUser: { login: string; avatar_url: string } | null;
  githubMethod: 'cli' | 'apikey' | null;
}

export function useWizardFlow(onComplete: (path: string) => void) {
  const invoke = useIpcError();
  const [state, setState] = useState<WizardState>({
    step: 1,
    cliStatus: null,
    workspacePath: '',
    hourlyRate: '65',
    wizardMode: null,
    availableProjects: [],
    selectedProject: '',
    repoStatus: null,
    repoInitError: null,
    repoWarning: false,
    hasHarness: null,
    scaffoldSuccessMessage: null,
    newProjectName: '',
    billingMode: 'CAPEX',
    genesisTargetDevice: 'AGNOSTIC',
    genesisProgress: null,
    anthropicMethod: null,
    anthropicKey: '',
    googleKey: '',
    googleMethod: null,
    ollamaKey: '',
    localOllamaKey: '',
    openaiKey: '',
    openrouterKey: '',
    deepinfraKey: '',
    tavilyKey: '',
    context7Key: '',
    julesKey: '',
    stitchKey: '',
    githubUser: null,
    githubMethod: null,
  });

  const updateState = (updates: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  // Fetch CLI status
  useEffect(() => {
    invoke<any>('check-cli-tools').then((result) => {
      updateState({ cliStatus: unwrapIpc<any>(result) });
    });
  }, [invoke]);

  // Initial Load
  useEffect(() => {
    invoke<any>('settings:load').then((prefs) => {
      if (!prefs.ok) return;
      const p = unwrapIpc<any>(prefs);
      if (p?.workspace) {
        invoke<any>('fs:path-has-git', p.workspace).then(res => {
          if (!res.ok) return;
          const isGitRepo = unwrapIpc<boolean>(res);
          if (!isGitRepo) {
            updateState({ workspacePath: p.workspace });
          }
        }).catch(() => {});
      }
      if (p?.capex?.rate) updateState({ hourlyRate: String(p.capex.rate) });
    });

    invoke<any>('auth:status').then((raw) => {
      const status: any[] = unwrapIpc<any>(raw) ?? [];
      const updates: Partial<WizardState> = {};
      status.forEach(p => {
        if (p.hasKey) {
          if (p.provider === 'anthropic') {
            if (p.type === 'cli') updates.anthropicMethod = 'cli';
            else { updates.anthropicMethod = 'apikey'; updates.anthropicKey = 'saved'; }
          }
          if (p.provider === 'google') {
            updates.googleKey = 'saved';
            updates.googleMethod = p.type === 'cli' ? 'cli' : 'apikey';
          }
          if (p.provider === 'openai') updates.openaiKey = 'saved';
          if (p.provider === 'openrouter') updates.openrouterKey = 'saved';
          if (p.provider === 'deepinfra') updates.deepinfraKey = 'saved';
          if (p.provider === 'tavily') updates.tavilyKey = 'saved';
          if (p.provider === 'context7') updates.context7Key = 'saved';
          if (p.provider === 'jules') updates.julesKey = 'saved';
          if (p.provider === 'stitch') updates.stitchKey = 'saved';
          if (p.provider === 'github') {
            if (p.source !== 'none' && p.type !== 'none') {
              updates.githubMethod = p.type === 'cli' ? 'cli' : 'apikey';
              invoke<IpcResult<{ login: string; avatar_url: string }>>('github:test-connection').then(res => {
                if (!res.ok) return;
                const user = unwrapIpc<{ login: string; avatar_url: string }>(res);
                if (user && user.login) updateState({ githubUser: user });
              }).catch(() => {});
            }
          }
        }
      });
      updateState(updates);
    });

    invoke<any>('auth:get-api-key', 'ollama-cloud').then((res: any) => {
      const key = unwrapIpc<any>(res);
      if (key) updateState({ ollamaKey: 'saved' });
    }).catch(() => {});
    invoke<any>('auth:get-api-key', 'ollama').then((res: any) => {
      const key = unwrapIpc<any>(res);
      if (key) updateState({ localOllamaKey: 'saved' });
    }).catch(() => {});
  }, [invoke]);

  // Workspace subdirs in step 3
  useEffect(() => {
    if (state.step === 3 && state.workspacePath) {
      invoke<any>('fs:list-dir', state.workspacePath).then((result) => {
        const nodes = unwrapIpc<any[]>(result) ?? [];
        const dirs = nodes
          .filter(n => n.isDir && !n.name.startsWith('.') && n.name !== 'node_modules')
          .map(n => n.name);
        updateState({ availableProjects: dirs });
      }).catch(() => updateState({ availableProjects: [] }));
    }
  }, [state.step, state.workspacePath, invoke]);

  // Repo status check in step 3
  useEffect(() => {
    if (state.wizardMode === 'existing' && state.selectedProject) {
      updateState({ repoStatus: 'checking', hasHarness: null, scaffoldSuccessMessage: null });
      const fullPath = state.selectedProject.startsWith('/') ? state.selectedProject : `${state.workspacePath}/${state.selectedProject}`;
      invoke<{ hasGit: boolean }>('git:check-repo', { path: fullPath }).then(res => {
        const data = unwrapIpc<{ hasGit: boolean }>(res);
        updateState({ repoStatus: data?.hasGit ? 'has-git' : 'no-git' });

        if (data?.hasGit) {
          invoke<boolean>('genesis:check-harness', fullPath).then(harnessRes => {
            const harnessData = unwrapIpc<boolean>(harnessRes);
            updateState({ hasHarness: harnessData || false });
          }).catch(() => {
            updateState({ hasHarness: false });
          });
        }
      }).catch(() => {
        updateState({ repoStatus: 'no-git' });
      });
    } else {
      updateState({ repoStatus: null, hasHarness: null, scaffoldSuccessMessage: null });
    }
  }, [state.selectedProject, state.wizardMode, state.workspacePath, invoke]);

  const handleBrowseProject = async () => {
    try {
      const result = await invoke<any>('dialog:open-folder');
      const path = unwrapIpc<string | null>(result);
      if (path) {
        updateState({ selectedProject: path, wizardMode: 'existing' });
      }
    } catch (error: unknown) {
      log.error('Folder selection failed:', error);
    }
  };

  const handleInitGitRepo = async () => {
    updateState({ repoInitError: null, repoStatus: 'checking' });
    const fullPath = state.selectedProject.startsWith('/') ? state.selectedProject : `${state.workspacePath}/${state.selectedProject}`;
    const res = await invoke<any>('git:init-repo', { path: fullPath });
    if (!res.ok) {
      updateState({ repoInitError: res.error || 'Failed to initialize git repository', repoStatus: 'no-git' });
      return;
    }
    updateState({ repoStatus: 'has-git' });
    const folderName = fullPath.split('/').pop() || '';
    updateState({ newProjectName: folderName, wizardMode: 'new' });
  };

  const startGenesisBackground = () => {
    const fullPath = `${state.workspacePath}/${state.newProjectName.trim()}`;
    updateState({ genesisProgress: 'pending' });
    invoke<any>('genesis:run', {
      projectName: state.newProjectName.trim(),
      idea: 'A new software project.',
      audience: 'Developers',
      coreValue: 'Productivity',
      stack: 'react-electron',
      repoPath: fullPath,
      isNewRepo: true,
      targetDevice: state.genesisTargetDevice,
    }).then(res => {
      if (!res.ok) {
        updateState({ genesisProgress: 'failed' });
        return;
      }
      unwrapIpc<any>(res);
      updateState({ genesisProgress: 'complete' });
    }).catch(() => {
      updateState({ genesisProgress: 'failed' });
    });
  };

  const handleScaffoldHarness = async () => {
    const fullPath = state.selectedProject.startsWith('/') ? state.selectedProject : `${state.workspacePath}/${state.selectedProject}`;
    const res = await invoke<any>('genesis:scaffold-harness', fullPath);
    if (!res.ok) {
      return { error: res.error || 'Failed to scaffold Copernicus harness.' };
    }
    updateState({ hasHarness: true, scaffoldSuccessMessage: 'Created docs/stories/, docs/reference/, CLAUDE.md, and AGENTS.md' });
    return { error: null };
  };

  const handleNext = (errorSetter: (msg: string | null) => void) => {
    errorSetter(null);
    if (state.step === 1) {
      updateState({ step: 2 });
    } else if (state.step === 2) {
      updateState({ step: 3 });
    } else if (state.step === 3) {
      if (state.wizardMode === 'existing') {
        updateState({ step: 4 });
      } else if (state.wizardMode === 'new') {
        if (!state.newProjectName.trim()) {
          errorSetter('Please enter a project name.');
          return;
        }
        return 'showGenesisModal';
      }
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (state.step === 4) {
      updateState({ step: 3 });
    } else if (state.step === 3) {
      updateState({ step: 2 });
    } else if (state.step > 1) {
      updateState({ step: state.step - 1 });
    }
  };

  const handleSelectFolder = async () => {
    try {
      const result = await invoke<any>('select-folder');
      if (!result.ok) return;
      const selectedPath = unwrapIpc<string | null>(result);
      if (selectedPath) {
        const gitRes = await invoke<any>('fs:path-has-git', selectedPath);
        const isGit = gitRes.ok && unwrapIpc<boolean>(gitRes);
        updateState({ workspacePath: selectedPath, selectedProject: '', wizardMode: null });
        await invoke('app:set-root-path', selectedPath);
        return { isGit };
      }
    } catch (error: unknown) {
      log.error('Folder selection failed:', error);
    }
    return { isGit: false };
  };

  const handleGoogleOAuth = async () => {
    try {
      await invoke<{ ok: boolean }>('app:start-oauth-listener');
    } catch (e: unknown) {
      log.error('OAuth start failed:', e);
    }
  };

  const handlePatSubmit = async (pat: string) => {
    try {
      const storeRes = await invoke<any>('auth:store-api-key', 'github', pat.trim());
      if (!storeRes.ok) throw new Error(storeRes.error || 'Failed to store API key.');
      const res = await invoke<IpcResult<{ login: string; avatar_url: string }>>('github:test-connection');
      if (!res.ok) throw new Error(res.error || 'GitHub connection test failed');
      const user = unwrapIpc<{ login: string; avatar_url: string }>(res);
      if (user && user.login) {
        updateState({ githubUser: user, githubMethod: 'apikey' });
        return { error: null };
      } else {
        return { error: 'GitHub PAT saved, but profile fetch failed.' };
      }
    } catch (e: unknown) {
      return { error: 'GitHub Connection Error: ' + (e instanceof Error ? e.message : String(e)) };
    }
  };

  const handleFinish = async () => {
    if (!state.workspacePath) {
      updateState({ step: 2 });
      return { error: 'A repository store directory is required.' };
    }
    if (!state.wizardMode) {
      return { error: 'Please choose to open an existing project or create a new one.' };
    }
    const projectName = state.wizardMode === 'new' ? state.newProjectName.trim() : state.selectedProject;
    if (!projectName) {
      return { error: state.wizardMode === 'new' ? 'Please enter a project name.' : 'Please select a repository.' };
    }

    // Commit keys
    const keyMap = {
      anthropic: state.anthropicMethod === 'cli' ? '__cli__' : state.anthropicKey,
      'ollama-cloud': state.ollamaKey,
      ollama: state.localOllamaKey,
      google: state.googleKey,
      openai: state.openaiKey,
      openrouter: state.openrouterKey,
      deepinfra: state.deepinfraKey,
      tavily: state.tavilyKey,
      context7: state.context7Key,
      jules: state.julesKey,
      stitch: state.stitchKey,
    };

    for (const [provider, key] of Object.entries(keyMap)) {
      if (key && key !== 'saved') {
        const method = provider === 'anthropic' && state.anthropicMethod === 'cli' ? 'cli' : undefined;
        await invoke('auth:store-api-key', provider, key, undefined, method).catch(() => {});
      }
    }

    await invoke('save-preferences', {
      workspace: state.workspacePath,
      googleOAuthClientId: '',
      capex: { rate: parseFloat(state.hourlyRate), currency: 'USD' },
      ui: { theme: 'technical-phosphor' }
    }).catch(() => {});

    try {
      const fullPath = projectName.startsWith('/') ? projectName : `${state.workspacePath}/${projectName}`;
      await invoke('app:set-root-path', fullPath).catch(() => {});
      await invoke('stories:target-project', fullPath).catch(() => {});
      await invoke('project:save-billing', {
        id: `${state.githubUser?.login || 'local'}/${projectName}`,
        path: projectName,
        billing_mode: state.billingMode,
        billing_details: JSON.stringify({ hourly_rate: parseFloat(state.hourlyRate) })
      }).catch(() => {});
      await invoke('github:set-target-repo', `${state.githubUser?.login || 'local'}/${projectName}`).catch(() => {});
      onComplete(fullPath);
      return { error: null };
    } catch (err: unknown) {
      return { error: `Initialization failed: ${(err as Error).message}` };
    }
  };

  return {
    state,
    updateState,
    handleBrowseProject,
    handleInitGitRepo,
    startGenesisBackground,
    handleScaffoldHarness,
    handleNext,
    handleBack,
    handleSelectFolder,
    handleGoogleOAuth,
    handlePatSubmit,
    handleFinish,
  };
}
