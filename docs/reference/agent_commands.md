# Agent Workflow Commands

This document serves as the canonical reference for slash commands and automated workflows within the COPERNICUS Industrial Factory.

## 1. Persona Switching
| Command | Persona | Role |
| :--- | :--- | :--- |
| `/architect` | System Architect | Planning, Schema, Story Writing |
| `/product` | Product Owner | Strategy, MVP definition, Feedback |
| `/senior` | Senior Developer | Core implementation, Review, Tasking |
| `/junior` | Junior Developer | Tests, Documentation, Repetitive tasks |
| `/deployer` | Deployer | Infrastructure operations (Dell Core), SSH, Docker |

## 2. Feature Scaffolding
### `/story "Title" [--type story|api|component]`
Automates the creation of new feature sets.

*   **`--type story`** (Default):
    *   Creates a new user story Markdown file in `docs/stories/`.
    *   Regenerates the master `BACKLOG.md`.
*   **`--type api`**:
    *   Creates the user story file.
    *   Generates a Flask blueprint in `backend/routes/`.
    *   Generates a corresponding Pytest file in `tests/routes/`.
*   **`--type component`**:
    *   Creates the user story file.
    *   Generates a React TypeScript component in `copernicus/src/renderer/components/`.

## 3. Industrial Audits
### `/pi_check`
Runs the `scripts/utils/device_audit.py` engine to verify if the current codebase violates the **Raspberry Pi Performance Baseline** constraints (Memory, CPU, disallowed libraries). This ensures the IDE remains lightweight and optimized.

### `/audit`
Triggers the **Security Persona** logic to scan staged changes for:
*   Leaked API keys (Anthropic, OpenAI, Gemini, GitHub).
*   Hardcoded secrets or passwords.
*   Sensitive file remnants.

## 4. Operational Telemetry
### `/log_error` / `/log_success`
Triggers a post-implemention interview to record findings in the State Ledger and update troubleshooting documentation.

### `/capex`
Generates a financial report of the current session's capitalized value based on the industrial hourly rate ($65.00/hr).
