import { stateLedger, StoryRecord, JulesSession } from '../db/state-ledger'
import { generateJulesPrompt } from './prompt-generator'

const JULES_API_BASE = 'https://jules.google.com/v1alpha'

export interface DispatchOptions {
  story: StoryRecord
  repo: string           // 'owner/repo' e.g. 'dadmin/agentic-platform'
  branch: string         // target branch, usually 'main'
  apiKey: string         // Jules API key (from AuthManager)
  requirePlanApproval?: boolean  // default false for automated dispatch
}

export interface DispatchResult {
  ok: boolean
  sessionId?: string
  error?: string
}

export async function dispatchJulesSession(opts: DispatchOptions): Promise<DispatchResult> {
  const { story, repo, branch, apiKey, requirePlanApproval = false } = opts

  const { text: prompt, hash: promptHash } = generateJulesPrompt(story, repo)

  // Dedup: if a session with this prompt hash is already running, return it
  const existing = stateLedger.getJulesSessionsByStory(story.id)
    .find(s => s.prompt_hash === promptHash && ['pending', 'running'].includes(s.status))
  if (existing) {
    return { ok: true, sessionId: existing.id }
  }

  try {
    const res = await fetch(`${JULES_API_BASE}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify({
        title: `Story ${story.id.replace('story_', '')} — ${story.title}`,
        prompt,
        sourceContext: {
          repository: repo,
          ref: branch,
        },
        requirePlanApproval,
        automationMode: requirePlanApproval ? undefined : 'AUTO_CREATE_PR',
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      return { ok: false, error: `Jules API ${res.status}: ${body.slice(0, 200)}` }
    }

    const session = await res.json() as { name: string; [key: string]: any }
    // Jules session name format: 'sessions/{UUID}'
    const sessionId = session.name?.split('/').pop() ?? session.name

    const record: JulesSession = {
      id: sessionId,
      story_id: story.id,
      repo,
      branch,
      prompt_hash: promptHash,
      status: 'pending',
    }
    stateLedger.upsertJulesSession(record)

    return { ok: true, sessionId }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

export async function pollJulesSession(
  sessionId: string,
  apiKey: string
): Promise<Partial<JulesSession>> {
  const res = await fetch(`${JULES_API_BASE}/sessions/${sessionId}`, {
    headers: { 'X-Goog-Api-Key': apiKey },
  })
  if (!res.ok) throw new Error(`Jules poll ${res.status}`)

  const data = await res.json() as any
  const outputs = data.outputs ?? []
  const pr = outputs.find((o: any) => o.pullRequest)?.pullRequest

  // Map Jules state → our status
  // Jules states (inferred from API): PENDING, RUNNING, COMPLETED, FAILED
  const jState: string = (data.state ?? '').toUpperCase()
  const status: JulesSession['status'] =
    jState.includes('COMPLETE') ? 'completed' :
    jState.includes('FAIL')     ? 'failed' :
    jState.includes('RUN')      ? 'running' : 'pending'

  return {
    status,
    pr_url:          pr?.url ?? undefined,
    pr_number:       pr?.number ?? undefined,
    activities_json: JSON.stringify(data.activities ?? []),
    completed_at:    status === 'completed' || status === 'failed'
                     ? new Date().toISOString() : undefined,
    error_message:   status === 'failed'
                     ? (data.error?.message ?? 'Task failed') : undefined,
  }
}
