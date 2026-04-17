# Copernicus USER_GUIDE.md — Quick Reference

This is the companion quick-reference to the full `USER_WORKFLOW.md`. It provides a cheat sheet for daily operations in the Copernicus IDE.

## Core Shortcuts

| Shortcut | Action | Context |
|---|---|---|
| `⌘1` | Open Planner | Activity Bar |
| `⌘2` | Open Editor | Activity Bar |
| `⌘3` | Open Designer | Activity Bar |
| `⌘4` | Open Orchestrator | Activity Bar |
| `⌘S` | Save File | Editor |

## View Summaries

| View | Purpose | Key Actions |
|---|---|---|
| **Planner** | Manage sprint backlog | Create stories, assign workflows, move cards across Kanban lanes |
| **Editor** | Write code | Edit files with LSP support, use Ghost Mode for shadow coding, split with Canvas |
| **Designer** | UI component creation | Import from Stitch, verify with Stitch, drag-and-drop components |
| **Orchestrator** | Agent workflows | Build workflows using Tile Library, monitor progress |
| **Reporter** (CapEx) | Project cost | Monitor token spend, view CapEx vs OpEx metrics |
| **Command Center** | Swarm monitoring | View active tasks, check LSP status, monitor stalls |
| **Org Chart** | Hub Token Authority | Configure roles, assign models, monitor token health |

## Daily Workflows

### 1. Morning Triage
1. Open **Command Center** to check for stalled agents or finished tasks from overnight.
2. Review the **Planner** Kanban board to see what moved.
3. If Jules finished a PR, click it on the card, open the **Review** view, check the diff, and merge.

### 2. Active Coding
1. Open the **Editor**.
2. Work alongside the primary Chat agent (Claude by default).
3. If an agent suggests changes, turn on **Ghost Mode** to preview them as "shadow code" inline before clicking "Accept All".

### 3. Dispatching
1. Write a clear story with Acceptance Criteria.
2. Move it to the **Sprint Planning** lane.
3. Open the Story Drawer and assign it to an agent (e.g., Jules) with the `jules-pr-manager` workflow.
4. Let it run in the background.

## Understanding Token Authority
Copernicus uses an Agent Hub that limits agent capability via a token schema. If an agent token expires or its budget is blown, the agent goes into a DEAD state and its work is suspended. You will see warnings in the **Org Chart** and **Command Center** if a token needs human renewal.
