import log from '../utils/logger'
import { unwrapIpc } from '../types/ipc'

export interface Command {
  name: string          // e.g. '/help'
  description: string
  usage?: string
  execute: (args: string, context: CommandContext) => void
}

export interface CommandContext {
  appendMessage: (role: 'user' | 'assistant' | 'copernicus', content: string) => void
  clearMessages: () => void
  setModel: (model: string) => void
  getCurrentModel: () => string
  setBackTab: (tab: string) => void
  flip: () => void
  invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>
  send: (channel: string, ...args: unknown[]) => void
}

class CommandRegistry {
  private commands: Map<string, Command> = new Map()

  register(cmd: Command): void {
    this.commands.set(cmd.name, cmd)
  }

  execute(input: string, context: CommandContext): boolean {
    const [cmdName, ...rest] = input.trim().split(/\s+/)
    if (!cmdName) return false

    // Story 688: Fire extension activation event before command execution
    context.invoke('extension:fire-event', { event: `onCommand:${cmdName}` })
      .catch((err: any) => log.error('Failed to fire extension event', err))

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
    ctx.appendMessage('copernicus', `**Available commands:**\n\`\`\`\n${lines.join('\n')}\n\`\`\``)
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
  name: '/context',
  description: 'View/manage active context',
  execute: (_args, ctx) => {
    ctx.setBackTab('context')
    ctx.flip()
  },
})

commandRegistry.register({
  name: '/persona',
  description: 'Switch/edit active persona',
  execute: (_args, ctx) => {
    ctx.setBackTab('persona')
    ctx.flip()
  },
})

commandRegistry.register({
  name: '/library',
  description: 'Browse saved prompt library',
  execute: (_args, ctx) => {
    ctx.setBackTab('prompts')
    ctx.flip()
  },
})

commandRegistry.register({
  name: '/history',
  description: 'Browse session history',
  execute: (_args, ctx) => {
    ctx.setBackTab('history')
    ctx.flip()
  },
})

commandRegistry.register({
  name: '/instructions',
  description: 'Edit instruction files (agents.md, etc.)',
  execute: (_args, ctx) => {
    ctx.setBackTab('instructions')
    ctx.flip()
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
    ctx.appendMessage('copernicus', '🔒 Dispatching Sentinel audit agent...')
    ctx.invoke('terminal:spawn-agent', { agentId: 'sentinel' }).catch((err: any) => log.error('Failed to spawn agent', err))
  },
})

commandRegistry.register({
  name: '/story',
  description: 'Scaffold a new user story',
  usage: '/story "Title" [--type story|api|component]',
  execute: (args, ctx) => {
    if (!args.trim()) {
      ctx.appendMessage('copernicus', 'Usage: `/story "Title" [--type story|api|component]`')
      return
    }
    ctx.appendMessage('copernicus', `Scaffolding story: ${args}`)
    ctx.invoke('story:scaffold', { args }).then(res => unwrapIpc(res)).catch((err: any) => log.error('Failed to scaffold story', err))
  },
})
