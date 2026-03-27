import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useIpcError } from '../../hooks/useIpcError';
import { unwrapIpc, IpcResult } from '../../types/ipc';

interface WizardNarrationProps {
  step: number;
  wizardMode?: 'new' | 'existing' | null;
}

const WIZARD_NARRATIONS: Record<string, string> = {
  '1_generic': "Let's get your intelligence providers connected. You can skip any you don't have yet.",
  '1_personal': '', // resolved at runtime with username — see getPersonalNarration()
  '2': "Where do you keep your projects? I'll use this as my root for discovery.",
  '3': "Select a project to open, or we'll build something new.",
  '3a': "Tell me about what you're building — I'll turn this into your first sprint.",
  '3b': "Pick the foundation that fits your target platform.",
  '4': "Last step. Set up billing tracking for this project — or skip it for now.",
};

export const WizardNarration: React.FC<WizardNarrationProps> = ({ step, wizardMode }) => {
  const [username, setUsername] = useState<string | null>(null);
  const invoke = useIpcError();

  useEffect(() => {
    invoke<IpcResult<string>>('wizard:get-username')
      .then((result: IpcResult<string>) => {
        if (result.ok) {
          const name = unwrapIpc<string>(result);
          if (name) {
            setUsername(name);
          }
        }
      })
      .catch(() => {
        // Fall back gracefully
      });
  }, [invoke]);

  let narrationKey = String(step);
  if (step === 1) {
    narrationKey = username ? '1_personal' : '1_generic';
  } else if (step === 3) {
    if (wizardMode === 'new') {
      narrationKey = '3a';
    } else {
      narrationKey = '3';
    }
  }

  const narrationText = narrationKey === '1_personal' && username
    ? `Welcome, ${username}. Let's get your intelligence providers connected.`
    : (WIZARD_NARRATIONS[narrationKey] || '');

  return (
    <div className="flex items-center gap-3 bg-black/40 border border-copernicus-steel/20 rounded-xl p-4 mb-6">
      <div className="w-8 h-8 rounded-full bg-copernicus-phosphor/20 flex items-center justify-center flex-none border border-copernicus-phosphor/30 shadow-[0_0_10px_rgba(255,255,255,0.1)]">
        <span className="text-copernicus-phosphor text-lg">⌬</span>
      </div>
      <motion.div
        key={narrationKey}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="text-zinc-300 text-sm"
      >
        {narrationText}
      </motion.div>
    </div>
  );
};
