.PHONY: help dev test test-e2e backlog deploy db-deploy db-migrate clean

help:
	@echo "High Plains Hipster - Development Commands"
	@echo ""
	@echo "Usage: make <command> [ARG=value]"
	@echo ""
	@echo "Core Workflow:"
	@echo "  dev          - Start development server (backend + frontend)"
	@echo "  test         - Run backend pytest suite"
	@echo "  test-e2e     - Run frontend Playwright E2E test suite"
	@echo "  deploy       - Deploy to Raspberry Pi"
	@echo ""
	@echo "Utilities:"
	@echo "  backlog      - Generate the master backlog document"
	@echo "make import-data TYPE=<type> - Import CSV data (sets, checklists, inventory, all)"
	@echo "make db-deploy - Deploy database schema"
	@echo "make db-migrate - Run pending database migrations on Pi"
	@echo "  clean        - Clean build artifacts"

dev:
	(trap 'kill 0' SIGINT; source .venv/bin/activate && python backend/app.py & cd frontend && npm run dev)

dev-backend:
	source .venv/bin/activate && python backend/app.py

dev-frontend:
	cd frontend && npm run dev

test:
	source .venv/bin/activate && pytest tests/ -v

test-e2e:
	cd frontend && npx playwright test

backlog:
	source .venv/bin/activate && python scripts/utils/generate_backlog.py

import-data:
	source .venv/bin/activate && python scripts/utils/import_data.py --type $(TYPE)

deploy:
	git push origin main
	ssh pi@192.168.1.18 'cd ~/projects/high-plains-hipster && git pull && docker compose -f docker/docker-compose.yml restart'

db-deploy:
	ssh pi@192.168.1.18 'cd ~/projects/high-plains-hipster && ./scripts/deployment/deploy_database.sh'

db-migrate:
	@echo "Running database migration on Pi..."
	ssh pi@192.168.1.18 'cd ~/projects/high-plains-hipster && source .venv/bin/activate && python scripts/migrations/backfill_card_inventory.py --execute'

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true # nosec
	find . -type f -name "*.pyc" -delete
