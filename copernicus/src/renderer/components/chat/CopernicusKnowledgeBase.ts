export interface KnowledgeEntry {
  trigger: string | string[]
  response: string
  showTourButton?: boolean
}

export const COP_KNOWLEDGE_BASE: KnowledgeEntry[] = [
  {
    trigger: ['how do i dispatch to jules', 'send to jules', 'jules dispatch'],
    response: "Open the Story Drawer (click a card), set Assigned to Jules, then click → Jules. I'll watch the session and flag the card when the PR is ready for your review."
  },
  {
    trigger: ['what is the canvas', 'designer', 'ui builder'],
    response: 'The Canvas (Designer view) is your unified graphic surface — UI components, image previews, Playwright frames, and agent visual output all render here.'
  },
  {
    trigger: ['lsp', 'language server', 'diagnostics'],
    response: 'LSP (typescript-language-server) runs automatically. Errors and warnings appear in Monaco and are visible to Claude via the Context tab. No setup needed.'
  },
  {
    trigger: ['command center', 'agent stalls', 'monitor'],
    response: 'The Command Center (Activity bar → Activity icon) shows all running agent sessions, active tasks, LSP state, and any stalls. Check here first when something feels stuck.'
  },
  {
    trigger: ['tour', 'quick tour', 'walkthrough', 'start tour'],
    response: 'I can run the Quick Tour now — it plays in the Canvas and covers all 5 areas of the IDE.',
    showTourButton: true
  },
  {
    trigger: ['workflow assignment', 'assign story', 'workflow'],
    response: 'Stories can be assigned to different agents or human roles. Use the Kanban swimlanes to move cards through the pipeline, or the Story Drawer to assign specific tasks.'
  },
  {
    trigger: ['mcp servers', 'mcp', 'context'],
    response: 'Model Context Protocol (MCP) servers extend my reach. You can configure them in settings to give Claude access to your local tools, databases, and APIs.'
  },
  {
    trigger: ['keyboard shortcuts', 'shortcuts', 'hotkeys'],
    response: "Use Cmd/Ctrl+K for the Command Palette, Cmd/Ctrl+Shift+F for global search, and Cmd/Ctrl+B to toggle the sidebar. Most standard VS Code shortcuts work here too."
  },
  {
    trigger: ['chat panel tabs', 'tabs', 'context tab'],
    response: "The Chat Panel back face has 5 tabs: Context (active session data), Persona (model switching), Prompts (saved snippets), History (previous chats), and Guide (me!)."
  },
  {
    trigger: ['model switching', 'change model', 'claude vs gemini'],
    response: "You can switch models in the Persona tab or by clicking the model name in the Chat Header. Claude is great for coding; Gemini is excellent for long-context research."
  }
]

export function matchKnowledge(input: string): KnowledgeEntry | null {
  const normalizedInput = input.toLowerCase()
  for (const entry of COP_KNOWLEDGE_BASE) {
    const triggers = Array.isArray(entry.trigger) ? entry.trigger : [entry.trigger]
    for (const trigger of triggers) {
      if (normalizedInput.includes(trigger.toLowerCase())) {
        return entry
      }
    }
  }
  return null
}
