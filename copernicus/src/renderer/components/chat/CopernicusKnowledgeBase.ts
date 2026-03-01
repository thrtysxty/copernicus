// CopernicusKnowledgeBase.ts
// Static Q&A knowledge base for the Copernicus guide persona.
// No LLM calls — all responses are pre-written and deterministic.
// Matching: case-insensitive substring match on any trigger. First match wins.

export interface KnowledgeEntry {
  trigger: string | string[]
  response: string
  showTourButton?: boolean
}

export const COPERNICUS_KB: KnowledgeEntry[] = [
  {
    trigger: ['how do i dispatch to jules', 'send to jules', 'jules dispatch', 'dispatch jules'],
    response:
      'Open the Story Drawer (click a card in the Planner), set Assigned To "jules", then click the → Jules button. I\'ll watch the session and flag the card when the PR is ready for your review.',
  },
  {
    trigger: ['what is the canvas', 'designer view', 'ui builder', 'designer', 'canvas'],
    response:
      'The Canvas (Designer view) is your unified graphic surface — UI components, image previews, Playwright browser frames, and agent visual output all render here. Switch to it via the Cpu icon in the activity bar.',
  },
  {
    trigger: ['lsp', 'language server', 'diagnostics', 'code intelligence', 'typescript errors'],
    response:
      'LSP (typescript-language-server) runs automatically when you open a workspace. Errors and warnings appear in Monaco and are visible to Claude via the Context tab. No manual setup needed.',
  },
  {
    trigger: ['command center', 'agent stalls', 'monitor agents', 'active agents', 'stall'],
    response:
      'The Command Center (Activity bar → Activity icon) shows all running agent sessions, active tasks, MCP usage, LSP state, and any stalls. Check here first when something feels stuck — you can Retry or Kill stalled agents from there.',
  },
  {
    trigger: ['tour', 'quick tour', 'walkthrough', 'start tour', 'show me around', 'retake tour'],
    response:
      'I can run the Quick Tour now — it plays in the Canvas and covers all 5 areas of the IDE. Click Start Tour below to begin.',
    showTourButton: true,
  },
  {
    trigger: ['workflow', 'workflow engine', 'workflow canvas', 'orchestrator', 'node'],
    response:
      'The Workflow Canvas (Orchestrator view) lets you build multi-step agent pipelines with trigger, agent, tool, decision, and flow nodes. Assign a workflow to any story card and run it with one click from the Story Drawer.',
  },
  {
    trigger: ['memory', 'project memory', 'save memory', 'brain'],
    response:
      'Project Memory (Brain icon in the activity bar) stores important context across sessions. Use "Save to Memory" in the chat to preserve key facts. Memories are injected into your next session automatically, scored by importance and recency.',
  },
  {
    trigger: ['gemini', 'gemini terminal', 'gemini agent', 'gemini tab'],
    response:
      'Gemini runs in the Gemini terminal tab at the bottom of the IDE. Open the terminal drawer and select the Gemini tab. You can send prompts via the terminal PTY and receive streamed output directly.',
  },
  {
    trigger: ['settings', 'api key', 'provider', 'configure provider', 'setup', 'set up'],
    response:
      'Open Settings via the gear icon at the bottom of the activity bar. Head to the Providers section to add your API keys for Anthropic, OpenAI, Google, OpenRouter, or DeepInfra. Changes take effect immediately.',
  },
  {
    trigger: ['keyboard shortcuts', 'shortcuts', 'hotkeys', 'keybindings', 'cmd+s', 'ctrl+s'],
    response:
      'Key shortcuts: Cmd/Ctrl+S saves the active file. Cmd/Ctrl+P opens the file picker. The Touch Bar (macOS) gives you one-tap view switching, COMMIT, BUILD, and TEST. More shortcuts are available in Settings → Accessibility.',
  },
  {
    trigger: ['chat panel', 'flip panel', 'back face', 'chat tools', 'context tab', 'persona tab'],
    response:
      'The Chat Panel has two faces. The front face is your active chat session. The back face (click ↻ to flip) has 5 tabs: Context (token budget + injected memory), Persona (edit system prompt inline), Prompts (saved templates), History (past sessions), and Guide (you\'re here).',
  },
  {
    trigger: ['kanban', 'planner', 'story card', 'board', 'story board', 'lanes'],
    response:
      'The Planner (Kanban board) has 9 swimlanes from Planning through Done. Click any card to open the Story Drawer — from there you can edit ACs, assign to Jules, or run a workflow. Drag cards between lanes to update their status.',
  },
  {
    trigger: ['file tree', 'explorer', 'open file', 'workspace', 'open folder'],
    response:
      'The Explorer (folder icon in the activity bar) shows your workspace file tree. Click any file to open it in Monaco. The IDE classifies files automatically — source files open in the Editor, images and visual files open in the Canvas.',
  },
]

/**
 * Match a user query against the knowledge base.
 * Returns the first matching entry, or null if no match found.
 */
export function matchKnowledge(query: string): KnowledgeEntry | null {
  const q = query.toLowerCase().trim()
  for (const entry of COPERNICUS_KB) {
    const triggers = Array.isArray(entry.trigger) ? entry.trigger : [entry.trigger]
    for (const t of triggers) {
      if (q.includes(t.toLowerCase())) {
        return entry
      }
    }
  }
  return null
}
