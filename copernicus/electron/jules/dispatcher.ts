import { stateLedger, StoryRecord, JulesSession } from '../db/state-ledger'
import { generateJulesPrompt } from './prompt-generator'
import { JulesClient } from './jules-client'

export interface DispatchOptions {
  story: StoryRecord
  repo: string           // 'owner/repo' e.g. 'dadmin/agentic-platform'
  branch: string         // target branch, usually 'main'
  julesClient: JulesClient // Jules Client
  requirePlanApproval?: boolean  // default false for automated dispatch
}

export interface DispatchResult {
  ok: boolean
  sessionId?: string
  error?: string
}

export async function dispatchJulesSession(opts: DispatchOptions): Promise<DispatchResult> {
  const { story, repo, branch, julesClient, requirePlanApproval = false } = opts

  const { text: prompt, hash: promptHash } = generateJulesPrompt(story, repo)

  // Dedup: if a session with this prompt hash is already running, return it
  const existing = stateLedger.getJulesSessionsByStory(story.id)
    .find(s => s.prompt_hash === promptHash && ['pending', 'running'].includes(s.status))
  if (existing) {
    return { ok: true, sessionId: existing.id }
  }

  try {
    const sessionClient = await julesClient.session({
      prompt,
      source: { github: repo, baseBranch: branch },
      autoPr: !requirePlanApproval
    })

    const info = await sessionClient.info()
    const sessionId = info.id ?? info.name?.split('/').pop()

    const record: JulesSession = {
      id: sessionId,
      story_id: story.id,
      repo,
      branch,
      prompt_hash: promptHash,
      status: 'pending',
    }
    stateLedger.upsertJulesSession(record)

    // Call createSession from JulesManager to trigger the agent_spawn hook
    const { julesManager } = await import('./jules-manager')
    julesManager.createSession(story.id, sessionId, prompt)

    return { ok: true, sessionId }
  } catch (err: unknown) {
    return { ok: false, error: (err as Error).message }
  }
}

export async function pollJulesSession(
  sessionId: string,
  client: JulesClient
): Promise<Partial<JulesSession>> {
  const sessionClient = client.session(sessionId)
  const data = await sessionClient.info()
  const activities = await sessionClient.history()

  const outputs = data.outputs ?? []
  const prOutput = outputs.find(
    (o) => 'type' in o && o.type === 'pullRequest'
  ) as { pullRequest?: { url: string; number: number } } | undefined
  const pr = prOutput?.pullRequest

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
    activities_json: JSON.stringify(activities ?? []),
    completed_at:    status === 'completed' || status === 'failed'
                     ? new Date().toISOString() : undefined,
    error_message:   status === 'failed' && 'error' in data
                     ? (data.error as { message?: string })?.message ?? 'Task failed'
                     : undefined,
  }
}
