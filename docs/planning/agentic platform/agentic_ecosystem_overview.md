# The World of COPERNICUS IDE: An Overview of Our Agentic Ecosystem

At its.copernicus, our project is built on a simple but powerful philosophy: **harden the process by replacing manual, error-prone steps with deterministic, automated tooling.**

Every time we find ourselves repeating a manual task or fixing a mistake caused by human error (like forgetting to update the backlog or archiving a completed story), we treat it as a bug in our process. We then fix that bug by building a tool—usually a script triggered by a slash command or a `make` command—that automates the task and makes it reliable.

This philosophy has allowed us to construct a sophisticated "world" with three main pillars: The Actors (our agent personas), The Guardrails (our deterministic tooling), and The Application (the software we're building).

> **Platform Extraction Note (2026-02-01):** The agentic workflow infrastructure described
> in this document is being extracted into a standalone platform repo (Story #030). The
> repository is located at `https://github.com/JMThiessen/agentic-platform.git`. The implementation roadmap for the workflow engine lives in
> `docs/epics/epic_001_implement_agentic_workflow_engine.md`.

---

## 1. The Actors: Our Team of Agent Personas

Our development process is role-based. Each key role in a software team is encapsulated in a persona, which can be invoked on-the-fly with a slash command. This ensures that the agent is always operating with the correct context and responsibilities for the task at hand.

| Persona | Command | Core Responsibility |
| :--- | :--- | :--- |
| **Product Owner** | `/product` | Defines the "what." Manages the backlog, prioritizes features, and ensures the project aligns with business goals. |
| **Architect** | `/architect` | Defines the "how." Designs system architecture, formalizes ideas into user stories, and ensures technical consistency. |
| **Senior Developer** | `/senior_dev` | Orchestrates implementation. Breaks down stories into tasks, manages sub-agents, and integrates code. |
| **Junior Developer** | `/junior_dev` | Implements tasks using a strict Test-Driven Development (TDD) workflow. |
| **Deployer** | `/deployer` | Manages infrastructure. Handles deployments to the Raspberry Pi and troubleshoots operational issues. |

---

## 2. The Guardrails: Our Deterministic Tooling

This is the heart of our hardened process. These tools are not optional; they are integrated directly into our workflow to enforce quality, safety, and consistency.

| Tool / System | Purpose | How It Works |
| :--- | :--- | :--- |
| **Pre-Commit Hooks** | **Commit-Time Safety Net:** Prevents bad code from ever entering the repository. | Defined in `.pre-commit-config.yaml`, it automatically runs `ruff` for linting/formatting, blocks large files, and runs our custom `pi_audit.py` script to check for code that would fail on the Raspberry Pi. |
| **Runtime Lifecycle Hooks** | **Real-Time Safety Net:** Prevents a live agent from executing a dangerous command. | The `PreToolUse` hook (`scripts/lifecycle/pre_tool_use.py`) intercepts every tool call, inspects it for dangerous patterns (like force-deleting directories), and blocks it *before* it can run. |
| **Makefile as a Service** | **Single Entry Point:** Provides simple, memorable commands for all common operations. | The root `Makefile` gives us `make dev`, `make test`, `make test-e2e`, `make agent`, and `make deploy`. This eliminates the need to remember complex paths and commands. |
| **Automated Scaffolding** | **Reduces Boilerplate:** Automates the creation of new user stories and their associated files. | The `/story` command (`scripts/utils/scaffold_story.py`) creates a new story file from a template and automatically runs the backlog generator. |
| **Automated Backlog** | **Single Source of Truth:** Ensures `BACKLOG.md` is always a perfect, up-to-date reflection of the `docs/dev/stories/` directory. | The `generate_backlog.py` script parses all story files and builds the master backlog table, eliminating manual updates. |
| **Guaranteed Observability** | **Prevents "Dark Agents":** Ensures every agent is visible on the dashboard. | The `launch_subagent.py` script is the *only* way to spawn a sub-agent. Its first action is to register the new agent with our telemetry database, guaranteeing it appears on the dashboard. |
| **File Integrity Monitor** | **Prevents "Lazy" Wipes:** Blocks agents from overwriting files with truncated content or placeholders. | The tool execution layer checks `write_file` operations for significant size reductions (>40%) or lazy patterns (e.g., `// ... existing code`) and rejects the action if detected. |

---

## 3. The Application: What We're Building

The agentic workflow exists to build the COPERNICUS IDE application, a vintage reselling inventory management system.

*   **Backend:** A robust **Flask REST API** with over 60 endpoints, providing full CRUD operations for inventory, images, sourcing events, and more. It's secured with JWT for authentication.
*   **Frontend:** A modern **React and TypeScript** single-page application built with Vite. It features a dashboard with analytics, a mobile-first "Quick Add" workflow for sourcing, and detailed inventory management pages.
*   **Database:** A **PostgreSQL** database running in Docker on the Raspberry Pi, serving as the single source of truth for all application data.
*   **Infrastructure:** The entire application is deployed on a **Raspberry Pi 3B+**, with a continuous deployment pipeline powered by **GitHub Webhooks** and a **Cloudflare Tunnel** for secure access.

---

## 4. The End-to-End Workflow: Target Design

> **Implementation Status (2026-02-01):** The workflow described in this section is the
> **target design** for the configuration-driven workflow engine (Epic #001 / Story #041).
> Steps 1, 3–6, and 10 have **not yet been implemented**. Steps 2, 7, 8, and 9 are
> operational today. See the table below for current status of each step.

This is how all the pieces will come together in a typical feature development cycle once the workflow engine is built:

| Step | Description | Status |
| :--- | :--- | :--- |
| 1. Idea Capture | `/idea` command + `scaffold_idea.py` | **PLANNED** — currently manual via `/story` |
| 2. Backlog Automation | `generate_backlog.py` / `generate_status_report.py` | **IMPLEMENTED** |
| 3. Story Promotion | `/set_status` command moves files between status dirs | **PLANNED** — currently manual header edits + `git mv` |
| 4. Work Queue Handoff | `/queue` command creates work orders | **IN PROGRESS** (via Story #070) |
| 5. Agent Pull Model | `/senior_dev` polls work queue | **PLANNED** |
| 6. Pre-flight Review | `/request_review` runs test suite | **PLANNED** |
| 7. Commit | `git commit` with pre-commit hooks | **IMPLEMENTED** |
| 8. Deployment | `make deploy` → GitHub webhook → Pi | **IMPLEMENTED** |
| 9. Monitoring | `make dashboard` for agent activity | **IMPLEMENTED** |
| 10. Documentation Gate | `/close_story` verifies doc updates | **PLANNED** |

### Step Details

1.  **Idea Capture (The Single Gateway):** An idea is captured using a unified command, like `/idea "My New Feature"`.
    *   A single script (`scaffold_idea.py`) reads a template from `docs/templates/story_template.md`, populates it, and creates a new story file in `docs/dev/stories/`.
    *   Finally, the script automatically runs `make backlog`.

2.  **Backlog Automation:** The `generate_backlog.py` script scans `docs/dev/stories/` and generates a fresh `BACKLOG.md` file. The `generate_status_report.py` script creates the HTML dashboard. This ensures the backlog is always a perfect reflection of the story files.

3.  **Story Formalization & Promotion:** A story's status is changed using a single, deterministic command: `/set_status #032 --status approved`.
    *   A script (`set_story_status.py`) finds the story file, updates the `**Status:**` header, and moves it to the appropriate location (e.g., `docs/dev/stories/completed/` for closed stories).
    *   Finally, it triggers `make backlog`.

4.  **Handoff (The Work Queue):** The `/architect` queues a story for work using `/queue #032`.
    *   The workflow engine creates a transactional work order. The interim solution (Story #070) uses a file-based queue, while the target state (Story #041) uses a SQLite database.
    *   It promotes the story's status to `in_progress`.

5.  **Execution (The Agent Pull Model):** The `/senior_dev` agent polls the workflow engine's database for available work.
    *   It claims the next task, loads the full story context, and begins execution.
    *   It uses `launch_subagent.py` to spawn `/junior_dev` agents as needed.

6.  **Verification (The Pre-flight Check):** Before work can be reviewed, the `/senior_dev` must run `/request_review #032`.
    *   This executes the full test suite (`make test`) and linter (`ruff check .`).
    *   **Gated Handoff:** If any check fails, the command fails. On success, a review request is placed in the workflow engine's review queue.

7.  **Commit:** The `/architect` reviews the code and, upon approval, runs `git commit`.
    *   **Pre-Commit Hooks:** The existing `pre-commit` hooks run `ruff` and `pi_audit.py` as a final safety net.

8.  **Deployment:** The developer runs `make deploy`.
    *   **Pre-Push Hook:** A `pre-push` git hook blocks direct pushes to `main`, ensuring `make deploy` is always used.
    *   This pushes the code to the `main` branch, which triggers the **GitHub webhook**. The server on the Raspberry Pi receives the webhook, pulls the latest code, and restarts the application containers.

9.  **Monitoring:** Throughout the process, the developer can view agent activity and system health on the **Unified Monitoring Page** by running `make dashboard`.

10. **Story Closure (Documentation Gate):** The `/product` persona closes a story using `/close_story #032`.
    *   This reads the story's `## Documentation Impact` section and verifies that every listed file has been modified in recent git history.
    *   **Gated Closure:** If verification fails, the command fails, blocking closure. On success, it promotes the story to `closed` and regenerates the backlog.

---

This entire "world" is designed to be a self-reinforcing loop of quality and efficiency. The tools enforce the process, the process builds the application, and the application's needs drive the creation of new tools.

---

## 5. Critical Analysis: The "Crystal Palace" Problem

While the fully deterministic model outlined above is powerful in theory, it has significant weaknesses that must be addressed. The system, in its current design, is a "crystal palace": intricate, beautiful, and easily shattered.

### A. Brittleness of the File-System-as-Database

The original workflow design relied on using the file system as a database (e.g., `work_queue/`, `review_queue/`, status directories). This is inherently fragile.

*   **Race Conditions & State Corruption:** A script crashing mid-operation (e.g., moving a file but failing to update the backlog) can leave the system in an inconsistent state.
*   **No Transactions:** File system operations are not transactional. There is no built-in mechanism for rollback if one step in a multi-step process fails.

> **Resolution:** Epic #001 / Story #041 replaces file-based queues with a transactional
> SQLite database, providing ACID guarantees for workflow state transitions.

### B. High Maintenance Cost of Custom Tooling

We have replaced manual process steps with a large suite of custom scripts (`scaffold_idea.py`, `set_story_status.py`, etc.).

*   **Transformed Workload:** We haven't eliminated work; we've transformed it into a software maintenance problem. Our process is now a codebase that must be tested, documented, and evolved.
*   **Rigidity:** A simple change, like adding a new status, requires coordinated updates across multiple scripts, increasing the cost of change.

> **Resolution:** The `workflow.yaml` manifest approach (Epic #001) replaces hardcoded
> scripts with a single configuration file parsed by a generic engine.

### C. Underestimated Complexity of Critical Components

The plan glosses over components that are orders of magnitude more complex than they appear. The "automated rollback script" and "production smoke test" are major engineering subsystems, not simple scripts. Under-scoping them introduces significant risk.

**Conclusion:** The biggest risk is that the maintenance of this complex tooling becomes the primary work of the team, distracting from the goal of building the application itself. The path forward is not to abandon the model, but to evolve it into a more robust and extensible framework, potentially driven by a central configuration manifest rather than hardcoded scripts.

---

## 6. Architect's Review & Path Forward

The following is the Architect's formal review of the technical layout and the preceding critical analysis.

### Strengths: What I Like

1.  **Excellent Separation of Concerns:** The "Control Plane / Worker Plane" model is a very strong architectural pattern, correctly isolating high-intensity reasoning tasks from state management and lightweight execution.
2.  **Robust Guardrails as a Foundation:** The emphasis on non-negotiable guardrails (`pre-commit` hooks, runtime hooks, `Makefile`) creates a development environment that actively prevents errors.
3.  **Configuration-Driven Design:** The evolution away from hardcoded scripts towards configuration files (`agent_config.yaml`, proposed `workflow.yaml`) is the most important architectural decision here. It's the key to turning this from a rigid internal tool into a flexible framework.
4.  **Observability by Default:** The "Guaranteed Observability" principle, enforced by the `launch_subagent.py` script, is essential for debugging.

### Architect's Concerns: The "Crystal Palace" Problem

The critical analysis section is spot-on. My primary concerns align perfectly with what's documented there, but I'll add my architectural perspective.

1.  **The File System is a Brittle State Machine:** This is the single biggest technical risk. Using directories as a message bus has no transactional integrity.
    *   **Recommendation:** Replace file-based queues with a transactional **SQLite database** for ACID guarantees. *(Addressed by Story #041)*

2.  **The Deployment "Hack":** The current `make deploy` command is a manual `git push` that bypasses gated checks. The plan to replace this with a `/deployer` persona is correct, but we must acknowledge that this is a massive sub-project.

3.  **The Maintenance Burden is Real:** We risk spending more time building the factory than the car. The proposed `workflow.yaml` manifest is the correct antidote. Our immediate priority should be to build the generic "workflow engine" that reads this manifest.

### Summary & Path Forward

My recommendation is to proceed with the following priorities:

1.  **Build the Engine First (Story #041 / Epic #001 Phase 1):** Build the configuration-driven workflow engine with a `workflow.yaml` structure and a generic transition executor.
2.  **De-risk the State Machine:** As part of that engine, replace file-based queues with SQLite for transactional integrity.
3.  **Isolate the Deployer:** Create a separate Epic for the "Production-Grade Deployer" to properly scope automated testing, deployment, and rollback. Treat the current `make deploy` as a temporary shortcut.

To make the "Build the Engine First" concept more concrete, here is an example of what the `workflow.yaml` manifest could look like. This file would serve as the "source code" for our entire process, read by a generic workflow engine.

```yaml
# config/workflow.yaml
# This manifest defines the stages and transitions of our agentic workflow.
# The workflow engine reads this file to understand the "rules of the game".

stages:
  - name: unprioritized
    directory: docs/dev/stories
  - name: approved
    directory: docs/dev/stories
  - name: in_progress
    directory: docs/dev/stories
  - name: in_review
    directory: docs/dev/stories
  - name: deployed
    directory: docs/dev/stories/completed
  - name: closed
    directory: docs/dev/stories/completed

transitions:
  - name: idea
    to: unprioritized
    command: /idea
    script: scripts/workflow/scaffold_story.py
    post_hook: scripts/workflow/run_backlog.sh

  - name: approve
    from: unprioritized
    to: approved
    command: /approve
    script: scripts/workflow/move_story.py
    post_hook: scripts/workflow/run_backlog.sh

  - name: close
    from: deployed
    to: closed
    command: /close_story
    pre_check_script: scripts/workflow/check_documentation.py # The documentation gate
    script: scripts/workflow/move_story.py
    post_hook: scripts/workflow/run_backlog.sh
```

By focusing on building a resilient and extensible framework rather than a rigid process, we can mitigate the risks and create something truly powerful. This framework is the.copernicus of the platform extraction (Story #030).

---

## 7. Product Owner's Review (2026-02-03)

### Assessment
This document remains the cornerstone of our platform strategy. The "Crystal Palace" problem it identifies is the single most important technical challenge we face in achieving a reliable, automated workflow. The path forward outlined by the Architect—to build a configuration-driven workflow engine (Story #041)—is the correct one.

### Balancing Platform vs. Product
My primary concern as Product Owner is balancing the investment in "The Platform" against the delivery of "The Product." We must avoid the trap of spending all our time building the factory instead of the car.

To that end, the recent creation of the "PLATFORM" column in our HTML status report is a direct and positive outcome of this strategic document. It gives us clear visibility into how much of our active work is dedicated to infrastructure vs. user-facing features.

### Path Forward
1. Prioritize the Engine: The highest priority for platform work is completing the Workflow Engine MVP (Story #041) and its prerequisites (Story #055, #070). This will provide the stability needed to accelerate all other development.
2. Continuous Validation: We will continue to use the status board to ensure we maintain a healthy balance between platform and product stories in our active work queue.
3. Incrementalism: The approach of using a file-based queue (Story #070) as an interim step toward the full database engine (Story #041) is a good example of pragmatic, incremental progress. We should continue to favor this approach.

### Strategic Pivot: The Two-Product Strategy
**Update (2026-02-03):** We have recognized that the "Agentic Platform" is not just infrastructure, but a potential standalone product. We will proceed with extracting the.copernicus workflow engine into its own repository (Story #030).
*   **Benefit:** This decouples the lifecycle of the Platform from the App.
*   **Role:** COPERNICUS IDE will serve as the "Customer Zero" implementation to validate the Platform.
*   **Architecture:** The Platform will be designed as a "Hidden Framework." The.copernicus logic (CLI, SQLite, Hooks) will be packaged as a binary/library, exposing only configuration files (`workflow.yaml`, `personas/`) to the end user.
