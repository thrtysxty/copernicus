# Kanban and Stories

The Kanban board tracks work across 9 lanes: Planning → Ready → In Progress → Review → Blocked → Testing → Done → Complete → Archived.

## Story Format

Stories are Markdown files with structured sections:

```markdown
# Story Title

## Blocks
- Description of the work to be done

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Definition of Done
- [ ] Tests pass
- [ ] Type check clean
```

Stories live in both SQLite (for the Kanban board) and `.md` files (for git tracking and agent access).

## Status Automation

Agents automatically update story status:
- Dispatch → sets to **In Progress**
- Completion → sets to **Review**
- Merge → sets to **Complete**

## Agent Queue

The Queue Scheduler manages story dependencies:
- Declare which stories block each other
- Collision guard prevents two agents editing the same files
- Blocker notifications when a dependency isn't met

## Creating Stories

- **Manual** — Click "+" in the Kanban, fill in the form
- **Genesis Wizard** — Describe your project, get a generated backlog
- **From Chat** — Ask an agent to create a story from a conversation
