PROJECT_NAME ?= agentic-boilerplate
DEVICE_HOST ?= pi@raspberrypi.local
DEPLOY_PATH ?= ~/projects/$(PROJECT_NAME)

.PHONY: help dev test agent backlog deploy db-deploy clean

help:
	@echo "$(PROJECT_NAME) - Development Commands"
	@echo ""
	@echo "Usage: make <command> [ARG=value]"
	@echo ""
	@echo "Core Workflow:"
	@echo "  dev          - Start development server"
	@echo "  test         - Run backend pytest suite"
	@echo "  agent        - Start agent session"
	@echo ""
	@echo "Deployment:"
	@echo "  deploy       - Deploy to target device"
	@echo "  db-deploy    - Deploy database schema"
	@echo ""
	@echo "Utilities:"
	@echo "  backlog      - Generate the master backlog document"
	@echo "  clean        - Clean build artifacts"

dev:
	(trap 'kill 0' SIGINT; source .venv/bin/activate && python backend/app.py & cd frontend && npm run dev)

dev-backend:
	source .venv/bin/activate && python backend/app.py

dev-frontend:
	cd frontend && npm run dev

test:
	source .venv/bin/activate && pytest tests/ -v

agent:
	@echo "Starting agent session..."
	# source .venv/bin/activate && python scripts/agent_session.py

backlog:
	source .venv/bin/activate && python scripts/utils/generate_backlog.py

deploy:
	git push origin main
	ssh $(DEVICE_HOST) 'cd $(DEPLOY_PATH) && git pull && docker compose -f docker/docker-compose.yml restart'

db-deploy:
	ssh $(DEVICE_HOST) 'cd $(DEPLOY_PATH) && ./scripts/deployment/deploy_database.sh'

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true # nosec
	find . -type f -name "*.pyc" -delete
