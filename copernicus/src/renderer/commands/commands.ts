import { commandRegistry, Command, CommandContext } from './registry';

const sendToTerminal = (terminalId: string, text: string) => {
  const ipcRenderer = (window as any).ipcRenderer;
  if (ipcRenderer) {
    ipcRenderer.send('terminal:write', { id: terminalId, data: text + '\r' });
  } else {
    console.warn('ipcRenderer not found, cannot send to terminal:', terminalId, text);
  }
};

const commands: Command[] = [
  {
    name: '/architect',
    description: 'Dispatch to active terminal',
    execute: (args: string, ctx: CommandContext) => {
      // In Story 077/082 context, active terminal is tracked
      const activeTerminal = 'claude'; // Mock default
      sendToTerminal(activeTerminal, `/architect ${args}`);
      ctx.appendMessage('assistant', `Dispatched to architect: ${args}`);
    }
  },
  {
    name: '/senior',
    description: 'Dispatch to active terminal',
    execute: (args: string, ctx: CommandContext) => {
      sendToTerminal('claude', `/senior ${args}`);
      ctx.appendMessage('assistant', `Dispatched to senior: ${args}`);
    }
  },
  {
    name: '/delegate',
    description: 'Delegate task to an agent (default: Jules)',
    execute: (args: string, ctx: CommandContext) => {
      const agentMatch = args.match(/agent=(\w+)/);
      const targetAgent = agentMatch ? agentMatch[1] : 'jules';
      sendToTerminal(targetAgent, `/delegate ${args}`);
      ctx.appendMessage('assistant', `Delegated to ${targetAgent}: ${args}`);
    }
  },
  {
    name: '/forward',
    description: 'Forward last response to Gemini',
    execute: (args: string, ctx: CommandContext) => {
       const ipcRenderer = (window as any).ipcRenderer;
       if (ipcRenderer) {
         ipcRenderer.send('agent:forward', { target: 'gemini', args });
         ctx.appendMessage('assistant', `Forwarded to gemini: ${args}`);
       }
    }
  },
  {
    name: '/capex',
    description: 'Open CapEx sidebar panel',
    execute: (_args: string, ctx: CommandContext) => {
      console.log('Opening CapEx panel');
      ctx.appendMessage('assistant', `Opening CapEx panel`);
    }
  }
];

export const registerCommands = () => {
    commands.forEach(cmd => commandRegistry.register(cmd));
};
