import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useLayoutStore } from '../../store/layout';
import { useIpcError } from '../../hooks/useIpcError';

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
  const setTerminalCwd = useLayoutStore(s => s.setTerminalCwd);
  const busyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const invoke = useIpcError();

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 12,
      cursorBlink: true,
      cursorStyle: 'block',
      theme: {
        background: '#050505',
        foreground: '#D4D4D8',
        cursor: '#4ADE80',
        selectionBackground: 'rgba(74, 222, 128, 0.3)',
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Track OSC 7 cwd updates
    term.parser.registerOscHandler(7, (data) => {
      try {
        if (data.startsWith('file://')) {
          const url = new URL(data);
          const path = decodeURIComponent(url.pathname);
          setTerminalCwd(id, path);
        }
      } catch (e) {
        // Ignore parsing errors
      }
      return true;
    });

    let opened = false;

    // Open only once the container has real pixel dimensions.
    // This prevents the xterm "container has no height" crash AND ensures
    // terminal-create is sent with accurate cols/rows so input works immediately.
    const tryOpen = () => {
      if (opened || !terminalRef.current) return;
      const { offsetWidth, offsetHeight } = terminalRef.current;
      if (offsetWidth === 0 || offsetHeight === 0) return;

      opened = true;
      term.open(terminalRef.current);
      fitAddon.fit();

      // Create backend PTY with real dimensions
      ipcRenderer.send('terminal-create', { id, cols: term.cols, rows: term.rows, cwd });

      // If cwd is provided, set it initially
      if (cwd) setTerminalCwd(id, cwd);

      // Register input handler after open — ensures all keystrokes are captured
      term.onData((data) => {
        invoke('terminal:input', { tabId: id, data }).catch(() => {});
      });
    };

    // Handle data from backend
    const removeDataListener = ipcRenderer.on('terminal-incoming', (_event: any, { id: terminalId, data }: { id: string, data: string }) => {
      if (terminalId === id) {
        term.write(data);
        setTerminalBusy(id, true);
        if (busyTimeoutRef.current) clearTimeout(busyTimeoutRef.current);
        busyTimeoutRef.current = setTimeout(() => setTerminalBusy(id, false), 2000);
      }
    });

    // ResizeObserver handles both initial open (when dimensions first appear)
    // and subsequent resize events during panel animations
    const resizeObserver = new ResizeObserver(() => {
      tryOpen();
      if (opened && fitAddonRef.current) {
        fitAddonRef.current.fit();
        invoke('terminal:resize', { id, cols: term.cols, rows: term.rows });
      }
    });
    resizeObserver.observe(terminalRef.current);

    // Try immediately in case the container already has dimensions
    tryOpen();

    return () => {
      resizeObserver.disconnect();
      removeDataListener();
      if (busyTimeoutRef.current) clearTimeout(busyTimeoutRef.current);
      setTerminalBusy(id, false);
      if (opened) ipcRenderer.send('terminal-kill', { id });
      term.dispose();
    };
  }, [id, setTerminalBusy, invoke]);

  useEffect(() => {
    if (xtermRef.current && fitAddonRef.current && active) {
      setTimeout(() => {
          xtermRef.current?.focus();
          fitAddonRef.current?.fit();
          invoke('terminal:resize', { id, cols: xtermRef.current!.cols, rows: xtermRef.current!.rows });
      }, 50);
    }
  }, [active, id, invoke]);

  return <div ref={terminalRef} className={`h-full w-full ${className}`} />;
};
