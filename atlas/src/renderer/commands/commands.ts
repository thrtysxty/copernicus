import { SlashCommand } from './types';

export const COMMANDS: SlashCommand[] = [
  {
    name: 'architect',
    target: 'active',
    description: 'Switch to Architect persona'
  },
  {
    name: 'senior',
    target: 'active',
    description: 'Switch to Senior Dev persona'
  },
  {
    name: 'junior',
    target: 'active',
    description: 'Switch to Junior Dev persona'
  },
  {
    name: 'product',
    target: 'active',
    description: 'Switch to Product Owner persona'
  },
  {
    name: 'story',
    target: 'claude',
    description: 'Scaffold new story file'
  },
  {
    name: 'delegate',
    target: 'jules',
    description: 'Send task to Jules (e.g. /delegate task="...")'
  },
  {
    name: 'forward',
    target: 'gemini',
    description: 'Copy last output to Gemini input'
  },
  {
    name: 'capex',
    target: 'chat',
    description: 'Show current session stats'
  },
  {
    name: 'report',
    target: 'chat',
    description: 'Print CapEx report (e.g. /report month=2026-02)'
  },
  {
    name: 'plan',
    target: 'claude',
    description: 'Enter Claude Code plan mode'
  },
  {
    name: 'clear',
    target: 'chat',
    description: 'Clear current terminal/chat'
  }
];
