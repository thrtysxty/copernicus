export interface Command {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  action: () => void;
}

class CommandRegistry {
  private commands: Map<string, Command> = new Map();

  registerCommand(cmd: Command) {
    this.commands.set(cmd.id, cmd);
  }

  unregisterCommand(id: string) {
    this.commands.delete(id);
  }

  getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  search(query: string): { command: Command; indices: number[] }[] {
    const q = query.toLowerCase();
    return this.getAll()
      .filter(cmd => cmd.label.toLowerCase().includes(q))
      .map(cmd => {
        const indices: number[] = [];
        if (q.length > 0) {
          const start = cmd.label.toLowerCase().indexOf(q);
          for (let i = 0; i < q.length; i++) {
            indices.push(start + i);
          }
        }
        return { command: cmd, indices };
      });
  }
}

export const commandRegistry = new CommandRegistry();
