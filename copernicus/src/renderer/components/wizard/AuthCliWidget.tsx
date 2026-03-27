import React, { useState, useEffect, useRef } from 'react';
import { useIpcError } from '../../hooks/useIpcError';
import { unwrapIpc, IpcResult } from '../../types/ipc';
import { AuthCliConfig } from './authCliConfigs';
import { Loader2, X, TerminalSquare } from 'lucide-react';
import { motion } from 'framer-motion';

interface AuthCliWidgetProps {
  config: AuthCliConfig;
  onComplete: () => void;
  onCancel: () => void;
}

type Stage = 'detecting' | 'installing' | 'authenticating' | 'done';

const AuthCliWidget: React.FC<AuthCliWidgetProps> = ({ config, onComplete, onCancel }) => {
  const invoke = useIpcError();
  const [stage, setStage] = useState<Stage>('detecting');
  const [output, setOutput] = useState<string[]>([]);
  const outputEndRef = useRef<HTMLDivElement>(null);

  // Keep stage in a ref for callbacks
  const stageRef = useRef<Stage>(stage);
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  // Keep output in a ref to properly append
  const outputRef = useRef<string[]>([]);
  useEffect(() => {
    outputRef.current = output;
  }, [output]);

  // State for session tracking
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Auto-scroll output
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  useEffect(() => {
    const unsubData = window.ipcRenderer.on('wizard:pty-data', (_e: any, { sessionId, data }: { sessionId: string; data: string }) => {
      if (sessionId !== activeSessionId) return;

      const newOutput = [...outputRef.current, ...data.split('\n').filter(Boolean)];
      // Keep only last ~20 lines, but story says max 4 lines *visible*, so truncating to 50 is safe.
      if (newOutput.length > 50) newOutput.splice(0, newOutput.length - 50);

      setOutput(newOutput);

      // Check success patterns based on current stage
      const currentStage = stageRef.current;
      const combinedOutput = data;

      if (currentStage === 'detecting' && config.detectSuccessPattern.test(combinedOutput)) {
        // Handled via exit code usually
      } else if (currentStage === 'authenticating' && config.authSuccessPattern.test(combinedOutput)) {
        setStage('done');
        invoke('auth:store-api-key', config.providerId, '__cli__', undefined, 'cli').catch(() => {});
        onComplete();
      }
    });

    const unsubExit = window.ipcRenderer.on('wizard:pty-exit', (_e: any, { sessionId, code }: { sessionId: string; code: number }) => {
      if (sessionId !== activeSessionId) return;

      const currentStage = stageRef.current;

      if (currentStage === 'detecting') {
        if (code === 0) {
          // Detected -> Authenticate
          setStage('authenticating');
          runCommand('authenticating');
        } else {
          // Not detected -> Install
          setStage('installing');
          runCommand('installing');
        }
      } else if (currentStage === 'installing') {
        if (code === 0) {
          // Installed -> Authenticate
          setStage('authenticating');
          runCommand('authenticating');
        } else {
          // Install failed
          setOutput((prev) => [...prev, '\x1b[31m[ERROR] Installation failed.\x1b[0m']);
        }
      } else if (currentStage === 'authenticating') {
        if (code === 0) {
          // Auth Success
          setStage('done');
          invoke('auth:store-api-key', config.providerId, '__cli__', undefined, 'cli').catch(() => {});
          onComplete();
        } else {
           setOutput((prev) => [...prev, '\x1b[31m[ERROR] Authentication failed.\x1b[0m']);
        }
      }
    });

    return () => {
      unsubData();
      unsubExit();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId, config, invoke, onComplete, stageRef]);

  const runCommand = async (nextStage: Stage) => {
    let cmd = '';
    if (nextStage === 'detecting') cmd = config.detectCmd;
    if (nextStage === 'installing') cmd = config.installCmd;
    if (nextStage === 'authenticating') cmd = config.authCmd;

    if (!cmd) {
      if (nextStage === 'installing') {
        // If there's no install command (e.g. key only, though key-only shouldn't use this widget)
        setStage('authenticating');
        runCommand('authenticating');
      }
      return;
    }

    try {
      const result = await invoke<IpcResult<{ sessionId: string }>>('wizard:spawn-auth-pty', { providerId: config.providerId, cmd });
      if (!result.ok) {
         setOutput((prev) => [...prev, `\x1b[31m[ERROR] ${result.error}\x1b[0m`]);
         return;
      }
      const { sessionId } = unwrapIpc<{ sessionId: string }>(result);
      setActiveSessionId(sessionId);
    } catch (err: any) {
      setOutput((prev) => [...prev, `\x1b[31m[ERROR] ${err.message}\x1b[0m`]);
    }
  };

  // Initial mount -> Detect
  useEffect(() => {
    runCommand('detecting');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-black/40 border border-copernicus-steel/30 rounded-lg overflow-hidden flex flex-col mt-2"
    >
      <div className="flex items-center justify-between bg-zinc-900/80 px-3 py-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          {stage !== 'done' ? (
             <Loader2 size={12} className="text-copernicus-phosphor animate-spin" />
          ) : (
             <TerminalSquare size={12} className="text-copernicus-phosphor" />
          )}
          <span className="text-[10px] font-mono text-zinc-300 uppercase tracking-widest">
            {config.breadcrumbs[stage]}
          </span>
        </div>
        <button
          onClick={onCancel}
          className="text-zinc-500 hover:text-white transition-colors p-1 rounded hover:bg-white/10"
          title="Cancel"
        >
          <X size={12} />
        </button>
      </div>

      <div className="p-3 bg-black min-h-[4.5rem] max-h-[4.5rem] overflow-y-auto font-mono text-[9px] leading-tight text-zinc-400 scrollbar-thin scrollbar-thumb-zinc-800 break-all">
        {output.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap">{line}</div>
        ))}
        {output.length === 0 && <span className="opacity-50">Waiting for CLI output...</span>}
        <div ref={outputEndRef} />
      </div>
    </motion.div>
  );
};

export default AuthCliWidget;