// CopernicusKnowledgeBase.ts
// Static Q&A knowledge base for the Copernicus guide persona.
// No LLM calls — all responses are pre-written and deterministic.
// Matching: case-insensitive substring match on any trigger. First match wins.
//
// Sources: UX_BIBLE.md, TECHNICAL_BIBLE.md, USER_WORKFLOW.md

export interface KnowledgeEntry {
  trigger: string | string[]
  response: string
  showTourButton?: boolean
}

export const COPERNICUS_KB: KnowledgeEntry[] = [

  // ─── TOUR ───────────────────────────────────────────────────────────────────
  {
    trigger: ['tour', 'quick tour', 'walkthrough', 'start tour', 'show me around', 'retake tour'],
    response:
      'I can run the Quick Tour now — it plays in the Canvas and covers all 5 areas of the IDE: Planner, Editor, Designer, Orchestrator, and Command Center. Click Start Tour below to begin.',
    showTourButton: true,
  },

  // ─── ONBOARDING ─────────────────────────────────────────────────────────────
  {
    trigger: ['onboarding', 'wizard', 'first launch', 'getting started', 'set up for the first time'],
    response:
      'First launch shows the Setup Wizard. For Claude (Anthropic) you choose one of two options: (1) Claude Code CLI — uses your existing `claude login` session, works with any Claude.ai subscription, no separate billing; or (2) API Key — paste a key from console.anthropic.com, billed per token. Google OAuth, repository store selection, and CapEx rate are also set in the Wizard. You can change any of these later in Settings → Providers.',
  },
  {
    trigger: ['sign in', 'anthropic login', 'claude login', 'how do i connect claude', 'authentication', 'oauth', 'api key', 'connect anthropic'],
    response:
      'For Claude/Anthropic you have two options — pick in Settings → Providers or the Setup Wizard:\n\n**Claude Code CLI (recommended for Claude.ai subscribers):** Install Claude Code from claude.ai/download, run `claude login` in a terminal once, then select "Claude Code CLI" in COPERNICUS. No separate API key. Uses your Pro or Max subscription.\n\n**API Key:** Get a key from console.anthropic.com/settings/keys, paste it into the Anthropic row in Settings → Providers. Billed per token separately from your Claude.ai subscription.\n\nFor Google (Gemini + Jules): click "Sign in with Google" — standard OAuth, browser opens and closes.',
  },

  // ─── VIEWS / NAVIGATION ─────────────────────────────────────────────────────
  {
    trigger: ['views', 'how many views', 'main views', 'activity bar views', 'switch view'],
    response:
      'COPERNICUS has 7 views accessible from the activity bar: Planner (kanban), Editor (code), Designer (canvas), Orchestrator (workflow), Reporter (capex), Command Center (agent monitor), and Memory. Click the icons on the left, or use the header tabs for Planner / Designer / Editor.',
  },
  {
    trigger: ['planner', 'kanban', 'story board', 'board', 'story card', 'lanes', 'swimlane'],
    response:
      'The Planner (FolderOpen icon) is a 9-lane Kanban board: Planning → Storyboarding → Sprint Planning → Development → Testing → QA → Documenting → Ready to Build → Done. Click any card to open the Story Drawer. Drag cards between lanes to update status.',
  },
  {
    trigger: ['editor view', 'code view', 'editor mode', 'monaco'],
    response:
      'The Editor view (Monitor icon) is three columns: File Explorer on the left, Monaco code editor in the center, and the Chat Panel on the right. Cmd/Ctrl+S saves the active file. LSP diagnostics appear inline.',
  },
  {
    trigger: ['what is the canvas', 'designer view', 'ui builder', 'designer', 'canvas', 'visual editor'],
    response:
      'The Canvas (Designer view, Cpu icon) is the unified graphic surface. It shows whatever visual content is active: UI component builder (when no file), image renders, Playwright browser frames, or agent-generated UI. All visual work lives here — there\'s no separate image viewer or browser tab.',
  },
  {
    trigger: ['orchestrator', 'workflow canvas', 'workflow view', 'workflow engine'],
    response:
      'The Orchestrator (GitBranch icon) is the visual workflow builder. Connect trigger, agent, tool, decision, and flow nodes into pipelines. Save/Run/Reset controls are at the top of the canvas. Assign any saved workflow to a story card from the Story Drawer.',
  },
  {
    trigger: ['reporter', 'capex', 'cost', 'spending', 'token cost', 'budget'],
    response:
      'The Reporter (BarChart2 icon) shows your CapEx dashboard — token spend per session, cost by provider and model, and cumulative totals. It updates live as you chat and dispatch agents.',
  },

  // ─── JULES ──────────────────────────────────────────────────────────────────
  {
    trigger: ['how do i dispatch to jules', 'send to jules', 'jules dispatch', 'dispatch jules', '→ jules'],
    response:
      'Open the Story Drawer (click a card), set the story status to APPROVED FOR IMPLEMENTATION, then click the → Jules button. Jules creates a branch and a PR automatically. The card badge updates live — no need to check Jules directly.',
  },
  {
    trigger: ['jules limits', 'jules capacity', 'jules quota', 'how many jules', 'parallel jules'],
    response:
      'Google Student Pro gives you 100 Jules tasks per day, 15 simultaneous. That\'s plenty of runway — dispatch several stories in parallel while you work in the Editor on something else. Copernicus gates under-specced stories before dispatch to avoid wasted sessions.',
  },
  {
    trigger: ['jules pr', 'jules branch', 'jules status', 'jules badge', 'jules session'],
    response:
      'Once dispatched, a status badge appears on the card: ● QUEUED → ● RUNNING → ● DONE with a PR link. Click the PR link to open it in your browser. The badge auto-updates every 30 seconds while the session is active.',
  },
  {
    trigger: ['jules terminal', 'jules tab', 'jules webview', 'jules browser'],
    response:
      'The Jules terminal tab opens jules.google.com directly in a webview — your authenticated Google session persists. This is for manual interaction only. Automated Jules work (story dispatch) runs headlessly via the Jules harness and shows on the card badge.',
  },
  {
    trigger: ['jules failed', 'jules error', 'jules stall', 'jules stuck'],
    response:
      'If a Jules session fails or stalls, the card badge turns red (FAILED) or the session appears in Command Center → Agent Stalls with an amber highlight. Use Retry to re-dispatch, or Kill to clear the session and try again. Check that the story has clear acceptance criteria — vague ACs are the most common cause.',
  },

  // ─── COMMAND CENTER ─────────────────────────────────────────────────────────
  {
    trigger: ['command center', 'agent stalls', 'monitor agents', 'active agents', 'stall', 'cmd view'],
    response:
      'The Command Center (Activity icon) has four sections: Agent Swarms (all dispatched agents + status), Active Tasks (running workflows/Jules sessions), MCP Usage (server call counts), and LSP State. Agent Stalls surface here with amber highlight when an agent produces no output for >60 seconds. Retry or Kill from here.',
  },

  // ─── CHAT PANEL ─────────────────────────────────────────────────────────────
  {
    trigger: ['chat panel', 'flip panel', 'back face', 'chat tools', 'rotate panel', '↻'],
    response:
      'The Chat Panel has two faces. Front: your active chat. Back (click ↻ to flip): 5 tool tabs. Context tab shows your token budget and injected memories. Persona tab lets you edit the system prompt inline. Prompts tab stores saved templates. History tab shows past sessions. Guide tab is where you are now.',
  },
  {
    trigger: ['context tab', 'token budget', 'context window', 'context usage'],
    response:
      'The Context tab (back face of Chat Panel) shows a token bar for the active model, attached files, and injected project memories. The bar fills as your conversation grows. When it\'s near full, switch models via the Persona tab — your context snapshots automatically so the new model picks up where you left off.',
  },
  {
    trigger: ['persona tab', 'system prompt', 'change model', 'switch model inline'],
    response:
      'The Persona tab (back face of Chat Panel) lets you edit the active system prompt and switch models without opening Settings. Select a model from the dropdown — a ↔ Switched divider appears in chat, and your prior context is offered to the new model on the next send.',
  },
  {
    trigger: ['saved prompts', 'prompt templates', 'prompts tab', 'reuse prompt'],
    response:
      'The Prompts tab (back face of Chat Panel) stores prompt templates. Type something in the chat input, flip to back, go to Prompts → Save Current Input. Name it. Later, click Use to paste it back into the front-face input. Good for repeated tasks like "review this code", "write ACs", etc.',
  },

  // ─── LSP ─────────────────────────────────────────────────────────────────────
  {
    trigger: ['lsp', 'language server', 'diagnostics', 'code intelligence', 'typescript errors', 'red squiggles'],
    response:
      'The LSP (typescript-language-server) starts automatically when you open a workspace. Errors appear as red squiggles in Monaco and are also visible to Claude via the Context tab — so the agent sees your diagnostics without you needing to paste them. The status bar shows a green dot when LSP is active.',
  },
  {
    trigger: ['lsp not running', 'lsp stopped', 'lsp down', 'lsp error', 'language server not working'],
    response:
      'If LSP is stopped, the status bar shows a grey dot. Try reopening your workspace (Settings → Workspace or drag the folder icon). If Monaco still shows no completions, open Command Center and check LSP State for the error. The LSP restarts automatically when a TypeScript file is opened.',
  },

  // ─── MEMORY ──────────────────────────────────────────────────────────────────
  {
    trigger: ['memory', 'project memory', 'save memory', 'brain icon', 'remember this'],
    response:
      'Project Memory (Brain icon) stores facts across sessions. Hover over any assistant message and click the brain icon to save it at importance 7. Memories are injected automatically at the start of each chat session, ranked by importance and recency. View all memories in the Memory view.',
  },

  // ─── FILE TREE ───────────────────────────────────────────────────────────────
  {
    trigger: ['file tree', 'explorer', 'open file', 'file picker', 'workspace folder', 'open folder'],
    response:
      'The Explorer (left panel in Editor view) shows your workspace file tree. Click any file to open it. Source files open in Monaco. Images, video, and rich files open in the Canvas. Binary files (.dmg, .zip, etc.) show a blocker — they can\'t be edited. Use the attach button (📎) in chat to add any file as context.',
  },
  {
    trigger: ['change workspace', 'set workspace', 'open project', 'root path'],
    response:
      'To change your workspace, click the empty state in the File Explorer ("No workspace selected") or go to Settings → Workspace. The IDE rescans the file tree, restarts LSP, and reloads git status automatically.',
  },

  // ─── TERMINAL ────────────────────────────────────────────────────────────────
  {
    trigger: ['terminal', 'terminal drawer', 'open terminal', 'bottom bar'],
    response:
      'The Terminal drawer lives at the bottom of the IDE. Click the bar at the very bottom to open/close it. There are 4 default tabs: Local (standard shell), Claude (agent PTY), Gemini (Gemini PTY), Jules (Jules webview). Ephemeral tabs are created by the Touch Bar COMMIT/BUILD/TEST buttons.',
  },
  {
    trigger: ['gemini terminal', 'gemini tab', 'gemini agent', 'gemini prompt'],
    response:
      'The Gemini terminal tab runs a Gemini CLI PTY session. Open the terminal drawer and click the Gemini tab. Type your prompt and press Enter. Output streams in real time. Good for long-context analysis, broad codebase questions, or extended planning sessions.',
  },

  // ─── PROVIDERS & MODELS ──────────────────────────────────────────────────────
  {
    trigger: ['settings', 'provider', 'configure provider', 'set up provider', 'change provider'],
    response:
      'Open Settings via the gear icon at the bottom of the activity bar. Go to Providers. For Anthropic, toggle between "Claude Code CLI" (uses your `claude login` session) and "API Key" (paste from console.anthropic.com). For all other providers, paste the relevant API key or use the Sign In button. Changes take effect immediately — no restart needed.',
  },
  {
    trigger: ['claude limits', 'claude session limit', 'claude out of tokens', 'claude pro limits'],
    response:
      'Claude Pro has conversation-based session limits, not token counts. Copernicus tracks usage and warns before you hit the limit. When it\'s reached, switch to Gemini via the Persona tab — your context is snapshotted and handed off automatically. The chat shows a ↔ Switched divider. Nothing is lost.',
  },
  {
    trigger: ['gemini', 'google gemini', 'gemini model', 'use gemini for chat'],
    response:
      'Gemini (in the Chat Panel model picker or Persona tab) is your fallback when Claude\'s session limit is reached. It handles large context windows well — good for broad codebase questions and extended planning. It\'s the same Google account as Jules, so no extra sign-in needed.',
  },
  {
    trigger: ['ollama', 'local model', 'local llm', 'offline model'],
    response:
      'Ollama runs local models on your machine. Make sure Ollama is running (ollama serve), then go to Settings → Providers → Ollama. The IDE will discover your installed models automatically. Ollama doesn\'t need an API key — it checks reachability on localhost:11434.',
  },
  {
    trigger: ['which model', 'best model', 'model to use', 'recommended model'],
    response:
      'For active coding: Claude Sonnet (fast, context-aware). For architecture and complex planning: Claude Opus. For long-context analysis or when Claude is at limit: Gemini 1.5 Pro. For async story implementation: Jules (no model selection needed — Jules manages its own). For local/offline: Ollama with your preferred model.',
  },

  // ─── WORKFLOWS ───────────────────────────────────────────────────────────────
  {
    trigger: ['workflow', 'workflow node', 'node types', 'trigger node', 'agent node', 'decision node'],
    response:
      'The Workflow Canvas has 5 node types: Trigger (entry point), Agent (LLM with model/persona/task), Tool (shell command or make target), Decision (branch on exit code or approval), and Flow (sub-workflow reference). Nodes connect with edges. Run the workflow from the toolbar or from the Story Drawer.',
  },
  {
    trigger: ['workflow assign', 'assign workflow', 'story workflow', 'jules pr manager', 'jules-pr-manager'],
    response:
      'Assign a workflow to any story card from the Story Drawer\'s workflow selector. The most common is the "jules-pr-manager" template — it monitors Jules sessions, runs a review agent when the PR is ready, and flags for merge or human approval. The workflow runs headlessly and updates the card badge.',
  },

  // ─── SPOTLIGHT / PANEL MANAGEMENT ───────────────────────────────────────────
  {
    trigger: ['maximize panel', 'spotlight', 'expand panel', 'full screen panel', 'maximize editor', 'expand chat'],
    response:
      'Click the Maximize2 icon in any panel header to spotlight it — it expands in both directions, and neighboring panels collapse to narrow bookmarks on the edges. Click a bookmark strip to restore that panel. Click Minimize2 (or the same icon) to return to normal layout.',
  },

  // ─── TOUCH BAR ───────────────────────────────────────────────────────────────
  {
    trigger: ['touch bar', 'macbook touch bar', 'touchbar', 'commit button', 'build button'],
    response:
      'The Touch Bar (macOS MacBook Pro) has three groups: View buttons (Plan/Edit/Design/Orch/Report/CMD — active view is highlighted in phosphor), Command tray (COMMIT/BUILD/TEST — each spawns an ephemeral terminal tab), and Toggle buttons (FLIP flips the active panel, SPOT toggles spotlight).',
  },

  // ─── COLOR THEME ─────────────────────────────────────────────────────────────
  {
    trigger: ['color', 'theme', 'phosphor color', 'change color', 'green', 'amber', 'blue', 'white theme'],
    response:
      'COPERNICUS uses a phosphor color system. In Settings → Appearance, pick from: Green (default), Amber (warning mode), White (high contrast), or Blue (focus mode). The chosen color flows through every active/selected state in the UI — activity bar, header tabs, cursor, selection highlights.',
  },
  {
    trigger: ['appearance', 'font size', 'density', 'ui density', 'compact mode', 'animations'],
    response:
      'Settings → Appearance lets you set the phosphor color, font size for Monaco, UI density (compact/normal/comfortable), and toggle animations. Font changes take effect immediately without restart.',
  },

  // ─── DAILY WORKFLOW ──────────────────────────────────────────────────────────
  {
    trigger: ['daily rhythm', 'daily workflow', 'morning routine', 'how to use every day', 'my day'],
    response:
      'Morning: open Command Center — any Jules PRs ready? Any stalls overnight? Merge ready PRs. Midday: Editor + Claude for active coding. Dispatch 1–2 stories to Jules while you work on others. Designer for UI work if needed. End of day: confirm no Command Center stalls, move completed cards to Done, check Reporter for cost summary.',
  },
  {
    trigger: ['first story', 'create story', 'new story', 'how to create a story', 'write story'],
    response:
      'Describe what you want to build in the Chat Panel. I\'ll draft a story with acceptance criteria — you review, edit if needed, and confirm. The story card appears in the Planning lane. From there, move it to Sprint Planning, assign to Jules, and click → Jules when the ACs are solid.',
  },
  {
    trigger: ['story status', 'story lifecycle', 'story flow', 'story stages', 'how story moves'],
    response:
      'Stories flow: Planning → Storyboarding → Sprint Planning → Development → Testing → QA → Documenting → Ready to Build → Done. Development is where Jules (or you) implement. Click any card to update its status from the Story Drawer. Jules updates the status automatically on PR creation.',
  },

  // ─── GIT ─────────────────────────────────────────────────────────────────────
  {
    trigger: ['git', 'github', 'git branch', 'commit', 'push', 'pull request'],
    response:
      'Git status shows in the status bar (bottom of IDE). The header also shows the active branch. For commits and pushes, use the terminal (Local tab) or the Touch Bar COMMIT button — it spawns an ephemeral terminal. The IDE watches for `git push` commands and asks for confirmation before executing.',
  },
  {
    trigger: ['github settings', 'github token', 'github repo', 'connect github'],
    response:
      'Go to Settings → Git / GitHub to connect your GitHub account. Once connected, Jules can create PRs and branches automatically. The Planner shows a "repo targeted" indicator — if it\'s grey, Jules won\'t be able to push. Check Settings → GitHub if the indicator is red or missing.',
  },

  // ─── STATUS BAR ──────────────────────────────────────────────────────────────
  {
    trigger: ['status bar', 'bottom bar', 'what does the bar show', 'status strip'],
    response:
      'The status bar at the very bottom shows: git branch · active story ID · active model (left), session timer (center), token count · cost · LSP status dot (right). The LSP dot is green when typescript-language-server is running.',
  },

  // ─── MCP ─────────────────────────────────────────────────────────────────────
  {
    trigger: ['mcp', 'model context protocol', 'mcp server', 'mcp tools'],
    response:
      'MCP (Model Context Protocol) servers add tools to your chat agent. Go to Settings → MCP to add servers. Each server registers a set of tools the agent can call (e.g. web search, file operations, database queries). MCP call counts appear in Command Center → MCP Usage.',
  },

  // ─── ERRORS & TROUBLESHOOTING ────────────────────────────────────────────────
  {
    trigger: ['error', 'something broke', 'not working', 'crash', 'bug', 'ipc error', 'failed to load'],
    response:
      'For IPC or render errors, open DevTools (Cmd+Option+I) and check the Console tab. For LSP issues, check Command Center → LSP State. For agent errors, check Command Center → Agent Stalls. If the app feels frozen, try closing and reopening the terminal drawer first — it resolves most layout hangs.',
  },
  {
    trigger: ['how do i report a bug', 'feedback', 'report issue', 'submit bug'],
    response:
      'Report bugs at the GitHub repo linked in Settings → About, or file a story in the Planning lane with priority P0/P1. Include the error message from DevTools console and what you were doing when it happened.',
  },

  // ─── KEYBOARD SHORTCUTS ──────────────────────────────────────────────────────
  {
    trigger: ['keyboard shortcuts', 'shortcuts', 'hotkeys', 'keybindings', 'cmd+s', 'ctrl+s', 'command p'],
    response:
      'Key shortcuts: Cmd/Ctrl+S — save active file. Cmd/Ctrl+P — command palette (search files, run commands). Tab — navigate interactive elements. Escape — close drawer or palette. Arrow keys — navigate Kanban cards within a column. Full list in Settings → Accessibility.',
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
