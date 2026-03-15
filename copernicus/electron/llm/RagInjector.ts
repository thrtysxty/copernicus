import { contextManager } from './ContextManager'
import { authManager } from '../auth-manager'
import { modelRegistry } from '../models/model-registry'

export interface RagChunk {
  content: string
  filePath: string
  startLine: number
  endLine: number
  score: number  // cosine similarity 0–1
}

export interface InjectedContext {
  content: string
  injectedCount: number
  summarisedCount: number
  droppedCount: number
  tokensUsed: number
}

export class RagInjector {
  private budget = 4000     // tokens
  private chunkLimit = 500  // tokens
  private summariseEnabled = true

  async inject(chunks: RagChunk[], modelId: string): Promise<InjectedContext> {
    // 1. Sort chunks by score descending
    const sorted = [...chunks].sort((a, b) => b.score - a.score)

    let injectedCount = 0
    let summarisedCount = 0
    let droppedCount = 0
    let totalTokens = 0
    const resultChunks: string[] = []

    for (const chunk of sorted) {
      let content = chunk.content
      let isSummarised = false

      if (this.summariseEnabled && contextManager.countTokens(content) > this.chunkLimit) {
        content = await this.summariseChunk(chunk, modelId)
        isSummarised = true
      }

      const chunkTokens = contextManager.countTokens(content)

      if (totalTokens + chunkTokens <= this.budget) {
        const header = `--- File: ${chunk.filePath}${isSummarised ? ' [SUMMARISED]' : ''} ---`
        resultChunks.push(`${header}\n${content}`)
        totalTokens += chunkTokens
        injectedCount++
        if (isSummarised) summarisedCount++
      } else {
        droppedCount++
      }
    }

    const transparencyHeader = `[Context: ${injectedCount} chunks injected, ${summarisedCount} summarised, ${droppedCount} dropped — budget: ${this.budget} tokens]\n\n`
    
    return {
      content: transparencyHeader + resultChunks.join('\n\n'),
      injectedCount,
      summarisedCount,
      droppedCount,
      tokensUsed: totalTokens
    }
  }

  private async summariseChunk(chunk: RagChunk, modelId: string): Promise<string> {
    try {
      const modelConfig = modelRegistry.getModels().find(m => m.id === modelId)
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
        if (modelId.endsWith(':cloud') || provider === 'ollama-cloud') {
          apiKey = authManager.getApiKey('ollama-cloud') || ''
          baseUrl = authManager.getBaseUrl('ollama-cloud') || ''
        } else {
          baseUrl = authManager.getBaseUrl('ollama') || ''
        }
      }

      const response = await fetch('http://127.0.0.1:5001/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'summarise-jit',
          messages: [{ role: 'user', content: `Summarise this code snippet in ≤100 words:\n${chunk.content}` }],
          model: modelId,
          provider,
          apiKey,
          baseUrl,
          max_tokens: 150
        })
      })

      if (!response.ok) return `[SUMMARY FAILED: ${response.status}]\n${chunk.content.slice(0, 500)}...`

      // Chat API is streaming by default but we want the final content
      // We'll have to parse the SSE stream or if the backend supports non-streaming
      // Since LLMService uses streaming, we'll assume the backend /api/llm/chat is streaming.
      // Wait, let's see if there's a non-streaming endpoint.
      // If not, we'll have to read the stream.
      
      const reader = response.body?.getReader()
      if (!reader) return `[SUMMARY FAILED: No Reader]\n${chunk.content.slice(0, 500)}...`

      const decoder = new TextDecoder()
      let summary = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        const lines = text.split('\n\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6)
            if (dataStr === '[DONE]') continue
            try {
              const data = JSON.parse(dataStr)
              if (data.token) summary += data.token
            } catch {}
          }
        }
      }

      return `[SUMMARY OF ${chunk.filePath}:${chunk.startLine}-${chunk.endLine}]\n${summary.trim()}`
    } catch (err) {
      console.error('Failed to summarise chunk:', err)
      return `[SUMMARY ERROR]\n${chunk.content.slice(0, 500)}...`
    }
  }

  setBudget(tokens: number): void { this.budget = tokens }
  setChunkLimit(tokens: number): void { this.chunkLimit = tokens }
  setSummariseEnabled(enabled: boolean): void { this.summariseEnabled = enabled }

  updateFromSettings(settings: any): void {
    if (settings.ragBudget) this.budget = settings.ragBudget
    if (settings.ragChunkLimit) this.chunkLimit = settings.ragChunkLimit
    if (settings.ragSummariseEnabled !== undefined) this.summariseEnabled = settings.ragSummariseEnabled
  }
}

export const ragInjector = new RagInjector()
