import { describe, it, expect, beforeEach } from 'vitest'
import { ContextManager } from './ContextManager'
import { ChatMessage } from './service'

describe('ContextManager', () => {
  let contextManager: ContextManager

  beforeEach(() => {
    contextManager = new ContextManager()
  })

  it('should count tokens approximately (length / 4)', () => {
    const text = 'hello world'
    // 'hello world' is 11 chars. 11/4 = 2.75 -> ceil(2.75) = 3
    expect(contextManager.countTokens(text)).toBe(3)
  })

  it('should calculate total context size correctly', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'hello' }, // length 5 -> tokens 2
      { role: 'assistant', content: 'hi there' } // length 8 -> tokens 2
    ]
    const systemPrompt = 'you are an assistant' // length 20 -> tokens 5
    // Total tokens: 2 + 2 + 5 = 9
    expect(contextManager.calculateContextSize(messages, systemPrompt)).toBe(9)
  })

  it('should get correct max context for models', () => {
    // Falls back based on model name if not in registry
    expect(contextManager.getMaxContextForModel('llama3:8b')).toBe(8192)
    expect(contextManager.getMaxContextForModel('llama3:70b')).toBe(128000)
    expect(contextManager.getMaxContextForModel('gpt-4o')).toBe(128000)
  })

  it('should get correct max output tokens', () => {
    expect(contextManager.getMaxOutputTokensForModel('llama3:8b')).toBe(2048)
    expect(contextManager.getMaxOutputTokensForModel('llama3:70b')).toBe(8192)
  })

  it('should trigger compaction based on threshold', () => {
    const usedTokens = 800
    const maxContext = 1000
    contextManager.setCompactionThreshold(0.8)
    expect(contextManager.shouldCompact(usedTokens, maxContext)).toBe(true)
    expect(contextManager.shouldCompact(799, maxContext)).toBe(false)
  })

  it('should compact messages by summarising oldest half', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'msg 1' },
      { role: 'assistant', content: 'reply 1' },
      { role: 'user', content: 'msg 2' },
      { role: 'assistant', content: 'reply 2' },
      { role: 'user', content: 'msg 3' },
      { role: 'assistant', content: 'reply 3' }
    ]
    const compacted = contextManager.compact(messages)
    // 6 messages -> oldest half (3) should be compacted.
    // Wait, the implementation note says "Summarise oldest half of messages into a single assistant message"
    // and "Return: [compacted_message, ...recent_half]"
    // If we have 6 messages, 3 are old.
    // Compacted result should be: [compacted_message, msg 4, reply 2, msg 3, reply 3]? 
    // Wait, "oldest half" of 6 is 3. So msg 1, reply 1, msg 2 are old.
    // Remaining: reply 2, msg 3, reply 3.
    // Result: [compacted, reply 2, msg 3, reply 3] -> length 4
    
    expect(compacted.length).toBe(Math.ceil(messages.length / 2) + 1)
    expect(compacted[0]!.role).toBe('assistant')
    expect(compacted[0]!.content).toContain('[COMPACTED: summary of 3 turns]')
  })
})
