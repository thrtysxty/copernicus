import { exec, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { codebaseIndexer } from '../codebase-indexer'
import { hybridRetriever } from './hybrid-retrieval'
import { fsManager } from '../fs-manager'
import { authManager } from '../auth-manager'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)

export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, {
      type: string
      description: string
      enum?: string[]
    }>
    required: string[]
  }
}

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
  async execute(name: string, args: any): Promise<string> {
    switch (name) {
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

  private async searchCodebase(query: string, mode: 'fast' | 'deep' = 'fast'): Promise<string> {
    let results;
    if (mode === 'deep') {
      results = await hybridRetriever.search(query, 5)
    } else {
      results = await codebaseIndexer.search(query, 5)
    }

    if (results.length === 0) return 'No relevant snippets found.'
    
    return results.map(r => 
      `--- File: ${r.path} (Similarity: ${Math.round(r.similarity * 100)}%) ---
${r.content}
`
    ).join('\n')
  }

  private async readFile(filePath: string): Promise<string> {
    try {
      return fsManager.readFile(filePath)
    } catch (err: any) {
      return `Error reading file: ${err.message}`
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

    const role = 'coder'
    if (!/^[\w\-]+$/.test(storyId)) return 'Error: invalid storyId format'

    const env = { ...process.env }
    if (provider === 'ollama-cloud') {
      env['OLLAMA_API_KEY'] = authManager.getApiKey('ollama-cloud') || process.env.OLLAMA_API_KEY || ''
      env['OLLAMA_CLOUD_HOST'] = authManager.getBaseUrl('ollama-cloud') || process.env.OLLAMA_CLOUD_HOST || 'https://ollama.com'
      // AC-4 Document how this flows: The cloud_agent.py uses OLLAMA_API_KEY and OLLAMA_CLOUD_HOST
      // which are sourced from the user-configured Ollama Cloud settings in Copernicus.
    }

    const { stdout, stderr } = await execFileAsync(
      'python3',
      ['dev_orchestrator/cloud_agent.py', role, `Implement ${storyId}`, '--worktree', storyId],
      { cwd: rootPath, env }
    )
    return stdout.trim() || stderr.trim() || `Agent dispatched for ${storyId} via ${provider}`
  }
}

export const toolExecutor = new ToolExecutor()
