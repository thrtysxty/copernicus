import { stateLedger } from '../db/state-ledger'
import { fsManager } from '../fs-manager'
import path from 'path'
import fs from 'fs'
import { authManager } from '../auth-manager'
import { modelRegistry } from '../models/model-registry'

export interface RetroSynthesis {
  memory_facts?: {
    content: string
    importance: number
    tags?: string[]
    supersedes_memory_id?: string
  }[]
  file_patches?: {
    target: string
    content: string
  }[]
  story_queues?: {
    content: string
  }[]
  conventions?: {
    content: string
  }[]
}

export class RetroSynthesizer {
  async synthesize(params: {
    projectId: string
    scope: string
    fromTs: number
    toTs: number
  }): Promise<string> {
    const { projectId, scope, fromTs, toTs } = params

    // Phase 1 - Context assembly
    const memoryRows = stateLedger.getAgentMemoryTimeRange(projectId, fromTs, toTs, 500)
    const workLogRows = stateLedger.getAgentWorkLogTimeRange(projectId, fromTs, toTs, 200)

    const rootPath = fsManager.getRootPath()
    const retrosPath = path.join(rootPath, '.claude', 'retros')
    let priorRetroText = ''
    let priorRetroFiles: string[] = []
    
    if (fs.existsSync(retrosPath)) {
      const files = fs.readdirSync(retrosPath)
        .filter(f => f.endsWith('.md'))
        .sort((a, b) => b.localeCompare(a)) // Sort descending to get most recent first
        .slice(0, 3) // Get up to 3 most recent
        
      priorRetroFiles = files

      for (const file of files) {
        const fullPath = path.join(retrosPath, file)
        const content = fs.readFileSync(fullPath, 'utf-8')
        priorRetroText += `\n\n--- Prior Retro: ${file} ---\n${content}`
      }
    }

    const formattedMemoryRows = memoryRows.map(r => JSON.stringify(r)).join('\n')
    const formattedWorkLogRows = workLogRows.map(r => JSON.stringify(r)).join('\n')

    // Phase 2 - Structured synthesis
    const systemPrompt = `You are the Copernicus Retrospective Synthesizer.
Synthesize the provided session data into a JSON structure matching this exact interface:

export interface RetroSynthesis {
  memory_facts: {
    content: string
    importance: number
    tags?: string[]
    supersedes_memory_id?: string
  }[]
  file_patches: {
    target: string
    content: string
  }[]
  story_queues: {
    content: string
  }[]
  conventions: {
    content: string
  }[]
}

Output ONLY valid JSON. No markdown formatting, no explanations.`

    const userPrompt = `## Memory Facts\n${formattedMemoryRows}\n\n## Work Log\n${formattedWorkLogRows}\n\n## Prior Retrospectives\n${priorRetroText}\n\nSynthesize into a RetroSynthesis JSON with keys: memory_facts[], file_patches[], story_queues[], conventions[]`

    const models = modelRegistry.getModels()
    let thinkerModel = models.find(m => m.id.includes('deepseek') || m.id.includes('thinker') || m.id.includes('claude-3-opus'))
    
    if (!thinkerModel) {
      thinkerModel = modelRegistry.getActiveModel()
    }
    
    const modelId = thinkerModel?.id || 'deepseek-v3.2:cloud'
    const provider = thinkerModel?.provider || 'anthropic'
    
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

    async function callLlm(retryPrompt?: string): Promise<string> {
      const messages = [{ role: 'user', content: retryPrompt || userPrompt }]
      
      let finalSystemPrompt: any = systemPrompt;
      if (provider === 'anthropic') {
        finalSystemPrompt = [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }];
      }

      const response = await fetch('http://127.0.0.1:5001/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'retro-synthesis',
          messages: messages,
          model: modelId,
          provider: provider,
          systemPrompt: finalSystemPrompt,
          apiKey: apiKey,
          baseUrl: baseUrl,
          max_tokens: 4000
        })
      })

      if (!response.ok) {
        throw new Error(`LLM synthesis failed: ${response.status} ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let buffer = ''
      let fullResponse = ''

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
            return fullResponse
          }
          
          try {
            const data = JSON.parse(dataStr)
            if (data.error) throw new Error(data.error)
            
            if (data.token) {
              fullResponse += data.token
            } else if (data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content) {
               fullResponse += data.choices[0].delta.content
            }
          } catch (e) {
            // Ignore parse errors for partial chunks
          }
        }
      }
      return fullResponse
    }

    let resultJsonStr = await callLlm()

    let synthesis: RetroSynthesis
    
    const extractJson = (str: string) => {
      const match = str.match(/\{[\s\S]*\}/)
      if (match) return match[0]
      return str
    }

    try {
      const cleanStr = extractJson(resultJsonStr.trim())
      synthesis = JSON.parse(cleanStr) as RetroSynthesis
    } catch (e) {
      // Retry once with explicit instruction
      const retryPrompt = `${userPrompt}\n\nYOUR PREVIOUS RESPONSE FAILED TO PARSE AS JSON. YOU MUST RETURN ONLY VALID JSON MATCHING THE RetroSynthesis INTERFACE.`
      const retryJsonStr = await callLlm(retryPrompt)
      
      try {
        const cleanStr = extractJson(retryJsonStr.trim())
        synthesis = JSON.parse(cleanStr) as RetroSynthesis
      } catch (e2) {
        throw new Error('Failed to parse RetroSynthesis JSON after retry')
      }
    }

    // Persist to database
    const items: any[] = []
    
    if (synthesis.memory_facts) {
      for (const fact of synthesis.memory_facts) {
        items.push({
          item_type: 'memory_fact',
          content: fact.content,
          importance: fact.importance,
          supersedes_memory_id: fact.supersedes_memory_id,
          status: 'pending',
          ts: Date.now()
        })
      }
    }
    
    if (synthesis.file_patches) {
      for (const patch of synthesis.file_patches) {
        items.push({
          item_type: 'file_patch',
          content: patch.content,
          target: patch.target,
          status: 'pending',
          ts: Date.now()
        })
      }
    }
    
    if (synthesis.story_queues) {
      for (const queue of synthesis.story_queues) {
        items.push({
          item_type: 'story_queue',
          content: queue.content,
          status: 'pending',
          ts: Date.now()
        })
      }
    }
    
    if (synthesis.conventions) {
      for (const conv of synthesis.conventions) {
        items.push({
          item_type: 'convention',
          content: conv.content,
          status: 'pending',
          ts: Date.now()
        })
      }
    }

    const reportId = stateLedger.createRetroReport({
      project_id: projectId,
      scope: scope,
      status: 'pending_review',
      ts_generated: Date.now(),
      sessions_range: `${fromTs}-${toTs}`,
      inflection_ids: priorRetroFiles.join(','),
      items: items
    })

    // Notify renderer
    stateLedger.pushRetroReady(reportId)
    const win = require('electron').BrowserWindow.getAllWindows()[0]
    if (win) {
        win.webContents.send('retro:ready', { reportId })
    }

    return reportId
  }
}

export const retroSynthesizer = new RetroSynthesizer()