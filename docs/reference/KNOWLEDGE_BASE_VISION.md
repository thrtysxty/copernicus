# Copernicus Knowledge Base — Product Vision

**Version:** 1.0 | **Date:** 2026-03-26 | **Authority:** Jeremy

---

## What It Is

A curated, community-expandable knowledge base built into the IDE. Not documentation. Not a chatbot. A structured library of hard-won knowledge about building software with AI agents — the kind of content currently scattered across X threads, Reddit posts, and Discord servers that disappear.

The knowledge base lives where people work every day. It is findable in context, not requiring a search at 11pm when an agent session is going sideways.

---

## The Three Layers

| Layer | What it is | Who writes it |
|-------|-----------|---------------|
| **Curated KB** (this document) | How-to guides, foundational concepts, advanced techniques, provider context | Copernicus team + community contributors |
| **Personal memory** | What this user has built, patterns they've established, lessons from their sessions | Auto-extracted from use via `agent_memory` + retro system |
| **Live intelligence** | Current docs, CVEs, API changes | Context7 + Tavily on demand |

The curated KB answers "how do I do X." Personal memory answers "how have I done X before." Live intelligence answers "what changed since we last looked."

---

## Content Architecture

### Foundations
*For users new to software development. No assumed knowledge.*

- What is a Kanban board and why does it matter
- SDLC basics — what a software development lifecycle actually is
- Writing good stories and acceptance criteria
- What is a sprint
- How AI agents work, in plain English
- What "token" means and why it costs money

### The Copernicus IDE
*Provider-agnostic. Always complete. Only we can write this.*

- Wizard and first project setup
- Planner and Kanban workflow
- Editor
- Designer and storyboarding
- Orchestrator and workflow engine
- CapEx and billing
- Command Center
- Genesis project scaffold

### Providers and Agents
*Informed perspective from operating experience. Not full provider documentation — they have docs teams. We write the integration layer and the real-world context.*

- Choosing a model for the task at hand
- Claude (Anthropic) — strengths, context window behaviour, when to use
- Gemini (Google) — large context, what it handles well, tradeoffs
- Jules (Google) — what it's good at, how to structure work so it doesn't go off the rails
- Stitch (Google) — design-to-code pipeline, what it needs to succeed
- Ollama — local models, what fits in what RAM, what works well for code
- OpenRouter / DeepInfra — routing strategies, cost management
- BitNet — embedded agent, what it can and can't do

### Advanced Techniques
*Hard-won knowledge from operating experience. The content you find on X and Reddit — built into the tool instead.*

- Token efficiency — reducing waste without losing quality
- Agentic memory strategies — what to preserve, what to let go
- Structuring prompts for specific agents
- Context handoff patterns — passing state between Claude and Gemini mid-sprint
- Preventing agent drift and scope creep
- The loopy era — autonomous agent loops, when and how to run them
- Parallel dispatch patterns — when to run agents simultaneously vs. sequentially
- Writing stories tight enough that agents don't invent requirements

### Workflows and Patterns
*Reusable sprint patterns that work across providers.*

- Story dispatch cycle
- Design → build → review loop
- Sprint finishing ceremony
- Autonomous experiment loops (Karpathy pattern)
- Human-in-the-loop vs. fully autonomous — when each is appropriate

### Integrations
- GitHub — repository setup, PAT scopes, branch strategy
- MCP servers — what they are, which ones matter, how to configure
- Context7 — dependency documentation on demand
- Tavily — live web intelligence

---

## Product Principles

**Provider-agnostic.** The IDE sections never mention a specific provider. Provider sections are equal in structure — one template applied consistently. No provider is featured over another.

**Community-expandable by design.** The content format is a contribution spec, not just a style guide. Adding a new provider guide, workflow pattern, or advanced technique is a content contribution with no code changes required. As the repo goes public, contributors who use tools we don't will write better content for those tools than we would.

**Thin integration, not full documentation.** Provider guides are not tutorials — they cover what providers don't tell you: how they behave inside a multi-agent workflow, their failure modes, what makes them succeed in this specific context. We link to provider docs for everything else.

**Seeded from operating experience.** The advanced techniques section is where we have genuine original knowledge. No one else is writing "why Jules needs tight ACs or it invents requirements" or "how to structure a Claude-to-Gemini context handoff." That comes from building Copernicus with these tools, not from reading documentation.

**Living content.** As the retro system captures what worked and what didn't across user sessions, community-contributed discoveries can be promoted into the knowledge base. The gap between "I figured this out" and "this is documented in the tool" closes over time.

---

## IDE Integration

The knowledge base is surfaced through the **GUIDE tab** in the Chat Panel:

- **Browse mode** — content tree, searchable by keyword or topic
- **Contextual suggestions** — Copernicus references the KB when answering questions: "Here's how — the full walkthrough is in your Knowledge Base if you want to revisit it"
- **Deep links** — story cards, workflow templates, and error states can link directly to relevant KB articles
- **Offline-first** — core KB content is bundled with the app; no network required for the foundational content

Search is semantic over `intelligence_documents` for user-saved content, full-text over the curated KB.

---

## Launch Scope

**Must be complete at launch:**
- Foundations section (all articles)
- Copernicus IDE section (all articles)
- At least two provider guides that are not both from the same company — Ollama must be one (serves users with no paid API access)
- Advanced Techniques: token efficiency, structuring stories for agents, context handoff patterns

**Community fills in post-launch:**
- Additional provider guides
- Additional workflow patterns
- Provider-specific advanced techniques

---

## What This Is Not

- A replacement for provider documentation
- A support ticketing system
- A feature list or changelog
- An LLM-generated knowledge dump

The test for any article: does it contain knowledge you can't find in provider docs, and would a user working in Copernicus benefit from having it one click away?
