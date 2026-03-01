import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { useLayoutStore } from '../../store/useLayoutStore';

interface TerminalProps {
  id: string;
  className?: string;
  active?: boolean;
}

export const Terminal: React.FC<TerminalProps> = ({ id, className, active = true }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { panels, registerPanel } = useLayoutStore();
  const panelState = panels[id];

  useEffect(() => {
    registerPanel(id);
  }, [id, registerPanel]);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 14,
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
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Connect to backend
    // @ts-ignore
    window.electronAPI.createTerminal(id, term.cols, term.rows);

    // Handle data from backend
    // @ts-ignore
    const cleanupData = window.electronAPI.onTerminalData((terminalId, data) => {
      if (terminalId === id) {
        term.write(data);
      }
    });

    // Handle user input
    term.onData((data) => {
      // @ts-ignore
      window.electronAPI.writeTerminal(id, data);
    });

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
      // @ts-ignore
      window.electronAPI.resizeTerminal(id, term.cols, term.rows);
    };

    window.addEventListener('resize', handleResize);

    // Initial resize after a short delay to ensure layout is settled
    setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      cleanupData();
      // @ts-ignore
      window.electronAPI.killTerminal(id);
      term.dispose();
    };
  }, [id]);

  // Handle panel resize when spotlight or layout changes
  useEffect(() => {
    if (xtermRef.current && fitAddonRef.current && active) {
      setTimeout(() => {
          fitAddonRef.current?.fit();
          // @ts-ignore
          window.electronAPI.resizeTerminal(id, xtermRef.current.cols, xtermRef.current.rows);
      }, 50); // slight delay for animation
    }
  }, [panelState?.spotlight, panelState?.flipped, active]);

  return <div ref={terminalRef} className={`h-full w-full ${className}`} />;
};
