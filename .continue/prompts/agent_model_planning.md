🛠️ 2026 Local AI Infrastructure & Agent Blueprint
📋 Executive Summary
This document outlines the architecture for a multi-persona, sequential-handoff agent platform. The system leverages a hybrid hardware approach—utilizing a primary MacBook Air M1 for development and a dedicated Local Server for high-reasoning inference—to ensure deterministic execution while maintaining local privacy and zero operational costs.

💻 Environment 1: MacBook Pro (M1, 2020)
Role: Primary Node / Development IDE / "Junior" Persona Execution.

Specs: 8GB Unified Memory, Active Cooling ARM.

Constraint Management: Due to 8GB RAM limitations, the Mac is reserved for "bursty" tasks or lightweight models to prevent memory swap lag (Active cooling mitigates thermal throttling).

Mac-Specific Model Strategy

Persona	Recommended Model	Use Case
Junior Dev	qwen2.5-coder:1.5b	Writing boilerplate, unit tests, and GitHub Actions.
CI/CD / DevOps	llama3.2:1b	YAML linting, script validation, and dependency checks.
Fast Scribe	llama3.2:1b	Quick summaries and internal developer notes.
🖥️ Environment 2: Infrastructure Lab (Dell R210 II) - [FUTURE/PLANNED]
Role: Network Storage / Deployment / Model Training Lab.

OS: Proxmox Virtualization Environment (LXC/VMs).

Logic: Enterprise x86 hardware allows isolating concerns. Once configured, it will serve as the central NAS, CI/CD runner, and training lab. *Note: Currently pending installation.*

Server-Side Hardware Options (Comparison)

Device	Best For	RAM Cap	Speed (7B)
Intel N100	Dev Stability	32GB	~2-4 t/s
Orange Pi 5	Efficiency / NPU	32GB	~3-5 t/s
HP t530	Background Docs	16GB	< 1 t/s
Used RTX 3090	High Performance	24GB VRAM	50+ t/s
🔄 Sequential Handoff Loop (Deterministic Flow)
To maximize hardware, each step triggers a keep_alive: 0 command to clear RAM for the next persona.

Product Owner (qwen3:7b-instruct)

Input: User Goal ➡️ Output: Structured PRD & User Stories.

Architect (deepseek-r1:7b)

Input: PRD ➡️ Output: System Design, File Schema, & <think> logic.

Product Owner (qwen3:7b-instruct)

Task: Validation Loop. Sanity checks Architect's schema against PRD.

Senior Dev (qwen2.5-coder:7b)

Input: Schema ➡️ Output: Detailed Task List & core logic modules.

Junior Devs (qwen2.5-coder:1.5b)

Task: Code execution, boilerplate generation, and unit tests.

Senior Dev (qwen2.5-coder:7b)

Task: Review. Merges Junior code and refactors for quality.

Architect (deepseek-r1:7b)

Task: Compliance Check. Verifies final code against original design.

The Scribe (qwen2.5-coder:3b)

Task: Documentation. Generates Technical Specs and end-user Guides.

Product Owner (llama3.2:1b)

Task: Final Summary Report & Handoff to User.

📦 Specialized Tool: Etsy Sourcing Automation
The platform includes a dedicated "Sourcing-to-Listing" pipeline for vintage goods (figurines, prints, teapots).

Vision Logic: llama3.2-vision:11b (Server) looks for maker marks and hallmarks.

Research Logic: deepseek-r1:7b deduces the era/maker from visual tags.

Output: Automated high-converting SEO listings for the 150-item backlog.

⚙️ Core Platform Implementation
Server Access: OLLAMA_HOST=0.0.0.0 (Enables network-wide AI access).

VS Code Bridge: Use Continue.dev extension with personas mapped to specific local/network provider endpoints.

Memory Management: Sequential loading is enforced by the platform controller to allow complex 7B reasoning on budget hardware.

---

## Product Owner Review

**Reviewed:** 2026-01-27
**Status:** APPROVED IN PRINCIPLE

**Finding:** This document presents a compelling and ambitious vision for our agentic workflow. The hybrid hardware strategy is cost-effective and pragmatic, and the sequential handoff loop provides a clear, structured process that mimics a high-functioning software team. The focus on a concrete, high-value outcome like the "Etsy Sourcing Automation" tool is exactly right.

However, from a product perspective, I have two primary concerns:

1.  **Complexity & Risk:** The 8-step handoff loop is intricate. While deterministic in theory, it introduces numerous potential points of failure. A failure at any step could derail the entire process. We must prioritize resilience and the ability to recover from errors.
2.  **Platform vs. Product:** This plan focuses heavily on building the "factory" (the agentic platform). We must ensure this does not overshadow the goal of building the "car" (the High Plains Hipster application and its features). The "platform controller" mentioned seems like a significant project in itself.

**Recommendation:**
I approve this plan in principle, but with the recommendation that we approach it iteratively. Let's define an MVP for this workflow. Perhaps a 3-step loop (e.g., Architect -> Senior Dev -> Review) to prove the concept and build the foundational "platform controller." Once that is stable, we can incrementally add more steps and personas.

Let's prioritize delivering user-facing value while we build this powerful automation in the background.

---

## Architect's Review: Agent Model Planning in Project Context

**Reviewed:** 2026-01-27
**Status:** APPROVED IN PRINCIPLE (with critical architectural alignment and implementation strategy adjustments)

**Overall Assessment:**
The `docs/agent_model_planning.md` document presents a compelling and well-reasoned vision for our agentic workflow, aligning strongly with our project's core philosophy: "**harden the process by replacing manual, error-prone steps with deterministic, automated tooling.**" The hybrid hardware strategy is pragmatic, and the concept of a sequential handoff loop is powerful.

However, a critical architectural drift has been identified, and the implementation strategy for the proposed complex workflow needs to be carefully re-prioritized given our current tooling and known limitations.

---

### 1. Alignment with Project Philosophy & Existing Strengths

*   **Deterministic Tooling & Guardrails:** The plan's emphasis on specific models for specific roles and the sequential handoff loop directly supports our commitment to deterministic execution. This aligns perfectly with our existing guardrails like pre-commit hooks, runtime lifecycle hooks, and the `Makefile` as a service, all designed to enforce quality and consistency (`docs/agentic_ecosystem_overview.md`).
*   **Observability:** The plan implicitly relies on the observability infrastructure we've built (Story #021: Unified Monitoring Page), which tracks agent activity. This will be crucial for debugging the complex handoff loop.
*   **Cost-Effectiveness & Local Privacy:** The stated goals of "zero operational costs" and "local privacy" are foundational and excellent.

---

### 2. Critical Architectural Drift: The Claude Discrepancy

This is the most immediate and pressing concern.

*   **The Plan (`agent_model_planning.md`):** Explicitly assigns *local, Ollama-supported models* (`qwen2.5-coder`, `deepseek-r1`, `qwen3`) to *all* core agent personas (Product Owner, Architect, Senior Dev, Junior Dev, Scribe).
*   **The Reality (Your Feedback & `claude-code-handoff.md`):** You are currently experiencing "Claude session limits" and the `claude-code-handoff.md` document explicitly details a historical "Context Transfer" from "Web UI Planning Sessions" *to* "Claude Code Development Environment," mentioning "AI research integration (Claude API)" as future development.

**Architectural Finding:** There is a **critical misalignment** between our approved architectural plan for agent models and the current operational setup. The `agent_model_planning.md` is the *desired state*, but the system is currently configured to use external Claude models for roles intended for local Ollama instances. This directly contradicts our "zero operational costs" and "local privacy" principles and is the root cause of your production downtime.

**Immediate Action:** The top priority is to **enforce the `agent_model_planning.md` model assignments**. This means:
1.  **Audit and Reconfigure:** Immediately audit all `Continue.dev` configurations and persona definitions to ensure they exclusively point to the specified local Ollama models.
2.  **Verify Ollama Infrastructure:** Confirm Ollama is correctly running on the MacBook Air M1 and the LLM Network Server (Intel N100 Mini PC) with `OLLAMA_HOST=0.0.0.0` and all required models downloaded.

---

### 3. The "Crystal Palace" Problem Revisited: Orchestration of the Handoff Loop

The `agent_model_planning.md` proposes an 8-step sequential handoff loop. While conceptually powerful, this directly exacerbates the "Crystal Palace" problem already identified in `docs/agentic_ecosystem_overview.md`.

*   **File-System-as-Database Brittleness:** Our current "End-to-End Workflow" (`docs/agentic_ecosystem_overview.md`) relies heavily on the file system (`work_queue/`, `review_queue/`, status directories) for state management and handoffs. This is explicitly called out as "inherently fragile" due to race conditions, lack of transactional integrity, and state corruption risks. An 8-step loop built on this foundation would be extremely brittle.
*   **"Platform Controller" Complexity:** The `agent_model_planning.md` mentions "Memory Management: Sequential loading is enforced by the platform controller." This "platform controller" is the critical, currently un-scoped piece of infrastructure that needs to manage this complex state machine. It's far more than just memory management; it's the workflow engine itself.
*   **Context Management for Ephemeral Agents:** The `keep_alive: 0` strategy is excellent for memory management on budget hardware, but it places a massive burden on the workflow engine to reliably capture and pass *all* necessary context between ephemeral agent runs. This includes code, previous outputs, story details, and intermediate decisions.

**Architectural Finding:** The proposed 8-step loop is architecturally sound in its intent but critically underspecified in its orchestration layer. Implementing it directly on our current file-system-based workflow will lead to an unmanageable "crystal palace."

**Recommendation:**
1.  **Prioritize Workflow Engine MVP:** Before attempting the full 8-step loop, we must build a robust, configurable workflow engine (the "platform controller"). This engine needs to replace the brittle file-system-as-database for managing agent handoffs.
2.  **SQLite for Transactional State:** As previously suggested, a simple, file-based **SQLite database** would provide the necessary ACID guarantees for managing the state of our agentic workflow, ensuring transactional integrity for handoffs and preventing state corruption.
3.  **Iterative Workflow Definition:** Start with a simplified 3-step loop (e.g., Architect -> Senior Dev -> Review) within this new workflow engine to prove its capabilities and build foundational resilience. This aligns with the Product Owner's recommendation.

---

### 4. Integration with Backlog & Future Work

*   **Story #030 (Agentic Project Boilerplate):** This story, currently `BLOCKED` but `CRITICAL`, is essential for standardizing our agentic setup. The `agent_model_planning.md` provides the blueprint for what this boilerplate should contain (model assignments, hardware strategy).
*   **Story #024 (Project Bootstrap Templates):** This `ON HOLD` story could be re-evaluated to help scaffold the workflow engine's configuration files (e.g., `workflow.yaml`).
*   **Etsy Sourcing Automation:** This concrete feature is an excellent target for the agentic platform. Once the core workflow engine is stable, automating this pipeline will demonstrate significant value.

---

### Summary & Path Forward

The `agent_model_planning.md` provides an excellent strategic vision. However, its immediate implementation requires a two-pronged approach:

1.  **Immediate Fix:** Rectify the critical architectural drift by **enforcing the use of local Ollama models** for all agent personas as specified in `agent_model_planning.md`. This will eliminate the Claude session limit issue and align with our cost/privacy goals.
2.  **Strategic Evolution:** Prioritize the development of a **robust, SQLite-backed workflow engine** (the "platform controller") to manage agent handoffs. This engine will enable the complex sequential loops proposed in `agent_model_planning.md` without creating an unmanageable "crystal palace."

By addressing the immediate operational issue and then building a solid foundation for workflow orchestration, we can confidently move towards the ambitious and powerful agentic ecosystem envisioned in `docs/agent_model_planning.md`.
