# Workflow Builder

The Workflow Builder is a visual canvas for creating multi-step agent pipelines. Access it from the Activity Bar or `Cmd+Shift+W`.

## Node Types

| Node | Purpose |
|------|---------|
| **Agent** | Dispatch to any provider + model + persona |
| **Tool** | Run shell commands, Makefile targets, file I/O, Kanban actions |
| **Decision** | Gate on exit code, test results, or human approval |
| **Trigger** | Fire on story activation, PR events, or manual button |
| **Flow** | Group nodes into reusable subgraphs |

## Context Variables

Available in any node's prompt template:

- `{{__storyId}}` — Current story ID
- `{{__storyTitle}}` — Current story title
- `{{__lastExitCode}}` — Exit code from previous node
- `{{__lastOutput}}` — Output from previous node
- Custom variables defined in the node inspector

## Time-Travel

After each node executes, SnapshotManager captures the git SHA and workflow state. Click any completed node in the canvas to rewind — downstream nodes reset and re-execute from that point.

## Templates

Built-in templates for common patterns:

- **Code Review** — Agent reads diff, Decision gates on pass/fail
- **Bug Fix** — Agent analyzes error, Tool runs tests, Decision gates
- **Research** — Agent investigates, Tool saves findings

Create custom templates from any workflow via the template inspector.
