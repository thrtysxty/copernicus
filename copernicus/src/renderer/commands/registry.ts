const ipcRenderer = (window as any).ipcRenderer

export interface Command {
  name: string          // e.g. '/help'
  description: string
  usage?: string
  execute: (args: string, context: CommandContext) => void
}

export interface CommandContext {
  appendMessage: (role: 'user' | 'assistant', content: string) => void
  clearMessages: () => void
  setModel: (model: string) => void
  getCurrentModel: () => string
}

class CommandRegistry {
  private commands: Map<string, Command> = new Map()

  register(cmd: Command): void {
    this.commands.set(cmd.name, cmd)
  }

  execute(input: string, context: CommandContext): boolean {
    const [cmdName, ...rest] = input.trim().split(/\s+/)
    const args = rest.join(' ')
    const cmd = this.commands.get(cmdName)
    if (!cmd) return false
    cmd.execute(args, context)
    return true
  }

  suggest(prefix: string): Command[] {
    if (!prefix || !prefix.startsWith('/')) return []
    return Array.from(this.commands.values()).filter(c =>
      c.name.startsWith(prefix)
    )
  }

  list(): Command[] {
    return Array.from(this.commands.values())
  }
}

export const commandRegistry = new CommandRegistry()

// ── Built-in Commands ──────────────────────────────────────────────────────

commandRegistry.register({
  name: '/help',
  description: 'Show available slash commands',
  execute: (_args, ctx) => {
    const lines = commandRegistry.list().map(
      c => `  ${c.name.padEnd(12)} — ${c.description}`
    )
    ctx.appendMessage('assistant', `**Available commands:**\n\`\`\`\n${lines.join('\n')}\n\`\`\``)
  },
})

commandRegistry.register({
  name: '/clear',
  description: 'Clear chat history',
  execute: (_args, ctx) => {
    ctx.clearMessages()
  },
})

commandRegistry.register({
  name: '/model',
  description: 'Switch LLM model',
  usage: '/model <model-id>',
  execute: (args, ctx) => {
    if (!args.trim()) {
      ctx.appendMessage('assistant', `Current model: \`${ctx.getCurrentModel()}\``)
      return
    }
    ctx.setModel(args.trim())
    ctx.appendMessage('assistant', `Model switched to \`${args.trim()}\``)
  },
})

commandRegistry.register({
  name: '/audit',
  description: 'Run Sentinel security audit on staged changes',
  execute: (_args, ctx) => {
    ctx.appendMessage('assistant', '🔒 Dispatching Sentinel audit agent...')
    ipcRenderer.send('terminal:spawn-agent', { agentId: 'sentinel' })
  },
})

commandRegistry.register({
  name: '/story',
  description: 'Scaffold a new user story',
  usage: '/story "Title" [--type story|api|component]',
  execute: (args, ctx) => {
    if (!args.trim()) {
      ctx.appendMessage('assistant', 'Usage: `/story "Title" [--type story|api|component]`')
      return
    }
    ctx.appendMessage('assistant', `Scaffolding story: ${args}`)
    ipcRenderer.send('story:scaffold', { args })
  },
})
