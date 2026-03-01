import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useLayoutStore } from '../../store/layout';

const ipcRenderer = window.ipcRenderer;

interface TerminalProps {
  id: string;
  className?: string;
  active?: boolean;
  cwd?: string;
}

export const Terminal: React.FC<TerminalProps> = ({ id, className, active = true, cwd }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const setTerminalBusy = useLayoutStore(s => s.setTerminalBusy);
  const busyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 12,
      cursorBlink: true,
      cursorStyle: 'block',
      theme: {
        background: '#050505', // copernicus-bg
        foreground: '#D4D4D8', // zinc-300
        cursor: '#4ADE80',     // copernicus-phosphor
        selectionBackground: 'rgba(74, 222, 128, 0.3)',
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);

    // Initial fit
    setTimeout(() => fitAddon.fit(), 0);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Connect to backend
    ipcRenderer.send('terminal-create', { id, cols: term.cols, rows: term.rows, cwd });

    // Handle data from backend
    const removeDataListener = ipcRenderer.on('terminal-incoming', (_event: any, { id: terminalId, data }: { id: string, data: string }) => {
      if (terminalId === id) {
        term.write(data);

        // Activity pulse logic
        setTerminalBusy(id, true);
        if (busyTimeoutRef.current) clearTimeout(busyTimeoutRef.current);
        busyTimeoutRef.current = setTimeout(() => {
          setTerminalBusy(id, false);
        }, 2000);
      }
    });

    // Handle user input
    term.onData((data) => {
      ipcRenderer.send('terminal-write', { id, data });
    });

    // Use ResizeObserver for more granular resizing during animations
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        ipcRenderer.send('terminal-resize', { id, cols: term.cols, rows: term.rows });
      }
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
      removeDataListener();
      if (busyTimeoutRef.current) clearTimeout(busyTimeoutRef.current);
      setTerminalBusy(id, false);
      ipcRenderer.send('terminal-kill', { id });
      term.dispose();
    };
  }, [id, setTerminalBusy]);

  useEffect(() => {
    if (xtermRef.current && fitAddonRef.current && active) {
      setTimeout(() => {
          xtermRef.current?.focus();
          fitAddonRef.current?.fit();
          ipcRenderer.send('terminal-resize', { id, cols: xtermRef.current!.cols, rows: xtermRef.current!.rows });
      }, 50);
    }
  }, [active, id]);

  return <div ref={terminalRef} className={`h-full w-full ${className}`} />;
};
