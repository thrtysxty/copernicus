import { stateLedger, StoryRecord, JulesSession } from '../db/state-ledger'
import { generateJulesPrompt } from './prompt-generator'
import { JulesClient } from './jules-client'
import { fsManager } from '../fs-manager'

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

  // Gather Agent Context
  let agentContext = '';
  try {
    const rootPath = fsManager.getRootPath();
    const projectId = rootPath ? (stateLedger.getProjectByPath(rootPath)?.id ?? 'default') : 'default';

    // Get all docs for this project
    const docs = stateLedger.listIntelDocs(projectId);

    // Filter docs enabled for 'jules' and format them for context
    const julesDocs = docs.filter(doc => {
      let providers = [];
      try {
         providers = typeof doc.providers === 'string' ? JSON.parse(doc.providers) : (doc.providers || []);
      } catch (e) {
         providers = doc.providers || [];
      }
      return providers.some((p: any) => p.provider === 'jules');
    });

    if (julesDocs.length > 0) {
      const parts = julesDocs.map(doc => {
        return `### ${doc.title} (${doc.type})\n\n${doc.content || ''}`;
      });
      agentContext = parts.join('\n\n');
    }
  } catch (err) {
    console.warn("Failed to read agent context for Jules prompt", err);
  }

  const { text: prompt, hash: promptHash } = generateJulesPrompt(story, repo, agentContext)

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
