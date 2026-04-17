# Copernicus IDE — User Manual & Workflows

## Preamble

**Who uses Copernicus?**

Copernicus is not just a text editor; it is a multi-agent ideation and implementation platform. Because it handles planning, design, coding, and orchestration, its user base is varied.

### The Archetypes

**The Developer**
You write code, but you want AI to write the boilerplate and handle refactors.
* *Entry point:* Editor (`⌘2`)
* *Primary views:* Editor, Git, Diagnostics, Debug, Review
* *What you care about:* See *Active Coding Session* in Part 3. You can safely ignore the Planner and Reporter.

**The PM / Story Author**
You define the what and the why. You live in acceptance criteria and sprint planning.
* *Entry point:* Planner (`⌘1`)
* *Primary views:* Planner, Reporter, Knowledge Base, Memory
* *What you care about:* See *Planning a Sprint* in Part 3. You can safely ignore the Debug and Diagnostics views.

**The Visual Designer**
You design UI components and ensure the implementation matches the spec.
* *Entry point:* Designer (`⌘3`)
* *Primary views:* Designer, Browser, Editor
* *What you care about:* See *Designing a UI Component* in Part 3.

**The Orchestrator / Agent Wrangler**
You manage the swarm. You define which models handle which roles and monitor their execution.
* *Entry point:* Orchestrator (`⌘4`) or Hub Org Chart
* *Primary views:* Orchestrator, Command Center, Agent Hub, Reporter
* *What you care about:* See *Monitoring Agents* in Part 3.

### New User vs. Existing User
If you are new to Copernicus, follow the Genesis Wizard below. If you are returning to an existing codebase, the IDE will load your previous state, and you can skip to Part 2 to navigate the interface.

---

## Act 1 — Install & First Launch

The IDE installs like any Electron app. On first launch, the splash screen fades in, leading you to the Genesis Wizard.

> *"You're ready. Let's build something."*

---

## Act 2 — The Wizard

The Genesis Wizard guides you through setting up your workspace. Copernicus speaks from the setup view to help you out.

> *"Welcome. Let's get your environment configured."*

### Step 1 - API Keys
*The IDE needs providers.*
You will be prompted to configure your API keys for the AI providers you wish to use. The current stack supports:
- **CCR** (Claude Code Router, port 9669)
- **Local Ollama** (port 11434)
- **Cloud Ollama**
- **MLX** (port 8080, Apple Silicon)
- **OpenRouter**
- **Anthropic Direct**

### Step 2 - Workspace Directory
*Where does the code live?*
Select the local path where your repositories will reside (e.g., `~/Workspace/Projects`).

### Step 3 - Core Value & Context
*What are we building?*
Provide a 1-sentence description of the project's core value (e.g., "A checkout app for nurses").

### Step 4 - Project Genesis Stack
*How should it be built?*
Choose the application stack (e.g., React + Electron, Next.js, etc.) or choose "Existing repo" to initialize Copernicus config files (`AGENTS.md`, `CLAUDE.md`) in an existing directory.

### Step 5 - CapEx & Billing
*Track your spend.*
Determine if time and token billing are to be tracked (CapEx, OpEx, or None).

### Step 6 - Review
Confirm the project specifications. Once you hit Launch, the IDE scaffolds the project and opens the Planner.

> *"All set. Your workspace is ready."*

---

## Part 2 — The Interface

Copernicus has many views. They are accessed via the Activity Bar on the left or keyboard shortcuts.

### Planner (`planner`)
*The sprint backlog and task manager.*
Open the planner via the Activity Bar (Clipboard icon) or by pressing `⌘1`. The planner is a 9-lane Kanban board where you define the work. You create stories, describe the acceptance criteria, and dispatch them to agents. Use this view during sprint planning or when checking the overall status of the project.

### Editor (`editor`)
*The core code authoring environment.*
Open the editor via the Activity Bar (Code icon) or `⌘2`. This is a dual-pane setup powered by Monaco, offering full LSP support. You write code alongside the chat agent. If an agent proposes a change, you can click the "Toggle Ghost Mode" button in the header. This enables Ghost Mode, rendering agent edits as "shadow code" inline. You can then accept or reject all changes. The editor also features powerful Text and Semantic search.

### Designer (`designer`)
*The visual component builder.*
Open the designer via the Activity Bar (Layout icon) or `⌘3`. This view houses the UIBuilderCanvas. Here, you visually assemble UI components. By using "Import from Stitch", you can pull in design tokens, and "Verify with Stitch" ensures your implementation aligns with the corporate mockups. It's the primary view for frontend design work.

### Orchestrator (`orchestrator`)
*The workflow engine.*
Open the orchestrator via the Activity Bar (Workflow icon) or `⌘4`. It provides a node-based canvas where you can drag and drop tiles from the Tile Library. You define automated sequences for agents, such as the `jules-pr-manager` loop. Use this to orchestrate complex multi-step processes.

### Reporter (`reporter`)
*The project accountant.*
Open the reporter via the Activity Bar (Chart icon). This is the CapEx Dashboard. It allows you to monitor token spend, view the model leaderboard, and track cost metrics. Visit this view at the end of the day or during sprint retrospectives to ensure budgets are maintained.

### Command Center (`command-center`)
*The pulse of the swarm.*
Open the command center via the Activity Bar (Activity/Pulse icon). It provides a high-level overview of system and agent activity. You can monitor Agent Swarms, see active tasks, check LSP state, and spot any stalled agents without disturbing your flow in the editor.

### Org Chart (`hub:org-chart`)
*The Agent Hub authority matrix.*
Open the org chart via the Activity Bar (Hub icon). This view manages Phase 6 Hub tokens and role assignments. You can view the agent registry, assigned roles, token expiry times, and health scores. It also provides access to the Hub Ledger. Use this view to configure the agent hierarchy or investigate why an agent stopped working.

### Memory (`memory`)
*The historical record.*
Open the memory view via the Activity Bar (Brain icon). It allows you to browse past episodes and replay agent interactions. Use this during retrospectives to understand why certain decisions were made by the agents.

### Git (`git`)
*Source control management.*
Open git via the Activity Bar (Git-branch icon). This is the local staging and commit interface for regular version control workflows.

### Search (`search`)
*Project-wide search.*
Open search via the Activity Bar (Search icon). It provides a global search drawer for full-text and regex queries across your workspace.

### Review (`review`)
*The PR diff inspector.*
Open review via the Activity Bar (PR icon) or by clicking a PR link on a story card. It provides an inline diff review panel where you inspect code changes made by agents before merging them.

### Debug (`debug`)
*The execution inspector.*
Open debug via the Activity Bar (Bug icon). This is the debug adapter client interface for setting breakpoints, inspecting variables, and stepping through code when troubleshooting complex application logic.

### Diagnostics (`diagnostics`)
*The logs and outputs.*
Open diagnostics via the Activity Bar (Warning/Error icon). This view presents the raw output from language servers, compilers, and linters.

### Knowledge Base (`knowledge-base`)
*The project wiki.*
Open the knowledge base via the Activity Bar (Book icon). It houses curated markdown articles and architectural notes for your project.

### Browser (`browser`)
*The in-IDE web viewer.*
Open the browser via the Activity Bar (Globe icon). This integrated panel allows you to view local dev servers, external docs, or Playwright executions without leaving the IDE.

### Database (`database`)
*The schema inspector.*
Open the database view via the Activity Bar (Database icon). This panel lets you view tables and query the local SQLite database, verifying data persistence and inspecting the Hub Ledger.

### Internal / Developer Views
- **Logs (`logs`)**: Raw system logs (internal).
- **Replay (`replay`)**: Advanced state replay (in active development).
- **Test Explorer (`test-explorer`)**: Visual test runner (in active development).
- **GitHub (`github`)**: Extended GitHub API integration (coming soon).

---

## Part 3 — Core Workflows

### Planning a Sprint
You start in the **Planner**. You create a new story card: "Add user login with Google OAuth." You describe it in the chat, and Copernicus drafts the Acceptance Criteria. Once approved, the card drops into the *Planning* lane.

### Dispatching to Jules
When a story is ready, you move it to *Sprint Planning*. You open the Story Drawer, set the assignee to Jules, and select the `jules-pr-manager` workflow. You click **→ Jules**. A badge appears (`● QUEUED`), and the workflow begins in the background. The card moves to *Development*.

### Active Coding Session
While Jules works, you open the **Editor** to tackle another story. You write some code. The LSP provides instant feedback. You ask the Chat agent for help with a complex function. The agent suggests a block of code. Instead of copying and pasting, you turn on **Ghost Mode**. The code appears inline as "shadow code." You review it in context, hit "Accept All," and hit `⌘S` to save.

### Designing a UI Component
You need a new button. You open the **Designer**. You describe the button to Claude in the chat, and the Canvas renders it. You click "Import from Stitch" to pull in design tokens, and then "Verify with Stitch" to ensure the rendered button matches the corporate design system.

### Monitoring Agents
You press the **CMD** button on your Touch Bar (or Activity Bar) to open the **Command Center**. You see Jules is running smoothly on Node 3 of 6. No stalls. You also check the **Org Chart** and see all Hub tokens are healthy.

### Reviewing a PR
Jules finishes. The story card turns amber and shows a PR link. You click it, opening the **Review** view. You read through the diff, confirm the Acceptance Criteria are met, and click merge.

### Sprint Retrospective
At the end of the sprint, you open the **Reporter** to review the total token cost. You then visit the **Memory** view to replay an episode where an agent got stuck, helping you refine the `AGENTS.md` instructions for next time.

---

## Part 4 — The Daily Rhythm

**Morning — Orient**
1. Open Command Center — any stalls overnight? Any PRs ready?
2. Open Org Chart — scan Hub token health. Are any tokens expired or dead?
3. Scan the Kanban — what moved, what's blocked?
4. Merge any ready PRs.

**Mid-day — Build**
1. Editor + Chat — active coding session.
2. Dispatch stories to agents (respecting budget limits).
3. Designer — UI work, utilizing the Canvas.

**End of Day — Sweep**
1. Command Center — confirm no stalls.
2. Planner — move completed stories to Done.
3. Check Reporter (CapEx) — review token spend for the session.

---

## Part 5 — Provider Reference

| Provider | Type | Primary Use Case | Cost Tier |
|---|---|---|---|
| **Anthropic Direct** | Cloud API | Primary chat and complex architectural reasoning. | High ($20/mo or pay-per-token) |
| **CCR** | Local Proxy (9669) | Multi-file implementation and heavy lifting (Claude Code Router). | High (Depends on upstream) |
| **OpenRouter** | Cloud API | Access to a variety of models (e.g., DeepSeek, GLM) for specialized tasks. | Variable |
| **Local Ollama** | Local (11434) | Fast, local formatting, simple JSON tasks, privacy-focused edits. | Free (Compute cost only) |
| **Cloud Ollama** | Cloud VM | Scaled open-weight models without local compute constraints. | Medium |
| **MLX** | Local (8080) | Optimized local inference on Apple Silicon. | Free (Compute cost only) |

---

## Part 6 — What Copernicus Does Behind the Scenes

The IDE is designed to be quiet when things are working and only speak up when they are not. Behind the scenes, it manages a complex state machine.

**Hub Token Authority**
Copernicus doesn't just run CLI commands; it operates a Constitutional Hub. Every agent is assigned a role via the Org Chart and is issued a token. This token defines what files they can touch, what commands they can run, and how much money they can spend. If an agent loops, stalls, or hits its budget, the token is revoked (goes DEAD). The user sees this as a degraded health score in the Org Chart or a stalled warning in the Command Center. The system ensures agents cannot infinitely run up costs or destroy worktrees.

You never see the raw IPC channels, the SQLite queries, or the workflow engine transitions. You just see stories moving across the board, ghost code appearing in your editor, and PRs waiting for your approval.
