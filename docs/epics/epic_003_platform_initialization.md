# Epic 003: Platform Initialization & Template Readiness

**Status:** PLANNED
**Priority:** CRITICAL
**Phase:** Phase 1 - Infrastructure

## Narrative
**As a** Platform Engineer,
**I want** to standardize the extracted codebase and provide initialization tooling,
**So that** new projects can be bootstrapped from this repository without manual refactoring of "High Plains Hipster" artifacts.

## Context
The assets have been migrated from the product monorepo (Epic 002). Now they must be scrubbed of product-specific logic and prepared as a generic template. This includes creating the interactive setup script defined in Story #030.

## Acceptance Criteria
1.  **Interactive Setup:** `scripts/setup_project.py` exists and can:
    *   Rename the project.
    *   Initialize a virtual environment.
    *   Install dependencies from `requirements-stack.txt`.
    *   Install pre-commit hooks.
2.  **Generic Configuration:**
    *   `Makefile` uses variables for project names/paths.
    *   `CLAUDE.md` is a generic template, not the HPH specific one.
    *   `device_audit.py` is configurable via `config/devices/*.yaml`.
3.  **Clean Slate:** No "High Plains Hipster" specific code (e.g., inventory routes, etsy logic) remains in the core paths.
4.  **Git Readiness:** The repo is ready for `git init` and initial commit.

## Task List
- [ ] Create `scripts/setup_project.py`.
- [ ] Refactor `Makefile` to use `$(PROJECT_NAME)` variables.
- [ ] Create `config/devices/raspberry_pi_3b+.yaml` and `config/devices/macbook_m1.yaml`.
- [ ] Update `scripts/utils/device_audit.py` to load config.
- [ ] Sanitize `CLAUDE.md` and `docs/personas/` of product-specific context.
- [ ] Verify `requirements-stack.txt` is minimal and correct.
- [ ] Perform initial Git commit and push.

## Definition of Done
- A developer can clone this repo, run `python scripts/setup_project.py`, and have a working "Hello World" agentic environment.

---

## Initialization Procedure (Manual)

Until `setup_project.py` is complete, use these steps to initialize the repo and push the migration:

```bash
# 1. Initialize Git
git init
git branch -M main

# 2. Add Remote
git remote add origin https://github.com/JMThiessen/agentic-platform.git

# 3. Commit and Push
git add .
git commit -m "feat: Initial platform extraction (Epic 002)"
git push -u origin main
```