import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useLayoutStore } from '../../store/layout';
import { useIpcError } from '../../hooks/useIpcError';
import log from '../../utils/logger';

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
  const openedRef = useRef(false);
  const ptyReadyRef = useRef(false);
  const tryOpenRef = useRef<(() => void) | null>(null);
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


    // Open only once the container has real pixel dimensions.
    // This prevents the xterm "container has no height" crash AND ensures
    // terminal-create is sent with accurate cols/rows so input works immediately.
    const tryOpen = () => {
      if (openedRef.current || !terminalRef.current) return;
      const { offsetWidth, offsetHeight } = terminalRef.current;
      if (offsetWidth === 0 || offsetHeight === 0) return;

      openedRef.current = true;
      term.open(terminalRef.current);
      fitAddon.fit();

      // Create backend PTY with real dimensions
      ipcRenderer.send('terminal-create', { id, cols: term.cols, rows: term.rows, cwd });

      // If cwd is provided, set it initially
      if (cwd) setTerminalCwd(id, cwd);

      // Register input handler after open — ensures all keystrokes are captured
      term.onData((data) => {
        log.info('[Terminal] onData fired:', { id, len: data.length });
        if (!ptyReadyRef.current) {
          // Buffer input until pty is confirmed ready (first terminal-incoming received)
          const bufferTimer = setInterval(() => {
            if (ptyReadyRef.current) {
              clearInterval(bufferTimer);
              invoke('terminal:input', { id, data }).catch(() => {});
            }
          }, 50);
          // Safety: flush after 2s even if no response (pty might be slow to start)
          setTimeout(() => {
            clearInterval(bufferTimer);
            ptyReadyRef.current = true;
            invoke('terminal:input', { id, data }).catch(() => {});
          }, 2000);
          return;
        }
        invoke('terminal:input', { id, data }).catch(() => {});
      });
    };
    tryOpenRef.current = tryOpen;

    // Handle data from backend
    const removeDataListener = ipcRenderer.on('terminal-incoming', (_event: any, { id: terminalId, data }: { id: string, data: string }) => {
      if (terminalId === id) {
        ptyReadyRef.current = true;
        term.write(data);
        setTerminalBusy(id, true);
        if (busyTimeoutRef.current) clearTimeout(busyTimeoutRef.current);
        busyTimeoutRef.current = setTimeout(() => setTerminalBusy(id, false), 2000);
      }
    });

    // ResizeObserver handles both initial open (when dimensions first appear)
    // and subsequent resize events during panel animations
    // Debounced to avoid sending intermediate dimensions during CSS transitions
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const resizeObserver = new ResizeObserver(() => {
      tryOpen();
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (openedRef.current && fitAddonRef.current) {
          fitAddonRef.current.fit();
          invoke('terminal:resize', { id, cols: term.cols, rows: term.rows }).catch(() => {});
        }
      }, 100);
    });
    resizeObserver.observe(terminalRef.current);

    // Try immediately in case the container already has dimensions
    tryOpen();

    return () => {
      resizeObserver.disconnect();
      if (resizeTimer) clearTimeout(resizeTimer);
      removeDataListener();
      if (busyTimeoutRef.current) clearTimeout(busyTimeoutRef.current);
      setTerminalBusy(id, false);
      if (openedRef.current) ipcRenderer.send('terminal-kill', { id });
      term.dispose();
      openedRef.current = false;
      ptyReadyRef.current = false;
    };
  }, [id, setTerminalBusy, invoke]);

  useEffect(() => {
    if (xtermRef.current && fitAddonRef.current && active) {
      // If the terminal hasn't been opened yet, try to open it before focusing.
      if (!openedRef.current && tryOpenRef.current) {
        tryOpenRef.current();
      }
      // Delay focus to allow CSS transition (300ms) to settle — retry ensures focus
      // lands even if the panel is still animating
      const focusTimer = setTimeout(() => {
        xtermRef.current?.focus();
        if (fitAddonRef.current) {
          fitAddonRef.current.fit();
          invoke('terminal:resize', { id, cols: xtermRef.current!.cols, rows: xtermRef.current!.rows }).catch(() => {});
        }
      }, 150);
      // Second retry after transition should be complete
      const retryTimer = setTimeout(() => {
        xtermRef.current?.focus();
        if (fitAddonRef.current && xtermRef.current) {
          fitAddonRef.current.fit();
          invoke('terminal:resize', { id, cols: xtermRef.current!.cols, rows: xtermRef.current!.rows }).catch(() => {});
        }
      }, 350);
      return () => { clearTimeout(focusTimer); clearTimeout(retryTimer); };
    }
  }, [active, id, invoke]);

  return <div ref={terminalRef} className={`h-full w-full ${className}`} />;
};
