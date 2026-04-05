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

type Stage = 'detecting' | 'installing' | 'detecting_again' | 'manual_auth' | 'done';

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

  // Session tracking via ref — listeners must see the value synchronously, state would race
  const activeSessionIdRef = useRef<string | null>(null);

  // Auto-scroll output
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [output]);

  useEffect(() => {
    const unsubData = window.ipcRenderer.on('wizard:pty-data', (_e: any, { sessionId, data }: { sessionId: string; data: string }) => {
      if (sessionId !== activeSessionIdRef.current) return;

      const newOutput = [...outputRef.current, ...data.split('\n').filter(Boolean)];
      // Keep only last ~20 lines, but story says max 4 lines *visible*, so truncating to 50 is safe.
      if (newOutput.length > 50) newOutput.splice(0, newOutput.length - 50);

      setOutput(newOutput);

    });

    const unsubExit = window.ipcRenderer.on('wizard:pty-exit', (_e: any, { sessionId, code }: { sessionId: string; code: number }) => {
      if (sessionId !== activeSessionIdRef.current) return;

      const currentStage = stageRef.current;

      if (currentStage === 'detecting') {
        if (code === 0) {
          // Detected -> Done
          setOutput((prev) => [...prev, 'Detected.']);
          setStage('done');
          invoke('auth:store-api-key', config.providerId, '__cli__', undefined, 'cli').catch(() => {});
          onComplete();
        } else {
          // Not detected -> Install
          setStage('installing');
          runCommand('installing');
        }
      } else if (currentStage === 'installing') {
        if (code === 0) {
          // Installed -> Detect again
          setStage('detecting_again');
          runCommand('detecting_again');
        } else {
          // Install failed
          setOutput((prev) => [...prev, '\x1b[31m[ERROR] Installation failed.\x1b[0m']);
        }
      } else if (currentStage === 'detecting_again') {
        if (code === 0) {
          // Detected -> Manual Auth
          setStage('manual_auth');
        } else {
          setOutput((prev) => [...prev, '\x1b[31m[ERROR] CLI not detected after installation.\x1b[0m']);
        }
      }
    });

    return () => {
      unsubData();
      unsubExit();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, invoke, onComplete, stageRef]);

  const runCommand = async (nextStage: Stage) => {
    let cmd = '';
    if (nextStage === 'detecting') cmd = config.detectCmd;
    if (nextStage === 'installing') cmd = config.installCmd;
    if (nextStage === 'detecting_again') cmd = config.detectCmd;

    if (!cmd) {
      if (nextStage === 'installing') {
        // If there's no install command (e.g. key only, though key-only shouldn't use this widget)
        setStage('detecting_again');
        runCommand('detecting_again');
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
      activeSessionIdRef.current = sessionId;
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
            {stage === 'detecting_again' || stage === 'manual_auth' ? config.breadcrumbs['authenticating'] : config.breadcrumbs[stage]}
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

      {stage === 'manual_auth' && (
        <div className="p-3 bg-zinc-900/50 border-t border-zinc-800 flex flex-col gap-2">
          <p className="text-[10px] text-zinc-400">Please authenticate in your terminal:</p>
          <div className="bg-black border border-zinc-800 rounded p-2 text-copernicus-phosphor font-mono text-[10px]">
            {config.authCmd}
          </div>
          <button
            onClick={() => {
              setStage('done');
              invoke('auth:store-api-key', config.providerId, '__cli__', undefined, 'cli').catch(() => {});
              onComplete();
            }}
            className="mt-2 w-full bg-copernicus-phosphor text-black py-1.5 rounded text-[10px] font-bold uppercase tracking-widest transition-all hover:brightness-110 active:scale-95"
          >
            Done — I've logged in
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default AuthCliWidget;