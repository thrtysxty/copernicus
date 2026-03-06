import { BrowserWindow } from 'electron'
import { authManager } from '../auth-manager'
import { modelRegistry } from '../models/model-registry'
import { stateLedger } from '../db/state-ledger'
import log from '../utils/logger'

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

export class LLMService {
  private broadcast(channel: string, payload: object) {
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) win.webContents.send(channel, payload)
    })
  }

  async streamChat(payload: ChatPayload): Promise<void> {
    const { sessionId, messages, model, systemPrompt } = payload
    
    const DEFAULT_SYSTEM_PROMPT = `You are the primary AI orchestrator inside the COPERNICUS IDE. 
Your goal is to assist the user with industrial-scale software engineering.

CORE PROTOCOLS:
1. REPO RAG: You have access to the local codebase via the 'search_codebase' and 'read_file' tools. If the user's request is vague or refers to existing logic, you MUST search the codebase before asking the user for paths.
2. LOCAL DELEGATION: For tactical tasks like documentation, quick bug fixes, or UI tweaks, you can delegate to local sidekick models using 'local_research'.
3. SURGICAL EDITS: When providing code, provide complete, valid blocks. Avoid placeholders like "// ... rest of code".
4. CONTEXT AWARENESS: You are running in a professional environment. Prefer efficiency and technical precision over conversational filler.`

    const system = systemPrompt ?? DEFAULT_SYSTEM_PROMPT
    const callStart = Date.now()

    // Look up the model's provider from the registry
    const modelConfig = modelRegistry.getModels().find(m => m.id === model)
    const provider = modelConfig?.provider ?? 'anthropic'

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
          baseUrl
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
          if (line.startsWith('data: ')) {
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
              } else if (data.token) {
                this.broadcast('chat:token', { sessionId, token: data.token })
              }
            } catch (e) {
              log.error('[LLMService] Failed to parse SSE data:', e, dataStr)
            }
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
