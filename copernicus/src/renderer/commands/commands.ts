import { commandRegistry, Command, CommandContext } from './registry';
import log from '../utils/logger'

const sendToTerminal = (terminalId: string, text: string, ctx: CommandContext) => {
  ctx.send('terminal-write', { id: terminalId, data: text + '\r' });
};

const commands: Command[] = [
  {
    name: '/architect',
    description: 'Dispatch to active terminal',
    execute: (args: string, ctx: CommandContext) => {
      // In Story 077/082 context, active terminal is tracked
      const activeTerminal = 'claude'; // Mock default
      sendToTerminal(activeTerminal, `/architect ${args}`, ctx);
      ctx.appendMessage('assistant', `Dispatched to architect: ${args}`);
    }
  },
  {
    name: '/senior',
    description: 'Dispatch to active terminal',
    execute: (args: string, ctx: CommandContext) => {
      sendToTerminal('claude', `/senior ${args}`, ctx);
      ctx.appendMessage('assistant', `Dispatched to senior: ${args}`);
    }
  },
  {
    name: '/delegate',
    description: 'Delegate task to an agent (default: Jules)',
    execute: (args: string, ctx: CommandContext) => {
      const agentMatch = args.match(/agent=(\w+)/);
      const targetAgent = (agentMatch && agentMatch[1]) ? agentMatch[1] : 'jules';
      sendToTerminal(targetAgent, `/delegate ${args}`, ctx);
      ctx.appendMessage('assistant', `Delegated to ${targetAgent}: ${args}`);
    }
  },
  {
    name: '/forward',
    description: 'Forward last response to Gemini',
    execute: (args: string, ctx: CommandContext) => {
       const ipcRenderer = window.ipcRenderer;
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
      log.info('Opening CapEx panel');
      ctx.appendMessage('assistant', `Opening CapEx panel`);
    }
  }
];

export const registerCommands = () => {
    commands.forEach(cmd => commandRegistry.register(cmd));
};
