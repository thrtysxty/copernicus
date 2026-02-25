import { commandRegistry, SlashCommand } from './registry';

const sendToTerminal = (terminalId: string, text: string) => {
  const ipcRenderer = (window as any).ipcRenderer;
  if (ipcRenderer) {
    ipcRenderer.send('terminal:write', { terminalId, text });
  } else {
    console.warn('ipcRenderer not found, cannot send to terminal:', terminalId, text);
  }
};

const commands: SlashCommand[] = [
  {
    name: 'architect',
    target: 'chat',
    description: 'Dispatch to active terminal',
    handler: (args) => {
      // In Story 077/082 context, active terminal is tracked
      const activeTerminal = 'claude'; // Mock default
      sendToTerminal(activeTerminal, `/architect ${args}`);
    }
  },
  {
    name: 'senior',
    target: 'chat',
    description: 'Dispatch to active terminal',
    handler: (args) => {
      sendToTerminal('claude', `/senior ${args}`);
    }
  },
  {
    name: 'delegate',
    target: 'jules',
    description: 'Delegate task to an agent (default: Jules)',
    handler: (args) => {
      const agentMatch = args.match(/agent=(\w+)/);
      const targetAgent = agentMatch ? agentMatch[1] : 'jules';
      sendToTerminal(targetAgent, `/delegate ${args}`);
    }
  },
  {
    name: 'forward',
    target: 'gemini',
    description: 'Forward last response to Gemini',
    handler: (args) => {
       const ipcRenderer = (window as any).ipcRenderer;
       if (ipcRenderer) {
         ipcRenderer.send('command:forward', { target: 'gemini', args });
       }
    }
  },
  {
    name: 'capex',
    target: 'chat',
    description: 'Open CapEx sidebar panel',
    handler: () => {
      console.log('Opening CapEx panel');
    }
  }
];

export const registerCommands = () => {
    commands.forEach(cmd => commandRegistry.register(cmd));
};
