---
name: scaffold-skills
description: Use when the user types `/scaffold-skills`
---

# /scaffold-skills Command

Use this skill when the user types the `/scaffold-skills` slash command in the chat interface. This command gives power users a direct, repeatable path to skill management without navigating to a UI modal.

There are three invocation modes for this command. Execute the exact logic described for the provided mode. 

**Note: You must use the `invoke_ipc` MCP tool or equivalent IDE integration to make the necessary IPC calls.** 

## Modes

### 1. No-args mode (`/scaffold-skills`)
- **Action**: Call the `skills:onboarding-needed` IPC. 
- **Details**: This causes the `SkillOnboardingModal` to open in the renderer. It works even if the project already has 2+ skill folders (bypasses the "already set up" gate).
- **Process**: 
  1. Call `skills:detect-stack` IPC to obtain the current `StackProfile`.
  2. Call `skills:onboarding-needed` IPC with the obtained `StackProfile`.
  3. Respond to the user in chat confirming: "Opening skill configuration..."

### 2. `--category <name>` mode (`/scaffold-skills --category <name>`)
- **Action**: Direct scaffold of a specific category.
- **Details**: Validates the category, then calls `skills:scaffold` IPC.
- **Process**:
  1. Match `<name>` case-insensitively against the 9 valid category names (see list below).
  2. If the category is unrecognised, respond with: "Unknown category: '<name>'. Valid options: library-api-reference, product-verification, data-fetching-analysis, code-quality-review, ci-cd-deployment, business-process, code-scaffolding, runbooks, infrastructure-ops". Do NOT make any IPC call.
  3. If valid, call `skills:detect-stack` IPC to get the current `StackProfile`.
  4. Call `skills:scaffold` IPC with `{ categories: ["<name>"], stackProfile: <profile> }`.
  5. On success, print to chat: "Generated: <category>" or "Skipped (already exists): <category>" based on the response.

### 3. `--list` mode (`/scaffold-skills --list`)
- **Action**: Inventory current state.
- **Process**:
  1. Call `skills:detect-stack` IPC to get the current stack summary and print it on a separate line.
  2. Read the `.claude/skills/` directory to see which templates are present.
  3. Print a formatted list of all 9 template categories.
  4. Each category must be marked as either "✓ scaffolded" or "○ not yet scaffolded" based on whether it exists in the directory.

## Valid Category Names
The 9 valid names match exactly the template subdirectory names:
- `library-api-reference`
- `product-verification`
- `data-fetching-analysis`
- `code-quality-review`
- `ci-cd-deployment`
- `business-process`
- `code-scaffolding`
- `runbooks`
- `infrastructure-ops`
