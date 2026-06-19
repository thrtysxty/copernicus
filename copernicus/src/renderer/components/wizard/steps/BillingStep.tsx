import React from 'react';
import { DollarSign, Monitor, Loader2 } from 'lucide-react';
import { useWizardFlow, WizardState } from '../../hooks/useWizardFlow';

interface BillingStepProps {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
  handlers: any;
}

export const BillingStep: React.FC<BillingStepProps> = ({ state, updateState, handlers }) => {
  return (
    <div className="space-y-6 max-w-2xl mx-auto w-full py-4">
      <div className="flex flex-col gap-1 mb-2 text-center">
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center justify-center gap-4">
          <DollarSign size={28} className="text-copernicus-phosphor" /> Capital Expenditure
        </h2>
        <p className="text-[10px] text-zinc-500 uppercase tracking-[0.4em] opacity-60">Configure billing for this project</p>
      </div>
      {state.genesisProgress === 'pending' && (
        <div className="bg-black/40 border border-copernicus-steel/20 rounded-2xl p-4 flex flex-col gap-2 items-center justify-center">
          <Loader2 size={24} className="text-copernicus-phosphor animate-spin mb-1" />
          <p className="text-[10px] text-zinc-400 uppercase tracking-widest">Setting up your project...</p>
        </div>
      )}
      {state.genesisProgress === 'failed' && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex flex-col gap-2 items-center justify-center text-center">
          <p className="text-xs text-red-400 mb-1">Genesis project setup failed.</p>
          <button onClick={handlers.startGenesisBackground} className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-1.5 rounded text-[10px] font-bold uppercase transition-colors">Retry</button>
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
              <button key={device} onClick={() => updateState({ genesisTargetDevice: device })} className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all border ${state.genesisTargetDevice === device ? 'border-copernicus-phosphor bg-copernicus-phosphor text-black text-white' : 'border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}>{device}</button>
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
              <button key={mode} onClick={() => updateState({ billingMode: mode })} className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all border ${state.billingMode === mode ? 'border-copernicus-phosphor bg-copernicus-phosphor text-black text-white' : 'border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}>{mode}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-zinc-700 text-2xl font-extralight">$</span>
          <input type="number" className="bg-transparent text-4xl font-black text-white w-28 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none hover:text-copernicus-phosphor transition-colors" value={state.hourlyRate} onChange={e => updateState({ hourlyRate: e.target.value })} />
          <span className="text-zinc-700 text-lg font-mono">/HR</span>
        </div>
      </div>
    </div>
  );
};
