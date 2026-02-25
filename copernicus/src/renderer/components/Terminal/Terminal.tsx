import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

const ipcRenderer = (window as any).ipcRenderer;

interface TerminalProps {
  id: string;
  className?: string;
  active?: boolean;
}

export const Terminal: React.FC<TerminalProps> = ({ id, className, active = true }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

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
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Connect to backend
    ipcRenderer.send('terminal-create', { id, cols: term.cols, rows: term.rows });

    // Handle data from backend
    const removeDataListener = ipcRenderer.on('terminal-incoming', ({ id: terminalId, data }: { id: string, data: string }) => {
      if (terminalId === id) {
        term.write(data);
      }
    });

    // Handle user input
    term.onData((data) => {
      ipcRenderer.send('terminal-write', { id, data });
    });

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
      ipcRenderer.send('terminal-resize', { id, cols: term.cols, rows: term.rows });
    };

    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      removeDataListener();
      ipcRenderer.send('terminal-kill', { id });
      term.dispose();
    };
  }, [id]);

  useEffect(() => {
    if (xtermRef.current && fitAddonRef.current && active) {
      setTimeout(() => {
          fitAddonRef.current?.fit();
          ipcRenderer.send('terminal-resize', { id, cols: xtermRef.current!.cols, rows: xtermRef.current!.rows });
      }, 50);
    }
  }, [active, id]);

  return <div ref={terminalRef} className={`h-full w-full ${className}`} />;
};
