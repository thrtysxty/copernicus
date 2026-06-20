import React from 'react';
import { FolderOpen, ShieldCheck, AlertTriangle } from 'lucide-react';
import { WizardState } from '../../../hooks/useWizardFlow';

interface StoreStepProps {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
  handlers: any;
  invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;
}

export const StoreStep: React.FC<StoreStepProps> = ({ state, updateState, handlers }) => {
  return (
    <div className="space-y-6 max-w-2xl mx-auto w-full py-12">
      <div className="flex flex-col gap-1 mb-6 text-center">
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center justify-center gap-4">
          <FolderOpen size={32} className="text-copernicus-phosphor" /> Repository Store
        </h2>
        <p className="text-[11px] text-zinc-500 uppercase tracking-[0.4em] opacity-60">Configuring project discovery root</p>
      </div>

      <div className="bg-black/40 border border-copernicus-steel/20 rounded-2xl p-10 space-y-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-copernicus-phosphor/20 to-transparent" />

        <div className="flex flex-col gap-3">
          <label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest ml-1">Repository Store Root</label>
          <div className="flex gap-3">
            <input
              type="text"
              readOnly
              className="flex-1 bg-black/60 border border-copernicus-steel/40 rounded-xl p-4 text-xs text-zinc-300 font-mono truncate shadow-inner"
              value={state.workspacePath || 'Selection required...'}
            />
            <button
              onClick={async () => {
                const res = await handlers.handleSelectFolder();
                if (res && res.isGit) updateState({ repoWarning: true }); else updateState({ repoWarning: false });
              }}
              data-testid="wizard-select-folder"
              className="bg-copernicus-phosphor text-black px-8 py-4 rounded-xl font-black uppercase tracking-widest text-[11px] transition-all hover:brightness-110 active:scale-95 shadow-lg shadow-copernicus-phosphor/20"
            >
              Select Store
            </button>
          </div>
        </div>

        {state.workspacePath ? (
          <div className="flex items-start gap-4 p-5 bg-green-900/10 border border-green-900/20 rounded-xl text-green-400/80">
            <ShieldCheck size={24} className="flex-none text-green-400" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-green-400 uppercase tracking-wide">Path Synchronized</p>
              <p className="text-[11px] font-mono opacity-70 leading-relaxed">Directory is now registered as the root for project discovery and indexing.</p>
            </div>
          </div>
        ) : (
          <div className="p-6 border border-dashed border-zinc-800 rounded-xl text-center">
            <p className="text-[11px] text-zinc-500 italic leading-relaxed">
              Select the parent directory where your projects are stored. <br/> COPERNICUS will use this root to discover and manage your repositories.
            </p>
          </div>
        )}

        {state.repoWarning && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mt-4">
            <p className="text-xs text-amber-400 font-bold uppercase tracking-wide flex items-center gap-2">
              <AlertTriangle size={14} /> Git Repository Detected
            </p>
            <p className="text-[11px] text-zinc-400 mt-1">
              This directory contains a .git folder. COPERNICUS will use it as your workspace root —
              subdirectories will be individual projects. This is fine if this is your Projects folder.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
