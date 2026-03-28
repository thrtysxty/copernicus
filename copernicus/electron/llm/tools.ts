import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { codebaseIndexer } from '../codebase-indexer'
import { hybridRetriever } from './hybrid-retrieval'
import { fsManager } from '../fs-manager'
import { ragInjector, RagChunk } from './RagInjector'
import { modelRegistry } from '../models/model-registry'
import { SettingsStore } from '../settings-store'
import { stateLedger } from '../db/state-ledger'

const execAsync = promisify(exec)

export interface ToolDefinition {
  name: string
  description: string
  parameters?: {
    type: 'object'
    properties: Record<string, {
      type: string
      description: string
      enum?: string[]
    }>
    required: string[]
  }
  input_schema?: {
    type: 'object'
    properties: Record<string, {
      type: string
      description: string
      enum?: string[]
    }>
    required: string[]
  }
}

export const RECALL_MEMORY_TOOL: ToolDefinition = {
  name: 'recall_memory',
  description: 'Search project memory for facts relevant to a query. Use when you need context about prior decisions, file changes, or project conventions.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Keywords or phrase to search for'
      },
      limit: {
        type: 'number',
        description: 'Max results to return (default 5, max 10)'
      }
    },
    required: ['query']
  }
};

export const TOOLS: ToolDefinition[] = [
  {
    name: 'search_codebase',
    description: 'Perform a semantic search across the local codebase to find relevant files and snippets. Use this when you are context-blind or need to find where a specific logic is implemented.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The semantic search query (e.g., "IPC handler for stories" or "layout store definition")'
        },
        mode: {
          type: 'string',
          description: 'The search mode to use. "fast" uses pure semantic search. "deep" uses a hybrid semantic + symbol search.',
          enum: ['fast', 'deep']
        }
      },
      required: ['query']
    }
  },
  {
    name: 'read_file',
    description: 'Read the full content of a local file. Use this after finding a relevant file via search_codebase.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The absolute or relative path to the file'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'local_research',
    description: 'Delegate a complex technical research task to a local Ollama model. This preserves cloud tokens and is useful for documentation drafts, isolated logic audits, or technical summaries.',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The research task or question for the local model'
        },
        persona: {
          type: 'string',
          description: 'The persona to use (e.g., "scribe", "junior-dev", "ui-dev")',
          enum: ['scribe', 'junior-dev', 'ui-dev', 'code-reviewer']
        }
      },
      required: ['prompt']
    }
  },
  {
    name: 'create_story',
    description: 'Scaffold a new user story file in docs/stories/ using the standard template. Use this when the user describes a feature or task that needs formal tracking.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the story (e.g., "Add dark mode toggle to settings")'
        }
      },
      required: ['title']
    }
  },
  {
    name: 'dispatch_agent',
    description: 'Dispatch a story to a specialist agent for implementation. Routes to Jules (GitHub PR automation) or the local Ollama agent gateway.',
    parameters: {
      type: 'object',
      properties: {
        storyId: {
          type: 'string',
          description: 'ID of the story to dispatch (e.g., "story_205")'
        },
        provider: {
          type: 'string',
          description: 'Target agent provider',
          enum: ['jules', 'ollama-cloud', 'ollama-local']
        }
      },
      required: ['storyId', 'provider']
    }
  }
]

export class ToolExecutor {
  async execute(name: string, args: any, context?: { projectId?: string, bankId?: string }): Promise<string> {
    switch (name) {
      case 'recall_memory':
        return this.recallMemory(args.query, args.limit, context?.projectId, context?.bankId)
      case 'search_codebase':
        return this.searchCodebase(args.query, args.mode)
      case 'read_file':
        return this.readFile(args.path)
      case 'local_research':
        return this.localResearch(args.prompt, args.persona)
      case 'create_story':
        return this.createStory(args.title)
      case 'dispatch_agent':
        return this.dispatchAgent(args.storyId, args.provider)
      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  }

  private async recallMemory(query: string, limit?: number, projectId?: string, bankId?: string): Promise<string> {
    if (!query?.trim()) return 'Error: query is required'
    
    // Fallbacks if not provided in context
    const pid = projectId || 'default'
    const bid = bankId || 'chat'
    const maxResults = Math.min(limit ?? 5, 10)
    
    try {
      const rows = stateLedger.recallAgentMemory(pid, bid, query, maxResults)
      
      if (rows.length === 0) {
        return `Memory results for "${query}":\n(no results)`
      }
      
      const formatted = rows.map((r, i) => `${i + 1}. [${r.event_type}] ${r.content} (importance: ${r.importance})`).join('\n')
      return `Memory results for "${query}":\n${formatted}`
    } catch (err: unknown) {
      return `Error recalling memory: ${(err as Error).message}`
    }
  }

  private async searchCodebase(query: string, mode: 'fast' | 'deep' = 'fast'): Promise<string> {
    let results;
    if (mode === 'deep') {
      results = await hybridRetriever.search(query, 20)
    } else {
      results = await codebaseIndexer.search(query, 20)
    }

    if (results.length === 0) return 'No relevant snippets found.'
    
    const chunks: RagChunk[] = results.map(r => ({
      content: r.content,
      filePath: r.path,
      startLine: r.lineStart || 0,
      endLine: r.lineEnd || 0,
      score: r.similarity
    }))

    const settings = new SettingsStore().getAll()
    ragInjector.updateFromSettings(settings)

    const activeModelId = modelRegistry.getActiveModel()?.id || 'claude-3-5-sonnet-20240620'
    const injected = await ragInjector.inject(chunks, activeModelId)
    
    return injected.content
  }

  private async readFile(filePath: string): Promise<string> {
    try {
      return fsManager.readFile(filePath)
    } catch (err: unknown) {
      return `Error reading file: ${(err as Error).message}`
    }
  }

  private async localResearch(prompt: string, persona: string = 'junior-dev'): Promise<string> {
    const response = await fetch('http://localhost:5001/api/agents/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, persona }),
    })
    const data = await response.json() as { ok: boolean; data?: { result: string }; error?: string }
    if (!response.ok || !data.ok) {
      throw new Error(data.error ?? `Local research failed with status ${response.status}`)
    }
    return data.data!.result
  }

  private async createStory(title: string): Promise<string> {
    if (!title?.trim()) return 'Error: title is required'
    const rootPath = fsManager.getRootPath()
    if (!rootPath) return 'Error: no project root set — start a Dev Session first'
    const safeTitle = title.replace(/"/g, '\\"')
    const { stdout, stderr } = await execAsync(
      `python3 scripts/utils/scaffold_story.py "${safeTitle}"`,
      { cwd: rootPath }
    )
    return stdout.trim() || stderr.trim() || `Story created for: ${title}`
  }

  private async dispatchAgent(storyId: string, provider: string): Promise<string> {
    if (!storyId || !provider) return 'Error: storyId and provider are required'
    const rootPath = fsManager.getRootPath()
    if (!rootPath) return 'Error: no project root set'

    if (provider === 'jules') {
      return `To dispatch ${storyId} to Jules: open the Kanban board, find the story card, and click the "→ Jules" button. Jules will create a PR automatically.`
    }

    return `Use scripts/dispatch_claude_ollama.sh to dispatch story ${storyId} via ${provider}. Run from the project root.`
  }
}

export const toolExecutor = new ToolExecutor()
