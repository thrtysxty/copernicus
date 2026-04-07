# CONTRIBUTING.md — Developer Documentation Suite

Welcome to the Copernicus development team! This guide outlines the essential protocols, workflows, and standards for contributing to the project. Adhering to these guidelines ensures a consistent, high-quality, and maintainable codebase.

## Welcome

Copernicus is an Agentic IDE built around a structured sprint system for AI-assisted software development. We believe in transparency and structured PM principles over "vibe-coding."

## Prerequisites

- Node 20
- Python 3.11
- Electron
- A system capable of running local agent logic (M-series Apple Silicon recommended for MLX local inference, but x86/cloud works via remote providers).

## Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Copernicus-IDE/copernicus.git
   cd copernicus
   ```

2. **Install dependencies:**
   ```bash
   cd copernicus && npm install
   cd ..
   pip install -r requirements-stack.txt
   ```

3. **Run the development stack:**
   (See the README for the full startup guide, generally `npm run start` within the `copernicus` directory, alongside the agent daemon).

## How This Project Works

Copernicus uses a unique AI-driven sprint system. For a developer who has never seen it:

- **Stories are the unit of work.** Every change is driven by a Markdown file in `docs/stories/`.
- **ACs define done.** Acceptance criteria in the story are the absolute law.
- **Agents implement.** AI agents (like Jules) read the story and write the code.
- **Humans review.** A human is always the final gate before merging.

**The Full Dispatch Sequence:**
1. A Story PR is created and merged into `main` (the story is now APPROVED).
2. The agent daemon dispatches Jules to implement the story.
3. Jules opens an implementation PR.
4. A human (and/or Claude) reviews the PR against the Acceptance Criteria.
5. Merge.

**Crucial Rule:** No direct pushes to `main` by anyone. All code goes through the PR process.

## Filing Issues

We use GitHub Issues to track bugs and feature requests. Bug reports and feature suggestions are welcome!

Please use the provided issue templates:
- [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md)
- [Feature Request](.github/ISSUE_TEMPLATE/feature_request.md)
- [Story Suggestion](.github/ISSUE_TEMPLATE/story_suggestion.md)

## Submitting PRs

When submitting a PR (whether human or agent):
- Always reference the Story number in the PR title and description (e.g., `feat(story-NNN): ...`).
- Fill out the PR template completely.
- Ensure the CI checks pass (specifically, `cd copernicus && npx tsc --noEmit` is a hard gate).

## AI-Assisted Workflow

This project uses AI agents as active contributors. See AGENTS.md for how that works. Human review is always the final gate. We are transparent about the AI's role and treat agents as collaborators within our structured environment.

## Code Standards

- **TypeScript strict**: No warnings, zero errors.
- **IPC Safety**: `handleIpc()` on every IPC handler in the main process.
- **Renderer IPC**: `useIpcError` hook must be used in the renderer for all IPC calls.
- **Types**: No `any` on IPC boundaries.

For the full set of mandatory rules, link to our [TECHNICAL_BIBLE.md](docs/reference/TECHNICAL_BIBLE.md).
