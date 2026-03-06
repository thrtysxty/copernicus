import { BrowserWindow } from 'electron'
import { authManager } from '../auth-manager'
import { modelRegistry } from '../models/model-registry'
import { stateLedger } from '../db/state-ledger'
import log from '../utils/logger'
import { TOOLS, ToolExecutor } from './tools'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatPayload {
  sessionId: string
  messages: ChatMessage[]
  model: string
  systemPrompt?: string
}

const MAX_TOOL_DEPTH = 5

export class LLMService {
  private broadcast(channel: string, payload: object) {
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) win.webContents.send(channel, payload)
    })
  }

  async streamChat(payload: ChatPayload, depth = 0): Promise<void> {
    const { sessionId, messages, model, systemPrompt } = payload

    const DEFAULT_SYSTEM_PROMPT = `You are the primary AI orchestrator inside the COPERNICUS IDE.
Your goal is to assist the user with industrial-scale software engineering.

CORE PROTOCOLS:
1. REPO RAG: You have access to the local codebase via the 'search_codebase' and 'read_file' tools. If the user's request is vague or refers to existing logic, you MUST search the codebase before asking the user for paths.
2. LOCAL DELEGATION: For tactical tasks like documentation, quick bug fixes, or UI tweaks, you can delegate to local sidekick models using 'local_research'.
3. SURGICAL EDITS: When providing code, provide complete, valid blocks. Avoid placeholders like "// ... rest of code".
4. CONTEXT AWARENESS: You are running in a professional environment. Prefer efficiency and technical precision over conversational filler.
5. PM DISCIPLINE: For any task larger than a 2-line fix, you MUST: (1) use search_codebase to understand the codebase first, (2) create a story with create_story, (3) dispatch it with dispatch_agent. Never write more than 20 lines of code inline.`

    const system = systemPrompt ?? DEFAULT_SYSTEM_PROMPT
    const callStart = Date.now()

    const modelConfig = modelRegistry.getModels().find(m => m.id === model)
    const provider = modelConfig?.provider ?? 'anthropic'

    if (depth > MAX_TOOL_DEPTH) {
      this.broadcast('chat:error', { sessionId, error: 'Maximum tool call depth exceeded' })
      return
    }

    try {
      let apiKey = ''
      let baseUrl = ''
      if (provider === 'anthropic') {
        apiKey = authManager.getApiKey('anthropic') || ''
      } else if (provider === 'google') {
        apiKey = authManager.getApiKey('google') || ''
      } else if (provider === 'openai' || provider === 'openrouter' || provider === 'deepinfra') {
        const resolved = authManager.resolveOpenAICompatibleKey()
        if (resolved) {
          apiKey = resolved.key
          baseUrl = resolved.baseUrl || ''
        }
      }

      const response = await fetch('http://127.0.0.1:5001/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          messages,
          model,
          provider,
          systemPrompt: system,
          apiKey,
          baseUrl,
          tools: TOOLS
        })
      })

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status} ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue

          const dataStr = line.slice(6)
          if (dataStr === '[DONE]') {
            this.broadcast('chat:done', { sessionId, inputTokens: 0, outputTokens: 0 })
            this.recordCall(sessionId, model, 0, 0, callStart)
            return
          }

          try {
            const data = JSON.parse(dataStr)
            if (data.error) {
              this.broadcast('chat:error', { sessionId, error: data.error })
              return
            } else if (data.token) {
              this.broadcast('chat:token', { sessionId, token: data.token })
            } else if (data.tool_use) {
              // Tool-calling intercept: execute tool and re-invoke
              const { name, input } = data.tool_use as { id: string; name: string; input: Record<string, unknown> }
              this.broadcast('chat:tool-status', { sessionId, tool: name, status: 'running' })

              const executor = new ToolExecutor()
              const result = await executor.execute(name, input || {})

              this.broadcast('chat:tool-status', { sessionId, tool: name, status: 'done', preview: result.slice(0, 200) })

              // Inject tool call + result as conversation messages (text-compatible format)
              const updatedMessages: ChatMessage[] = [
                ...messages,
                { role: 'assistant', content: `[Tool call: ${name}(${JSON.stringify(input)})]` },
                { role: 'user', content: `[Tool result: ${name}]\n${result}` }
              ]

              // Recurse with updated context
              await this.streamChat({ ...payload, messages: updatedMessages }, depth + 1)
              return
            }
          } catch (e) {
            log.error('[LLMService] Failed to parse SSE data:', e, dataStr)
          }
        }
      }

      this.broadcast('chat:done', { sessionId, inputTokens: 0, outputTokens: 0 })
      this.recordCall(sessionId, model, 0, 0, callStart)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      this.broadcast('chat:error', { sessionId, error: msg })
    }
  }

  private recordCall(
    sessionId: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    callStart: number,
  ): void {
    try {
      const modelConfig = modelRegistry.getModels().find(m => m.id === model)
      const cost = modelRegistry.calculateCost(model, inputTokens, outputTokens)
      stateLedger.logModelCall({
        session_id: sessionId,
        panel_id:   'chat',
        model_id:   model,
        provider:   modelConfig?.provider ?? 'unknown',
        tokens_in:  inputTokens,
        tokens_out: outputTokens,
        cost_usd:   cost,
        latency_ms: Date.now() - callStart,
      })
      const stats = stateLedger.getSessionStats(sessionId)
      this.broadcast('ledger:stats-update', stats)
    } catch (err) {
      log.error('[LLMService] Failed to record call:', err)
    }
  }
}

export const llmService = new LLMService()
