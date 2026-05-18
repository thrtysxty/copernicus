import { config } from '../config'
import { BrowserWindow } from 'electron'
import { authManager } from '../auth-manager'
import { modelRegistry } from '../models/model-registry'
import { stateLedger } from '../db/state-ledger'
import { SettingsStore } from '../settings-store'
import log from '../utils/logger'
import { TOOLS, ToolExecutor } from './tools'
import { contextManager } from './ContextManager'
import { systemPromptBuilder } from './system-prompt-builder'
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatPayload {
  sessionId: string
  messages: ChatMessage[]
  model: string
  systemPrompt?: string
  bankId?: string;    // new — forwarded from renderer for system prompt context
  persona?: string;  // new — forwarded from renderer for system prompt context
}

const MAX_TOOL_DEPTH = 5

export class LLMService {
  private broadcast(channel: string, payload: object) {
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) win.webContents.send(channel, payload)
    })
  }

  async streamChat(payload: ChatPayload, depth = 0): Promise<void> {
    const { sessionId, messages, model, systemPrompt, bankId, persona } = payload

    const callStart = Date.now()

    // STORY 363: Context Management
    const settings = new SettingsStore().getAll()

    const builtSystem = systemPromptBuilder.build({
      projectName: settings.projectName as string | undefined,
      bankId: bankId,
      persona: persona,
    })
    const system = systemPrompt ?? builtSystem

    contextManager.updateFromSettings(settings)

    const usedTokens = contextManager.calculateContextSize(messages, system)
    const maxContext = contextManager.getMaxContextForModel(model)
    this.broadcast('chat:context-update', { 
      sessionId, 
      usedTokens, 
      maxTokens: maxContext, 
      percentage: usedTokens / maxContext 
    })

    let finalMessages = messages
    if (contextManager.shouldCompact(usedTokens, maxContext)) {
      finalMessages = contextManager.compact(messages)
    }

    const maxOutputTokens = contextManager.getMaxOutputTokensForModel(model)

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
      } else if (provider === 'ollama' || provider === 'ollama-cloud') {
        if (model.endsWith(':cloud') || provider === 'ollama-cloud') {
          apiKey = authManager.getApiKey('ollama-cloud') || ''
          baseUrl = authManager.getBaseUrl('ollama-cloud') || ''
        } else {
          baseUrl = authManager.getBaseUrl('ollama') || ''
        }
      }

      // Anthropic provider: cache_control wrapping
      let finalSystemPrompt: any = system;
      if (provider === 'anthropic') {
        finalSystemPrompt = [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }];
      }

      const response = await fetch(`${config.backend.url}/api/llm/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          messages: finalMessages,
          model,
          provider,
          systemPrompt: finalSystemPrompt,
          apiKey,
          baseUrl,
          tools: TOOLS,
          max_tokens: maxOutputTokens
        })
      })

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status} ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let buffer = ''
      let fullResponseText = ''

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
            this.broadcast('chat:done', { sessionId, inputTokens: 0, outputTokens: 0, fullResponseText })
            this.recordCall(sessionId, model, 0, 0, callStart)
            return
          }

          try {
            const data = JSON.parse(dataStr)
            if (data.error) {
              this.broadcast('chat:error', { sessionId, error: data.error })
              return
            } else if (data.token) {
              fullResponseText += data.token
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

      this.broadcast('chat:done', { sessionId, inputTokens: 0, outputTokens: 0, fullResponseText })
      this.recordCall(sessionId, model, 0, 0, callStart)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      this.broadcast('chat:error', { sessionId, error: msg })
    }
  }

  async generateText(prompt: string, model: string = 'claude-3-5-sonnet-20240620'): Promise<string> {
    const modelConfig = modelRegistry.getModels().find(m => m.id === model)
    const provider = modelConfig?.provider ?? 'anthropic'

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
    } else if (provider === 'ollama' || provider === 'ollama-cloud') {
      if (model.endsWith(':cloud') || provider === 'ollama-cloud') {
        apiKey = authManager.getApiKey('ollama-cloud') || ''
        baseUrl = authManager.getBaseUrl('ollama-cloud') || ''
      } else {
        baseUrl = authManager.getBaseUrl('ollama') || ''
      }
    }

    try {
      const response = await fetch(`${config.backend.url}/api/llm/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.COPERNICUS_API_KEY || '' },
        body: JSON.stringify({
          sessionId: `gen-${Date.now()}`,
          messages: [{ role: 'user', content: prompt }],
          model,
          provider,
          apiKey,
          baseUrl
        })
      })

      if (!response.ok) throw new Error(`LLM API Error: ${response.statusText}`)
      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
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
          if (dataStr === '[DONE]') return fullText

          try {
            const data = JSON.parse(dataStr)
            if (data.token) fullText += data.token
            else if (data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content) {
              fullText += data.choices[0].delta.content
            }
          } catch (e) {
            // ignore
          }
        }
      }

      return fullText
    } catch (e) {
      log.error('[generateText] Failed:', e)
      return ''
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
