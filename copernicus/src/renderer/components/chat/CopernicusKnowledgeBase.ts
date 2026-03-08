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
    trigger: ['what is the canvas', 'designer', 'ui builder', 'canvas'],
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
    trigger: ['stories', 'kanban', 'board', 'cards'],
    response: 'The Kanban board shows your active stories. Move cards between columns (Planning → Done) to track progress. Click a card to open the Story Drawer for details and assignment.'
  },
  {
    trigger: ['workflow', 'pipeline', 'agent assignment'],
    response: 'Workflows define how tasks move from planning to completion. You can assign stories to Jules (agent) or yourself. Check the Activity bar for automated pipeline status.'
  },
  {
    trigger: ['keyboard shortcuts', 'shortcuts', 'keybindings', 'hotkeys'],
    response: "Use Cmd/Ctrl+K for the Command Palette, Cmd/Ctrl+Shift+F for global search, and Cmd/Ctrl+B to toggle the sidebar. Most standard VS Code shortcuts work here too."
  },
  {
    trigger: ['help', 'getting help', 'documentation', 'guide'],
    response: "I'm Copernicus, your guide! You can ask me about IDE features, use the @help context in chat for the full manual, or click the '?' in the status bar for a quick overview."
  },
  {
    trigger: ['model switching', 'change model', 'claude', 'gemini'],
    response: "Switch models in the Persona tab (on the back of this panel) or click the model name in the Chat Header. Use Claude for coding and Gemini for long-context research."
  },
  {
    trigger: ['mcp servers', 'mcp', 'context'],
    response: 'Model Context Protocol (MCP) servers extend my reach. Configure them in Settings to give Claude access to your local tools, databases, and APIs.'
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
