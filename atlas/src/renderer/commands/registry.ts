import { COMMANDS } from './commands';
import { SlashCommand, AgentTarget } from './types';
import { useAgentStore, AgentId } from '../store/agents';

export class SlashCommandRegistry {
  public static getAll(): SlashCommand[] {
    return COMMANDS;
  }

  public static find(name: string): SlashCommand | undefined {
    return COMMANDS.find(c => c.name === name.toLowerCase());
  }

  public static dispatch(commandName: string, args: string) {
    const cmd = this.find(commandName);
    if (!cmd) {
      console.warn(`Unknown command: ${commandName}`);
      return;
    }

    if (cmd.handler) {
      cmd.handler(args);
      return;
    }

    // Specific logic for /forward
    if (commandName === 'forward') {
      this.handleForward(args);
      return;
    }

    // Default routing: write to PTY via IPC
    const target = this.resolveTarget(cmd.target);
    if (target === 'chat') {
      // Chat logic would go here
      console.log(`Command ${commandName} routed to Chat Panel`);
    } else if (target === 'all') {
      (['claude', 'gemini', 'jules'] as AgentId[]).forEach(id => {
        this.writeToPty(id, commandName, args);
      });
    } else {
      this.writeToPty(target as AgentId, commandName, args);
    }
  }

  private static resolveTarget(target: AgentTarget): string {
    if (target === 'active') {
      return useAgentStore.getState().activeAgent;
    }
    return target;
  }

  private static handleForward(args: string) {
    const state = useAgentStore.getState();
    const activeId = state.activeAgent;
    const lastOutput = state.lastOutputs[activeId];
    
    if (!lastOutput) {
      console.warn(`No output to forward from ${activeId}`);
      return;
    }

    // Extract target from args (e.g. agent=gemini)
    const targetMatch = args.match(/agent=(\w+)/);
    const targetId = targetMatch ? targetMatch[1] : 'gemini';

    state.setActiveAgent(targetId as AgentId);
    
    // Write output as context to target
    window.electron.ipcRenderer.send('pty:write', { 
      id: targetId, 
      data: `\n--- FORWARDED CONTEXT FROM ${activeId.toUpperCase()} ---\n${lastOutput}\n--- END CONTEXT ---\n`
    });
  }

  private static writeToPty(id: AgentId, name: string, args: string) {
    const fullCommand = `/${name} ${args}`.trim();
    window.electron.ipcRenderer.send('pty:write', { 
      id, 
      data: fullCommand + '\n' // Append return to execute
    });
    
    if (name === 'delegate' || name === 'plan') {
       useAgentStore.getState().setActiveAgent(id);
    }
  }
}
