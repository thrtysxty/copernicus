
export async function dispatchOllamaAnthropic(opts: {
  modelId: string
  systemPrompt: string
  task: string
  maxTokens?: number
  baseUrl?: string
}): Promise<string> {
  const base = opts.baseUrl ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
  const url = `${base}/api/messages`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: opts.modelId,
        max_tokens: opts.maxTokens ?? 2048,
        system: opts.systemPrompt,
        messages: [{ role: 'user', content: opts.task }],
      }),
      signal: AbortSignal.timeout(120_000),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`ollama-anthropic error ${res.status}: ${body.slice(0, 200)}`)
    }

    const json = await res.json() as any
    return json.content?.[0]?.text ?? ''
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('OLLAMA_TIMEOUT: Ollama request timed out')
    }
    if (err.cause?.code === 'ECONNREFUSED' || err.message?.includes('fetch failed')) {
      throw new Error(`OLLAMA_UNREACHABLE: Could not connect to Ollama at ${base}`)
    }
    throw err
  }
}
