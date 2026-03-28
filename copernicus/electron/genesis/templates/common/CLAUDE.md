# CLAUDE.md
**Project:** {{projectName}}
**Stack:** {{stack}}

## Role Boundaries — ENFORCED
Claude's role is Plan → Delegate → Review. Not implement.
Use Gemini or Jules for implementation tasks.

## Architecture
- Define as project develops.
- (Stack-specific architecture notes will be added here based on selected stack.)

## Common Commands
```bash
# General commands
npm install
npm run build
```

## Performance Scope Notes
- Focus on token efficiency and modularity.
- Avoid large mono-file changes; delegate to specialized agents.

## Security Guardrails
- No hardcoded secrets.
- Secure IPC usage if using Electron.
- Validate all incoming user input.
