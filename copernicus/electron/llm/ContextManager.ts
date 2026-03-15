import { ChatMessage } from './service'
import { modelRegistry } from '../models/model-registry'

export class ContextManager {
  private compactionThreshold = 0.80  // 80%
  private maxTokensOverrides: Record<string, number> = {}

  countTokens(text: string): number {
    if (!text) return 0
    return Math.ceil(text.length / 4)
  }

  calculateContextSize(messages: ChatMessage[], systemPrompt: string): number {
    let total = this.countTokens(systemPrompt)
    for (const msg of messages) {
      total += this.countTokens(msg.content)
    }
    return total
  }

  getMaxContextForModel(modelId: string): number {
    const models = modelRegistry.getModels()
    const config = models.find(m => m.id === modelId)
    if (config?.contextWindow) {
      return config.contextWindow
    }

    // Fallbacks
    if (modelId.includes('8b') || modelId.includes('7b')) return 8192
    if (modelId.includes('32b') || modelId.includes('35b')) return 32768
    if (modelId.includes('70b') || modelId.includes('gpt-4') || modelId.includes('claude')) return 128000
    
    return 128000
  }

  getMaxOutputTokensForModel(modelId: string): number {
    if (this.maxTokensOverrides[modelId]) {
      return this.maxTokensOverrides[modelId]
    }

    if (modelId.includes('8b') || modelId.includes('7b')) return 2048
    if (modelId.includes('32b') || modelId.includes('35b')) return 4096
    
    return 8192
  }

  shouldCompact(usedTokens: number, maxContext: number): boolean {
    return usedTokens / maxContext >= this.compactionThreshold
  }

  compact(messages: ChatMessage[]): ChatMessage[] {
    if (messages.length <= 1) return messages

    const numToCompact = Math.floor(messages.length / 2)
    const recentMessages = messages.slice(numToCompact)

    // In a real scenario, we might want to actually summarise using an LLM.
    // But for this story, we'll prefix it as a summary block as requested.
    // Usually, a compaction "summarise" call would happen here.
    // For now, we'll follow the pattern: [COMPACTED: summary of N turns]
    
    const summaryContent = `[COMPACTED: summary of ${numToCompact} turns]
Older messages were removed to save context. Focus on the most recent context below.`

    const compactedMessage: ChatMessage = {
      role: 'assistant',
      content: summaryContent
    }

    return [compactedMessage, ...recentMessages]
  }

  setCompactionThreshold(t: number): void {
    this.compactionThreshold = t
  }

  setMaxTokensOverride(modelId: string, tokens: number): void {
    this.maxTokensOverrides[modelId] = tokens
  }

  updateFromSettings(settings: any): void {
    if (settings.compactionThreshold) {
      this.compactionThreshold = settings.compactionThreshold / 100
    }
    if (settings.maxTokensOverrides) {
      this.maxTokensOverrides = settings.maxTokensOverrides
    }
  }
}

export const contextManager = new ContextManager()
