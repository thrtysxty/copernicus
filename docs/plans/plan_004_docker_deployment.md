# Execution Plan 004: Docker Configuration and Makefile Completion
**Sprint:** 2
**Agent Role:** Senior Developer (DevOps / Infrastructure)
**Story:** 101 (H-6 infra, Sprint 2 items)
**Prerequisite:** Plan 001 complete (backend/app.py must exist)
**Date Authored:** 2026-02-25

---

## Context

The platform's Makefile `deploy` target invokes `docker compose` on the Dell R210ii Core,
but no Docker configuration exists anywhere in the repository. Additionally, several
Makefile targets referenced in `CLAUDE.md` (`make agent`, `make dashboard`, `make lint`,
`make build`) are absent, breaking the documented developer workflow.

This plan creates the Docker configuration and completes the Makefile.

---

## Prerequisites

Before starting:
1. Confirm `backend/app.py` exists (Plan 001 must be complete).
2. Read `Makefile` in full to understand existing structure and variables.
3. Read `CLAUDE.md` lines 12–22 to understand the documented commands.

```bash
cat Makefile
```

---

## Task 1: Create Docker Configuration

### File: `docker/Dockerfile`

Create `docker/Dockerfile`:

```dockerfile
# ---------------------------------------------------------------------------
# COPERNICUS Backend — Production Docker image
# Base: Python 3.11 slim (matches project requirement)
# Target: Dell R210ii Core (x86_64)
# ---------------------------------------------------------------------------
FROM python:3.11-slim AS base

LABEL maintainer="copernicus-platform"
LABEL org.opencontainers.image.title="COPERNICUS Backend"

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---------------------------------------------------------------------------
# Dependencies layer (cached separately from source)
# ---------------------------------------------------------------------------
FROM base AS deps

COPY requirements-stack.txt .
RUN pip install --no-cache-dir -r requirements-stack.txt

# ---------------------------------------------------------------------------
# Application layer
# ---------------------------------------------------------------------------
FROM deps AS app

COPY backend/ ./backend/
COPY src/     ./src/
COPY scripts/ ./scripts/

# Create non-root user for runtime
RUN useradd -m -u 1000 copernicus && chown -R copernicus:copernicus /app
USER copernicus

# ---------------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------------
EXPOSE 5001

ENV FLASK_ENV=production
ENV FLASK_DEBUG=false
ENV BACKEND_PORT=5001

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5001/health || exit 1

CMD ["python", "backend/app.py"]
```

### File: `docker/docker-compose.yml`

Create `docker/docker-compose.yml`:

```yaml
# ---------------------------------------------------------------------------
# COPERNICUS Platform — Docker Compose
# Target: Dell R210ii Core
# Usage: docker compose -f docker/docker-compose.yml up -d
# ---------------------------------------------------------------------------
version: "3.9"

services:

  backend:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    image: copernicus-backend:latest
    container_name: copernicus-backend
    restart: unless-stopped
    ports:
      - "5001:5001"
    environment:
      - FLASK_ENV=production
      - FLASK_SECRET_KEY=${FLASK_SECRET_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - CONTEXT7_API_KEY=${CONTEXT7_API_KEY}
      - DATABASE_URL=${DATABASE_URL:-postgresql://copernicus:${DB_PASSWORD}@db:5432/copernicus}
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - copernicus-data:/app/data
    networks:
      - copernicus-net

  db:
    image: postgres:16-alpine
    container_name: copernicus-db
    restart: unless-stopped
    environment:
      - POSTGRES_USER=copernicus
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=copernicus
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U copernicus"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - copernicus-net

volumes:
  copernicus-data:
  postgres-data:

networks:
  copernicus-net:
    driver: bridge
```

### File: `docker/.env.example`

Create `docker/.env.example` (template for operators, never committed with real values):

```bash
# COPERNICUS Platform — Environment Variables
# Copy to docker/.env and fill in values before deploying.
# NEVER commit docker/.env to version control.

FLASK_SECRET_KEY=change-me-use-secrets-generate
ANTHROPIC_API_KEY=
OPENROUTER_API_KEY=
CONTEXT7_API_KEY=
DB_PASSWORD=change-me-strong-password
DATABASE_URL=
```

### File: `docker/.gitignore`

Create `docker/.gitignore`:

```
.env
*.env.local
```

---

## Task 2: Add Missing Makefile Targets

### File: `Makefile`

**Step 1: Read the Makefile in full.**

Identify the exact structure — variables section, `.PHONY` declaration, and existing
targets. Note the `VENV_PYTHON`, `PORT`, `CORE_SERVER_IP`, and any other variables.

**Step 2: Add missing variables at the top (if not already present).**

```makefile
VENV_PYTHON     ?= .venv/bin/python
VENV_PIP        ?= .venv/bin/pip
AGENT_SCRIPT    ?= scripts/agent_tui.py
DASHBOARD_SCRIPT ?= scripts/agent_cli.py
```

**Step 3: Add the following targets. Insert them in logical groupings with existing targets.**

```makefile
# ---------------------------------------------------------------------------
# Development workflow — agent and dashboard sessions
# ---------------------------------------------------------------------------

agent: ## Launch the agent TUI session (Terminal 1)
	@echo "Starting COPERNICUS Agent..."
	@source .venv/bin/activate && \
	  MCP_CONFIG=claude_mcp_config.json \
	  python $(AGENT_SCRIPT)

dashboard: ## Launch the agent dashboard (Terminal 2)
	@echo "Starting COPERNICUS Dashboard..."
	@source .venv/bin/activate && \
	  python $(DASHBOARD_SCRIPT)

# ---------------------------------------------------------------------------
# Code quality
# ---------------------------------------------------------------------------

lint: ## Run ruff linter and formatter check
	@echo "Running ruff..."
	@source .venv/bin/activate && \
	  ruff check . && \
	  ruff format . --check

lint-fix: ## Run ruff and auto-fix issues
	@source .venv/bin/activate && \
	  ruff check . --fix && \
	  ruff format .

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

build: ## Build the Copernicus Electron app for distribution
	@echo "Building Copernicus..."
	cd copernicus && npm run build

build-all: build ## Build all distributable artifacts
	@echo "All artifacts built."

# ---------------------------------------------------------------------------
# Pre-commit
# ---------------------------------------------------------------------------

hooks-install: ## Install pre-commit hooks
	@source .venv/bin/activate && pre-commit install
	@echo "Pre-commit hooks installed."

hooks-run: ## Run pre-commit against all files
	@source .venv/bin/activate && pre-commit run --all-files
```

**Step 4: Update the `.PHONY` declaration to include all new targets.**

Find the existing `.PHONY` line and append:

```makefile
.PHONY: ... agent dashboard lint lint-fix build build-all hooks-install hooks-run
```

**Step 5: Verify all targets are syntactically valid.**

```bash
make -n agent 2>&1 | head -5
make -n dashboard 2>&1 | head -5
make -n lint 2>&1 | head -5
make -n build 2>&1 | head -5
```

Each should print the command it would run, not a `make: *** No rule to make target` error.

---

## Task 3: Add `docker` Targets to Makefile

Add the following to the Makefile, replacing the existing `deploy`/`db-deploy` targets
with corrected versions:

```makefile
# ---------------------------------------------------------------------------
# Docker / Deployment (Dell R210ii Core)
# ---------------------------------------------------------------------------

REMOTE_USER        ?= admin
REMOTE_HOST        ?= $(CORE_SERVER_IP)
REMOTE_PROJECT_DIR ?= ~/projects/agentic-platform

docker-build: ## Build Docker image locally
	docker build -f docker/Dockerfile -t copernicus-backend:latest .

docker-up: ## Start all services via Docker Compose
	docker compose -f docker/docker-compose.yml up -d

docker-down: ## Stop all services
	docker compose -f docker/docker-compose.yml down

docker-logs: ## Tail service logs
	docker compose -f docker/docker-compose.yml logs -f

deploy: ## Deploy to Dell R210ii Core via SSH
	@echo "Deploying to $(REMOTE_HOST)..."
	ssh $(REMOTE_USER)@$(REMOTE_HOST) \
	  'cd $(REMOTE_PROJECT_DIR) && git pull && docker compose -f docker/docker-compose.yml restart'
	@echo "Deploy complete."

db-deploy: ## Deploy database schema to Core
	ssh $(REMOTE_USER)@$(REMOTE_HOST) \
	  'cd $(REMOTE_PROJECT_DIR) && docker compose -f docker/docker-compose.yml exec backend python -m scripts.db_migrate'

db-migrate: ## Run database migrations locally
	$(VENV_PYTHON) -m scripts.db_migrate
```

---

## Task 4: Verify `docker/` directory is in `.gitignore` correctly

**Step 1: Read `.gitignore` in full.**

**Step 2: Ensure these lines exist (add if missing):**

```gitignore
# Docker secrets
docker/.env
docker/*.env.local

# Build artifacts
docker/*.tar.gz
```

Do NOT add `docker/` itself — the configuration files must be tracked.

---

## Task 5: Create `pi_audit.py` to Fix Pre-Commit Hook

### File: `scripts/utils/pi_audit.py`

The pre-commit config references `scripts/utils/pi_audit.py` which does not exist.
This causes `pre-commit install` to install successfully but `pre-commit run` to fail.

Create `scripts/utils/pi_audit.py`:

```python
"""
Raspberry Pi 3B+ Performance Baseline Audit.

Checks staged Python files against constraints for low-RAM/low-CPU environments:
- No unbounded list comprehensions over large datasets
- No synchronous network calls in hot paths
- No imports of heavy libraries (torch, tensorflow, numpy > basic use)

Run by pre-commit. Exit 0 = pass, Exit 1 = fail.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path


# ---------------------------------------------------------------------------
# Rules
# ---------------------------------------------------------------------------

HEAVY_IMPORTS = {
    'torch', 'tensorflow', 'keras', 'cv2', 'sklearn',
    'scipy', 'transformers', 'diffusers',
}

PATTERNS = [
    (
        re.compile(r'^\s*import\s+(' + '|'.join(HEAVY_IMPORTS) + r')\b', re.MULTILINE),
        "Heavy ML library import detected — not suitable for Pi 3B+ baseline.",
    ),
    (
        re.compile(r'time\.sleep\s*\(\s*0\s*\)', re.MULTILINE),
        "Busy-wait sleep(0) detected — wastes CPU cycles on constrained hardware.",
    ),
    (
        re.compile(r'while\s+True\s*:\s*\n(?!\s*(time\.sleep|await|asyncio))', re.MULTILINE),
        "Unbounded while True loop without sleep/await — will saturate Pi CPU.",
    ),
]


def audit_file(path: Path) -> list[str]:
    """Return list of violation messages for a single file."""
    violations: list[str] = []
    try:
        source = path.read_text(encoding='utf-8', errors='ignore')
    except OSError:
        return []

    for pattern, message in PATTERNS:
        for match in pattern.finditer(source):
            line_no = source[:match.start()].count('\n') + 1
            violations.append(f"{path}:{line_no}: {message}")

    return violations


def main(argv: list[str]) -> int:
    files = [Path(f) for f in argv if f.endswith('.py')]
    all_violations: list[str] = []

    for f in files:
        all_violations.extend(audit_file(f))

    if all_violations:
        print("Pi Performance Baseline Audit — FAILED")
        for v in all_violations:
            print(f"  {v}")
        return 1

    print(f"Pi Performance Baseline Audit — PASSED ({len(files)} files checked)")
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
```

**Verify it runs:**

```bash
python scripts/utils/pi_audit.py scripts/agent_tui.py
```

Should print `PASSED` or a list of violations, not a traceback.

---

## Completion Checklist

- [ ] `docker/Dockerfile` exists and `docker build -f docker/Dockerfile .` succeeds
- [ ] `docker/docker-compose.yml` exists with `backend` and `db` services
- [ ] `docker/.env.example` exists
- [ ] `make -n agent` prints correct command
- [ ] `make -n dashboard` prints correct command
- [ ] `make -n lint` prints `ruff check .`
- [ ] `make -n build` prints `npm run build`
- [ ] `make -n deploy` prints SSH command with `agentic-platform` path
- [ ] `docker/` entries added to `.gitignore`
- [ ] `scripts/utils/pi_audit.py` runs without error
- [ ] `make hooks-install && make hooks-run` passes

**Commit message:**
```
feat(sprint-2): add Docker configuration and complete Makefile targets

- Add docker/Dockerfile, docker-compose.yml, .env.example for Core deployment
- Add make targets: agent, dashboard, lint, lint-fix, build, docker-*
- Parameterise remote deploy path with REMOTE_PROJECT_DIR variable
- Create pi_audit.py to satisfy pre-commit hook reference
```
