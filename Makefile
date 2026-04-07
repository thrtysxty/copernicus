.PHONY: help dev dev-backend dev-frontend test test-e2e backlog deploy db-deploy db-migrate clean reset reset-db validate-story validate-all setup

# Infrastructure Config
CORE_SERVER_IP ?= 192.168.1.185  # Dell R210ii
PI_BASELINE_IP ?= 192.168.1.19  # Performance Baseline (Pi 3B+)

help:
	@echo "COPERNICUS IDE - Development Commands"
	@echo ""
	@echo "Usage: make <command> [ARG=value]"
	@echo ""
	@echo "Core Workflow:"
	@echo "  setup        - Create .venv and install all dependencies (first-time setup)"
	@echo "  dev          - Start development server (backend + copernicus)"
	@echo "  test         - Run backend pytest suite"
	@echo "  test-e2e     - Run frontend Playwright E2E test suite"
	@echo "  deploy       - Deploy to Dell R210ii Core"
	@echo ""
	@echo "Utilities:"
	@echo "  backlog      - Generate the master backlog document"
		@echo "make db-deploy - Deploy database schema to Core"
	@echo "make db-migrate - Run pending database migrations on Core"
	@echo "  clean        - Clean build artifacts"
	@echo "  reset        - Wipe all app state (DB, settings, logs) - triggers setup wizard on next launch"
	@echo "  reset-db     - Wipe DB only (preserves settings and first-run state)"

VENV := .venv
PYTHON := $(shell [ -f $(VENV)/bin/python3 ] && echo $(VENV)/bin/python3 || echo python3)

# Bootstrap: create venv and install all dependencies
setup:
	python3 -m venv $(VENV)
	$(VENV)/bin/pip install -r backend/requirements.txt
	cd copernicus && npm install && npm rebuild better-sqlite3

dev:
	(trap 'kill 0' SIGINT; $(PYTHON) backend/app.py & cd copernicus && npm run dev)

dev-backend:
	$(PYTHON) backend/app.py

dev-frontend:
	cd copernicus && npm run dev

test:
	$(PYTHON) -m pytest tests/ -v

test-e2e:
	cd copernicus && npx playwright test

backlog:
	$(PYTHON) scripts/utils/generate_backlog.py

## ── Jules / Agent Dispatch ────────────────────────────────────────────────────
# Dispatch a story to Jules CLI:  make jules STORY=docs/stories/story_182_*.md
jules:
	@bash scripts/jules_assign.sh $(STORY)

# Dry-run (validates story, shows prompt size, does not dispatch):
jules-dry:
	@bash scripts/jules_assign.sh --dry-run $(STORY)

# Validate a single story spec:
validate-story:
	@bash scripts/story-validator.sh $(STORY)

# Validate all stories:
validate-all:
	@for f in docs/stories/story_*.md; do 
		echo "--- $$f ---"; 
		python3 scripts/utils/story_validator.py "$$f" || true; 
	done

# IPC compliance check across codebase:
ipc-lint:
	@bash scripts/ipc-lint.sh

# IPC lint with fix hints:
ipc-lint-fix:
	@bash scripts/ipc-lint.sh --fix-hints

# Jules env setup (run in Jules Initial Setup configuration):
jules-preflight:
	@bash scripts/jules-preflight.sh

# TypeScript type-check only:
tsc:
	@cd copernicus && npx tsc --noEmit

deploy:
	git push origin main
	ssh admin@$(CORE_SERVER_IP) 'cd ~/projects/copernicus && git pull && docker compose -f docker/docker-compose.yml restart'

db-deploy:
	ssh admin@$(CORE_SERVER_IP) 'cd ~/projects/copernicus && ./scripts/deployment/deploy_database.sh'

db-migrate:
	@echo "Running database migration on Core Server..."
	ssh admin@$(CORE_SERVER_IP) 'cd ~/projects/copernicus && source .venv/bin/activate && python scripts/migrations/run_migrations.py --execute'

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true # nosec
	find . -type f -name "*.pyc" -delete

reset:
	@echo "Wiping COPERNICUS app state (DB, settings, logs)..."
	rm -rf ~/Library/Application\ Support/copernicus/
	rm -rf ~/.copernicus/logs/
	@echo "Done. App will show setup wizard on next launch."

reset-db:
	@echo "Wiping COPERNICUS database only..."
	rm -f ~/Library/Application\ Support/copernicus/copernicus.db
	@echo "Done."

## ── Ollama Inference Server (Dell R210ii Core) ────────────────────────
ollama-deploy:
	ssh core "cd copernicus && docker compose -f docker-compose.ollama.yml up -d"
	ssh core "cd copernicus && bash scripts/setup_ollama_server.sh"

ollama-status:
	@echo "=== Ollama on Core ==="
	@curl -sf http://$(CORE_SERVER_IP):11434/api/tags | python3 -m json.tool 2>/dev/null 
	  || echo "[!] Ollama unreachable at http://$(CORE_SERVER_IP):11434"

ollama-stop:
	ssh core "docker stop copernicus-ollama || true"

## ── Local Ollama CLI Helpers ────────────────────────────────────────────────
# Ask a local Ollama model a question about a file. Requires `ollama` CLI to be installed.
# Usage: make ollama-ask FILE=<path> PROMPT=<prompt> [MODEL=scribe]
ollama-ask:
	@if [ -z "$(FILE)" ]; then echo "[!] Usage: make ollama-ask FILE=<path> PROMPT=<prompt>"; exit 1; fi
	@if [ -z "$(PROMPT)" ]; then echo "[!] Usage: make ollama-ask FILE=<path> PROMPT=<prompt>"; exit 1; fi
	@bash scripts/ollama_ask.sh "$(PROMPT)" "$(FILE)" "$(MODEL)"
