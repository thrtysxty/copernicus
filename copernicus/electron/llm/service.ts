import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenerativeAI, Content, Part } from '@google/generative-ai'
import { BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import { authManager } from '../auth-manager'
import { modelRegistry } from '../models/model-registry'
import { stateLedger } from '../db/state-ledger'
import { TOOLS, toolExecutor } from './tools'
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
      if (provider === 'anthropic') {
        await this.streamAnthropic(sessionId, messages, model, system, callStart)
      } else if (provider === 'google') {
        await this.streamGoogle(sessionId, messages, model, system, callStart)
      } else if (provider === 'openai' || provider === 'openrouter' || provider === 'deepinfra' || provider === 'ollama') {
        // openai / openrouter / deepinfra / ollama — all OpenAI-compatible
        await this.streamOpenAICompat(sessionId, messages, model, system, callStart)
      } else {
        throw new Error(`Unsupported provider: ${provider}`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      this.broadcast('chat:error', { sessionId, error: msg })
    }
  }

  private async streamClaudeCli(
    sessionId: string,
    messages: ChatMessage[],
    system: string,
    callStart: number
  ): Promise<void> {
    const cli = authManager.findClaudeCli()
    if (!cli) throw new Error('Claude CLI not found. Install Claude Code from claude.ai/download, then run `claude login`.')

    const history = messages.slice(0, -1)
      .map(m => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`)
      .join('\n\n')
    const lastMsg = messages[messages.length - 1].content
    const prompt = history ? `${history}\n\nHuman: ${lastMsg}` : lastMsg

    const args = ['--print', '--output-format', 'stream-json', '--system-prompt', system]

    return new Promise<void>((resolve, reject) => {
      const proc = spawn(cli, args, { env: { ...process.env }, stdio: ['pipe', 'pipe', 'pipe'] })

      proc.stdin.write(prompt)
      proc.stdin.end()

      let buf = ''
      proc.stdout.on('data', (data: Buffer) => {
        buf += data.toString()
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const ev = JSON.parse(line)
            if (ev.type === 'assistant' && Array.isArray(ev.message?.content)) {
              for (const block of ev.message.content) {
                if (block.type === 'text') this.broadcast('chat:token', { sessionId, token: block.text })
              }
            }
          } catch { /* partial line */ }
        }
      })

      proc.stderr.on('data', (d: Buffer) => log.warn('[claude-cli]', d.toString().trim()))

      proc.on('close', (code: number | null) => {
        if (code !== 0 && code !== null) {
          reject(new Error(`Claude CLI exited ${code} — run \`claude login\` in a terminal to re-authenticate.`))
        } else {
          this.broadcast('chat:done', { sessionId, inputTokens: 0, outputTokens: 0 })
          this.recordCall(sessionId, 'claude-cli', 0, 0, callStart)
          resolve()
        }
      })

      proc.on('error', (err: Error) => reject(new Error(`Failed to start Claude CLI: ${err.message}`)))
    })
  }

  private async streamAnthropic(
    sessionId: string,
    messages: ChatMessage[],
    model: string,
    system: string,
    callStart: number
  ): Promise<void> {
    if (authManager.getAnthropicMethod() === 'cli') {
      return this.streamClaudeCli(sessionId, messages, system, callStart)
    }

    const key = authManager.getApiKey('anthropic')
    if (!key) throw new Error('No Anthropic key configured')

    const client = new Anthropic({ apiKey: key })
    const anthropicMessages: Anthropic.MessageParam[] = messages.map(m => ({ role: m.role, content: m.content }))

    const anthropicTools: Anthropic.Tool[] = TOOLS.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: {
        type: 'object',
        properties: t.parameters.properties,
        required: t.parameters.required
      }
    }))

    const currentMessages = [...anthropicMessages]
    let toolCallsMade = 0
    const maxToolCalls = 5

    while (toolCallsMade < maxToolCalls) {
      const stream = client.messages.stream({
        model,
        max_tokens: 4096,
        system,
        messages: currentMessages,
        tools: anthropicTools,
      })

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          this.broadcast('chat:token', { sessionId, token: chunk.delta.text })
        }
      }

      const finalMessage = await stream.finalMessage()
      this.recordCall(sessionId, model, finalMessage.usage.input_tokens, finalMessage.usage.output_tokens, callStart)

      const toolUses = finalMessage.content.filter(c => c.type === 'tool_use') as Anthropic.ToolUseBlock[]
      
      if (toolUses.length === 0) {
        this.broadcast('chat:done', {
          sessionId,
          inputTokens: finalMessage.usage.input_tokens,
          outputTokens: finalMessage.usage.output_tokens,
        })
        return
      }

      // Handle tool uses
      toolCallsMade++
      currentMessages.push({ role: 'assistant', content: finalMessage.content })

      for (const toolUse of toolUses) {
        this.broadcast('chat:status', { sessionId, status: `🔧 Executing ${toolUse.name}...` })
        try {
          const result = await toolExecutor.execute(toolUse.name, toolUse.input)
          currentMessages.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: result,
              },
            ],
          })
        } catch (err: any) {
          currentMessages.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: `Error: ${err.message}`,
                is_error: true,
              },
            ],
          })
        }
      }
    }

    this.broadcast('chat:error', { sessionId, error: 'Maximum tool call depth reached' })
  }

  private async streamGoogle(
    sessionId: string,
    messages: ChatMessage[],
    model: string,
    system: string,
    callStart: number
  ): Promise<void> {
    const apiKey = authManager.getApiKey('google')
    if (!apiKey) throw new Error('No Google API key configured')

    const modelId = model.replace(/^[^/]+\//, '')
    const genAI = new GoogleGenerativeAI(apiKey)
    
    const googleTools = [{
      functionDeclarations: TOOLS.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters as any
      }))
    }]

    const geminiModel = genAI.getGenerativeModel({
      model: modelId,
      systemInstruction: system,
      tools: googleTools
    })

    const history: Content[] = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
    
    const chat = geminiModel.startChat({ history })
    let lastMessageContent = messages[messages.length - 1].content
    let toolCallsMade = 0
    const maxToolCalls = 5

    while (toolCallsMade < maxToolCalls) {
      const result = await chat.sendMessageStream(lastMessageContent)

      for await (const chunk of result.stream) {
        const text = chunk.text()
        if (text) this.broadcast('chat:token', { sessionId, token: text })
      }

      const finalResponse = await result.response
      const calls = finalResponse.functionCalls()

      if (!calls || calls.length === 0) {
        const outputTokens = finalResponse.usageMetadata?.candidatesTokenCount ?? 0
        const inputTokens = finalResponse.usageMetadata?.promptTokenCount ?? 0
        this.broadcast('chat:done', { sessionId, inputTokens, outputTokens })
        this.recordCall(sessionId, model, inputTokens, outputTokens, callStart)
        return
      }

      // Handle function calls
      toolCallsMade++
      const toolParts: Part[] = []

      for (const call of calls) {
        this.broadcast('chat:status', { sessionId, status: `⌖ Executing ${call.name}...` })
        try {
          const result = await toolExecutor.execute(call.name, call.args)
          toolParts.push({
            functionResponse: {
              name: call.name,
              response: { content: result }
            }
          })
        } catch (err: any) {
          toolParts.push({
            functionResponse: {
              name: call.name,
              response: { error: err.message }
            }
          })
        }
      }

      // In Gemini, we send the function responses back
      // and continue the chat.
      const followUp = await chat.sendMessageStream(toolParts)
      // The while loop will handle the next response
      // But we need to update the usage for the intermediate step
      const interimResponse = await followUp.response
      this.recordCall(sessionId, model, interimResponse.usageMetadata?.promptTokenCount ?? 0, interimResponse.usageMetadata?.candidatesTokenCount ?? 0, callStart)
      
      // We don't want to re-send the initial message next time
      lastMessageContent = toolParts as any 
    }

    this.broadcast('chat:error', { sessionId, error: 'Maximum tool call depth reached' })
  }

  private async streamOpenAICompat(
    sessionId: string,
    messages: ChatMessage[],
    model: string,
    system: string,
    callStart: number
  ): Promise<void> {
    const resolved = authManager.resolveOpenAICompatibleKey()
    if (!resolved) throw new Error('No OpenAI-compatible API key configured')

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
