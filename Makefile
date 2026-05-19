.PHONY: help setup dev dev-backend dev-frontend dev-ollama test test-e2e tsc lint clean reset

help:
	@echo "Copernicus IDE — Development Commands"
	@echo ""
	@echo "  make setup        Install all dependencies (first-time)"
	@echo "  make dev          Start backend + frontend (requires setup)"
	@echo "  make dev-backend   Start Flask backend only"
	@echo "  make dev-frontend  Start Electron frontend only"
	@echo "  make dev-ollama   Start Ollama via Docker (optional)"
	@echo ""
	@echo "Quality:"
	@echo "  make tsc          TypeScript type check"
	@echo "  make lint         ESLint"
	@echo "  make test         Run Python tests"
	@echo "  make test-e2e     Run Playwright E2E tests"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean        Remove build artifacts"
	@echo "  make reset        Wipe app state (triggers setup wizard)"

VENV := backend/venv
PYTHON := $(shell [ -f $(VENV)/bin/python3 ] && echo $(VENV)/bin/python3 || echo python3)

# ── Bootstrap ──────────────────────────────────────────────────────────────
setup:
	@echo "Setting up Copernicus..."
	python3 -m venv $(VENV)
	$(VENV)/bin/pip install --quiet --upgrade pip
	$(VENV)/bin/pip install --quiet -r backend/requirements.txt
	cd copernicus && npm install
	cp -n secrets.example ~/.secrets 2>/dev/null || true
	@echo ""
	@echo "Setup complete. Run 'make dev' to start."
	@echo "Edit ~/.secrets to add your API keys."

# ── Development ───────────────────────────────────────────────────────────
dev:
	(trap 'kill 0' SIGINT; $(PYTHON) backend/app.py & cd copernicus && npm run dev)

dev-backend:
	$(PYTHON) backend/app.py

dev-frontend:
	cd copernicus && npm run dev

dev-ollama:
	docker compose -f docker-compose.ollama.yml up -d

# ── Quality ────────────────────────────────────────────────────────────────
tsc:
	cd copernicus && npx tsc --noEmit

lint:
	cd copernicus && npm run lint

test:
	$(PYTHON) -m pytest tests/ -v

test-e2e:
	cd copernicus && npx playwright test

# ── Maintenance ───────────────────────────────────────────────────────────
clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "node_modules" -prune -o -type d -name "dist" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "dist-electron" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true

reset:
	@echo "Wiping Copernicus app state..."
	rm -rf ~/Library/Application\ Support/copernicus/
	rm -rf ~/.copernicus/logs/
	@echo "Done. App will show setup wizard on next launch."
