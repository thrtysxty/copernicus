import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SlashCommandInput } from './SlashCommandInput';
import { useAgentStore, AgentId } from '../store/agents';
import 'xterm/css/xterm.css';

interface TerminalPaneProps {
  id: string;
  active: boolean;
}

export const TerminalPane: React.FC<TerminalPaneProps> = ({ id, active }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const setLastOutput = useAgentStore(s => s.setLastOutput);
  const outputBuffer = useRef<string[]>([]);

  useEffect(() => {
    if (!terminalRef.current) return;
    
    // Prevent double initialization in Strict Mode
    if (xtermRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#1e1e1e',
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Send create PTY request
    window.electron.ipcRenderer.invoke('pty:create', {
        id,
        cols: term.cols,
        rows: term.rows
    }).then((res) => {
        if (!res.success) {
            term.writeln(`Failed to create terminal: ${res.error}`);
        }
    });

    // Handle data from PTY
    const cleanup = window.electron.ipcRenderer.on('pty:data', (message: any) => {
      // message is { id, data }
      if (message.id === id) {
        term.write(message.data);
        
        // Update buffer for interop
        outputBuffer.current.push(message.data);
        if (outputBuffer.current.length > 100) outputBuffer.current.shift();
        setLastOutput(id as AgentId, outputBuffer.current.join(''));
      }
    });

    // Handle input
    term.onData((data) => {
      window.electron.ipcRenderer.send('pty:write', { id, data });
    });
    
    // Resize handler
    const handleResize = () => {
        fitAddon.fit();
        window.electron.ipcRenderer.send('pty:resize', { id, cols: term.cols, rows: term.rows });
    };
    window.addEventListener('resize', handleResize);

    // Keyboard shortcuts for terminal
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setShowOverlay(prev => !prev);
      }
      
      // Agent Clipboard: Ctrl+Shift+C / V
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        const selected = term.getSelection();
        if (selected) {
          useAgentStore.getState().setClipboard(selected);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V') {
        const text = useAgentStore.getState().clipboard;
        if (text) {
          window.electron.ipcRenderer.send('pty:write', { id, data: text });
        }
      }
    };
    terminalRef.current.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleResize);
      cleanup();
      term.dispose();
      window.electron.ipcRenderer.send('pty:kill', { id });
    };
  }, []); // Run ONCE on mount

  useEffect(() => {
    if (active && fitAddonRef.current) {
        setTimeout(() => {
            fitAddonRef.current?.fit();
            if (xtermRef.current) {
                window.electron.ipcRenderer.send('pty:resize', { 
                    id, 
                    cols: xtermRef.current.cols, 
                    rows: xtermRef.current.rows 
                });
                if (!showOverlay) xtermRef.current.focus();
            }
        }, 50);
    }
  }, [active, id, showOverlay]);

  return (
    <div className={`h-full w-full relative ${active ? 'block' : 'hidden'}`}>
      {showOverlay && (
        <div className="absolute top-0 left-0 right-0 p-2 bg-gray-900 border-b border-blue-500 z-50 shadow-2xl">
          <SlashCommandInput 
            placeholder="Terminal Command..."
            onSendMessage={() => setShowOverlay(false)}
          />
        </div>
      )}
      <div ref={terminalRef} className="h-full w-full" />
    </div>
  );
};
