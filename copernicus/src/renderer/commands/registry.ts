export type AgentTarget = 'claude' | 'gemini' | 'jules' | 'chat' | 'all';

export interface SlashCommand {
  name: string;           // e.g., 'architect'
  target: AgentTarget;    // 'claude' | 'gemini' | 'jules' | 'chat' | 'all'
  description: string;
  handler?: (args: string) => void;  // local handler (optional)
}

export class CommandRegistry {
  private commands: Map<string, SlashCommand> = new Map();

  register(command: SlashCommand) {
    this.commands.set(command.name, command);
  }

  getCommand(name: string): SlashCommand | undefined {
    return this.commands.get(name);
  }

  getAllCommands(): SlashCommand[] {
    return Array.from(this.commands.values());
  }

  matchCommand(input: string): SlashCommand[] {
    const searchTerm = input.startsWith('/') ? input.slice(1) : input;
    return this.getAllCommands().filter(cmd => 
      cmd.name.toLowerCase().startsWith(searchTerm.toLowerCase())
    );
  }
}

export const commandRegistry = new CommandRegistry();
