import { codebaseIndexer } from '../codebase-indexer'
import { fsManager } from '../fs-manager'
import { spawn } from 'child_process'
import path from 'path'
import { app } from 'electron'

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
  }
]

export class ToolExecutor {
  async execute(name: string, args: any): Promise<string> {
    switch (name) {
      case 'search_codebase':
        return this.searchCodebase(args.query)
      case 'read_file':
        return this.readFile(args.path)
      case 'local_research':
        return this.localResearch(args.prompt, args.persona)
      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  }

  private async searchCodebase(query: string): Promise<string> {
    const results = await codebaseIndexer.search(query, 5)
    if (results.length === 0) return 'No relevant snippets found.'
    
    return results.map(r => 
      `--- File: ${r.path} (Similarity: ${Math.round(r.similarity * 100)}%) ---
${r.content}
`
    ).join('
')
  }

  private async readFile(filePath: string): Promise<string> {
    const res = fsManager.readFile(filePath)
    if (res.ok) return res.data
    return `Error reading file: ${res.error}`
  }

  private async localResearch(prompt: string, persona: string = 'junior-dev'): Promise<string> {
    return new Promise((resolve) => {
      // Use the shim script we refined today
      const scriptPath = path.join(app.getAppPath(), 'scripts', 'ollama_tool_shim.py')
      const cmd = `/${persona} ${prompt}`
      
      const child = spawn('python3', [scriptPath, cmd], {
        env: { ...process.env, OLLAMA_BASE_URL: 'http://192.168.1.185:11434' }
      })

      let output = ''
      child.stdout.on('data', d => output += d.toString())
      child.stderr.on('data', d => output += d.toString())
      
      child.on('close', (code) => {
        if (code !== 0) {
          resolve(`Local research failed (Exit ${code}):
${output}`)
        } else {
          resolve(output.trim())
        }
      })
    })
  }
}

export const toolExecutor = new ToolExecutor()
