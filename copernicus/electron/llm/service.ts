import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
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
    const system = systemPrompt ?? 'You are a helpful assistant inside the COPERNICUS IDE.'
    const callStart = Date.now()

    // Look up the model's provider from the registry
    const modelConfig = modelRegistry.getModels().find(m => m.id === model)
    const provider = modelConfig?.provider ?? 'anthropic'

    try {
      if (provider === 'anthropic') {
        await this.streamAnthropic(sessionId, messages, model, system, callStart)
      } else if (provider === 'google') {
        await this.streamGoogle(sessionId, messages, model, system, callStart)
      } else {
        // openai / openrouter / deepinfra — all OpenAI-compatible
        await this.streamOpenAICompat(sessionId, messages, model, system, callStart)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      this.broadcast('chat:error', { sessionId, error: msg })
    }
  }

  private async streamAnthropic(
    sessionId: string,
    messages: ChatMessage[],
    model: string,
    system: string,
    callStart: number
  ): Promise<void> {
    const keyOrSession = authManager.getApiKey('anthropic')
    if (!keyOrSession) throw new Error('No Anthropic credentials configured')

    // Detect if this is an API Key or a captured Session Token
    const isApiKey = keyOrSession.startsWith('sk-ant-')

    if (isApiKey) {
      const client = new Anthropic({ apiKey: keyOrSession })
      const stream = client.messages.stream({
        model,
        max_tokens: 4096,
        system,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      })

      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          this.broadcast('chat:token', { sessionId, token: chunk.delta.text })
        }
      }

      const final = await stream.finalMessage()
      this.broadcast('chat:done', {
        sessionId,
        inputTokens: final.usage.input_tokens,
        outputTokens: final.usage.output_tokens,
      })
      this.recordCall(sessionId, model, final.usage.input_tokens, final.usage.output_tokens, callStart)
    } else {
      // HANDLE WEB SESSION TOKEN (Claude.ai)
      // Custom implementation for session-based streaming as SDK doesn't support cookies
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'cookie': `sessionKey=${keyOrSession}`,
          'accept': 'text/event-stream'
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          system,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          stream: true
        })
      })

      if (!response.ok) {
        const errBody = await response.text()
        throw new Error(`Anthropic Session Error: ${response.status} ${errBody}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('Failed to open Anthropic stream')

      const decoder = new TextDecoder()
      let inputTokens = 0
      let outputTokens = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'content_block_delta' && data.delta?.text) {
                this.broadcast('chat:token', { sessionId, token: data.delta.text })
              }
              if (data.type === 'message_start') {
                inputTokens = data.message?.usage?.input_tokens ?? 0
              }
              if (data.type === 'message_delta') {
                outputTokens = data.usage?.output_tokens ?? 0
              }
            } catch { /* parse error on partial chunk */ }
          }
        }
      }

      this.broadcast('chat:done', { sessionId, inputTokens, outputTokens })
      this.recordCall(sessionId, model, inputTokens, outputTokens, callStart)
    }
  }

  private async streamGoogle(
    sessionId: string,
    messages: ChatMessage[],
    model: string,
    system: string,
    callStart: number
  ): Promise<void> {
    const apiKey = authManager.getApiKey('google')
    if (!apiKey) throw new Error('No Google API key or credentials configured')

    const modelId = model.replace(/^[^/]+\//, '')

    const genAI = new GoogleGenerativeAI(apiKey)
    const geminiModel = genAI.getGenerativeModel({
      model: modelId,
      systemInstruction: system,
    })

    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
    const lastMessage = messages[messages.length - 1]

    const chat = geminiModel.startChat({ history })
    const result = await chat.sendMessageStream(lastMessage.content)

    for await (const chunk of result.stream) {
      const text = chunk.text()
      if (text) this.broadcast('chat:token', { sessionId, token: text })
    }

    const finalResponse = await result.response
    const outputTokens = finalResponse.usageMetadata?.candidatesTokenCount ?? 0
    const inputTokens = finalResponse.usageMetadata?.promptTokenCount ?? 0
    this.broadcast('chat:done', { sessionId, inputTokens, outputTokens })
    this.recordCall(sessionId, model, inputTokens, outputTokens, callStart)
  }

  private async streamOpenAICompat(
    sessionId: string,
    messages: ChatMessage[],
    model: string,
    system: string,
    callStart: number
  ): Promise<void> {
    const resolved = authManager.resolveOpenAICompatibleKey()
    if (!resolved) throw new Error('No OpenAI-compatible API key configured (OpenRouter / OpenAI / DeepInfra)')

    const client = new OpenAI({
      apiKey: resolved.key,
      baseURL: resolved.baseUrl,
      defaultHeaders: resolved.headers,
    })

    const stream = await client.chat.completions.create({
      model,
      stream: true,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: system },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ],
    })

    let inputTokens = 0
    let outputTokens = 0

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content
      if (delta) {
        this.broadcast('chat:token', { sessionId, token: delta })
      }
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens ?? 0
        outputTokens = chunk.usage.completion_tokens ?? 0
      }
    }

    this.broadcast('chat:done', { sessionId, inputTokens, outputTokens })
    this.recordCall(sessionId, model, inputTokens, outputTokens, callStart)
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
