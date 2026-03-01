import { createHash } from 'node:crypto'
import type { StoryRecord } from '../db/state-ledger'

export interface GeneratedPrompt {
  text: string
  hash: string    // SHA-1 for dedup and audit
}

// Extracts the ## Acceptance Criteria section from markdown
function extractACs(bodyMd: string): string {
  const match = bodyMd.match(
    /##\s+Acceptance Criteria\s*\n([\s\S]*?)(?=\n##\s+(?:Definition of Done|Blocks|Blocked By|Documentation Impact)|$)/
  )
  return match?.[1]?.trim() ?? '(no acceptance criteria found)'
}

// Extracts Documentation Impact — tells Jules exactly which files to touch
function extractDocImpact(bodyMd: string): string {
  const match = bodyMd.match(/##\s+Documentation Impact\s*\n([\s\S]*?)(?=\n##|$)/)
  return match?.[1]?.trim() ?? ''
}

export function generateJulesPrompt(story: StoryRecord, _repo: string): GeneratedPrompt {
  const storyNum = story.id.replace('story_', '')
  const branchName = `feat/${story.id}`

  const acceptanceCriteria = extractACs(story.body_md)
  const docImpact = extractDocImpact(story.body_md)

  const text = `\
TASK: Implement Story ${storyNum} — ${story.title}

STORY FILE: ${story.file_path}

---

## Acceptance Criteria

${acceptanceCriteria}

---

## Files to Modify / Create

${docImpact || '(see Acceptance Criteria for file references)'}

---

## Verification

After implementing all ACs, run the following and ensure zero errors:

\`\`\`bash
cd copernicus && npx tsc --noEmit
\`\`\`

If type-check passes: you are done. Do not start any dev server.

---

## Conventions (enforced by AGENTS.md — do not deviate)

- Every new ipcMain.handle() channel must also be added to preload.ts SEND_CHANNELS.
- Use writeFileAtomic() for story .md file writes (never fs.writeFileSync directly).
- Toast notifications: useToastStore.getState().addToast(msg, type) — no IPC.
- buildSafeEnv(agentId, allowList) — NOT buildSafeEnv(process.env).
- No imports of Node.js or Electron modules in src/renderer/** files.

---

## Branch and PR

Branch: ${branchName}
PR Title: feat: ${story.title} (story ${storyNum})
PR Body: Implements ${story.id} as specified in docs/stories/${story.id}*.md
`

  const hash = createHash('sha1').update(text).digest('hex').slice(0, 12)
  return { text, hash }
}
