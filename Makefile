.PHONY: help dev test test-e2e backlog deploy db-deploy db-migrate clean

# Infrastructure Config
CORE_SERVER_IP ?= 192.168.1.185  # Dell R210ii
PI_BASELINE_IP ?= 192.168.1.19  # Performance Baseline (Pi 3B+)

help:
	@echo "COPERNICUS IDE - Development Commands"
	@echo ""
	@echo "Usage: make <command> [ARG=value]"
	@echo ""
	@echo "Core Workflow:"
	@echo "  dev          - Start development server (backend + copernicus)"
	@echo "  test         - Run backend pytest suite"
	@echo "  test-e2e     - Run frontend Playwright E2E test suite"
	@echo "  deploy       - Deploy to Dell R210ii Core"
	@echo ""
	@echo "Utilities:"
	@echo "  backlog      - Generate the master backlog document"
	@echo "make import-data TYPE=<type> - Import CSV data (sets, checklists, inventory, all)"
	@echo "make db-deploy - Deploy database schema to Core"
	@echo "make db-migrate - Run pending database migrations on Core"
	@echo "  clean        - Clean build artifacts"

dev:
	(trap 'kill 0' SIGINT; source .venv/bin/activate && python backend/app.py & cd copernicus && npm run dev)

dev-backend:
	source .venv/bin/activate && python backend/app.py

dev-frontend:
	cd copernicus && npm run dev

test:
	source .venv/bin/activate && pytest tests/ -v

test-e2e:
	cd copernicus && npx playwright test

backlog:
	source .venv/bin/activate && python scripts/utils/generate_backlog.py

## ── Jules / Agent Dispatch ────────────────────────────────────────────────────
# Dispatch a story to Jules CLI:  make jules STORY=docs/stories/story_182_*.md
jules:
	@bash scripts/jules_assign.sh $(STORY)

# Dry-run (validates story, shows prompt size, does not dispatch):
jules-dry:
	@bash scripts/jules_assign.sh --dry-run $(STORY)

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

import-data:
	source .venv/bin/activate && python scripts/utils/import_data.py --type $(TYPE)

deploy:
	git push origin main
	ssh admin@$(CORE_SERVER_IP) 'cd ~/projects/high-plains-hipster && git pull && docker compose -f docker/docker-compose.yml restart'

db-deploy:
	ssh admin@$(CORE_SERVER_IP) 'cd ~/projects/high-plains-hipster && ./scripts/deployment/deploy_database.sh'

db-migrate:
	@echo "Running database migration on Core Server..."
	ssh admin@$(CORE_SERVER_IP) 'cd ~/projects/high-plains-hipster && source .venv/bin/activate && python scripts/migrations/backfill_card_inventory.py --execute'

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true # nosec
	find . -type f -name "*.pyc" -delete

## ── Ollama Inference Server (Dell R210ii Core) ────────────────────────
ollama-deploy:
	ssh core "cd agentic-platform && docker compose -f docker-compose.ollama.yml up -d"
	ssh core "cd agentic-platform && bash scripts/setup_ollama_server.sh"

ollama-status:
	@echo "=== Ollama on Core ==="
	@curl -sf http://$(CORE_SERVER_IP):11434/api/tags | python3 -m json.tool 2>/dev/null \
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
