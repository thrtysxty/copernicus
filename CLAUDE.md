# CLAUDE.md
**Project:** BENWAY (Formerly High Plains Hipster)
**Stack:** Python 3.11/Flask, PostgreSQL 16, React 18/TS (Electron), Raspberry Pi 3B+ (Docker)
**Context:** `docs/planning/architecture_quick_ref.md` for schema/API details.
**Tooling:** `claude_mcp_config.json` (Context7 + Lynkr)
**Knowledge Source:** Local Repo (Primary) + Lynkr (External Docs).

## Subagent Policy
**Always launch Sonnet subagents unless specified otherwise.**

## Tool Use Protocol
You have access to tools. To use them, output strict XML tags in your response.

1. **Write File:**
   `<write_file path="src/file.py">code here</write_file>`
2. **Execute Shell Command:**
   `<exec_command>python scripts/test.py</exec_command>`

## Common Commands
```bash
make dev             # Start Backend (5001) + BENWAY (3000)
make test            # Run test suite
make deploy          # Push to Pi and restart containers
make db-deploy       # Deploy database schema to Pi
make agent           # Terminal 1: Launch Agent (with venv + MCP)
make dashboard       # Terminal 2: Launch Dashboard
```

## CD Pipeline (Push-to-Deploy)
**Overview:** GitHub webhook triggers automatic deployment on push to `main` branch.

**Components:**
- `scripts/deployment/webhook_server.py` - Flask webhook listener (port 5002)
- `scripts/deployment/deploy.sh` - Deployment script
- `scripts/deployment/setup_cloudflare_tunnel.sh` - Tunnel setup guide
- `highplains-webhook.service` - Systemd service

**Pi Setup:**
```bash
# Install webhook service
sudo cp scripts/deployment/highplains-webhook.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now highplains-webhook

# Setup Cloudflare tunnel
./scripts/deployment/setup_cloudflare_tunnel.sh
```

**Testing:**
```bash
python scripts/deployment/test_webhook.py
```

**Troubleshooting:**
- Check deployment logs: `/mnt/devdata/highplains/logs/deployment.log`
- Check webhook service: `sudo systemctl status highplains-webhook`
- Check Cloudflare tunnel: `sudo systemctl status cloudflared`

## Architecture

### Database Schema (10 tables)
Execution order matters due to foreign keys:
1. `inventory` - All items with SKU system (YY-CC-NNN format, stored as 7 digits)
   - `item_type`: 'vintage', 'card_set', 'card_single'
   - `old_sku`: Preserves original SKU format (e.g., 24A200102) for label lookup
   - `source_type`/`source_name`: Acquisition tracking
   - `sourcing_event_id`: Links to sourcing events for ROI tracking
2. `card_sets` + `card_pricing_tiers` + `individual_cards` - Trading card tracking
3. `item_metadata` - AI research data
4. `etsy_listings` - Etsy API integration
5. `images` - Photo management with processing pipeline
6. `keywords` - Tags (max 13 per item, 20 chars each per Etsy limits)
7. `sourcing_events` - Trip/event tracking with ROI calculations
8. `price_research_cache` - Market research caching (30-day TTL)

### API Endpoints (~60 total)
| Route Module | Prefix | Key Endpoints |
|--------------|--------|---------------|
| auth | `/api/auth` | login, register, refresh, logout, profile |
| inventory | `/api/inventory` | CRUD, status updates, bulk operations |
| cards | `/api/cards` | Card sets, individual cards, pricing tiers |
| images | `/api/images` | Upload, batch upload, processing, thumbnails |
| keywords | `/api/keywords` | Tag management, Etsy optimization |
| listings | `/api/listings` | Etsy draft management |
| research | `/api/research` | AI research, Claude integration |
| sourcing | `/api/sourcing` | Trip tracking, ROI reports |
| tools | `/api/tools` | Pre-purchase decision, profit calculator |

### Key Directories
- `backend/routes/` - Flask API blueprints (9 modules)
- `backend/utils/` - Business logic (profit_calculator, market_lookup, image_processor, scrapers/)
- `src/core/schema.py` - Pydantic schema for inventory item lifecycle
- `src/agentic/` - Platform infrastructure (Telemetry, Audit, Personas)
- `database/schema/*.sql` - Table definitions (deploy via `scripts/deploy_database.sh`)
- `benway/src/` - BENWAY IDE (Electron/React app) (api/, components/, pages/, store/)
- `data/seed/card_sets.csv` - 38 card set metadata (source of truth for generation)
- `data-local/imports/` - Working CSV files for import (gitignored)

### BENWAY Frontend Structure
```
benway/
├── electron/         # Main process & preload
├── src/
│   ├── renderer/     # React renderer process
│   │   ├── App.tsx   # Main layout (Zero-Gap Tiling)
│   │   ├── main.tsx  # Entry point
│   │   └── index.css # Surgical Phosphor Theme
│   ├── store/        # Zustand stores (benway, layout)
├── package.json      # Dependencies (Electron, React, Tailwind)
└── vite.config.ts    # Vite with Electron plugin
```

### SKU System
Format: `YY-CC-NNN` (e.g., `24-03-127` = 2024, Crate 3, Item 127)
Storage: 7 digits without dashes in database (`2403127`)

**Old SKU Migration:** `24A200102` → `2402102`
- Year (24) + Category letter (A, ignored) + Crate (2) + Sequence (00102)
- Use `scripts/csv_importer/validators.py` for conversion functions

### Workflow States
```
unlisted → needs_research → research_complete → needs_photos → photos_processed → ready_to_list → listed → sold
```

## Development Notes

### Pi Database Access
PostgreSQL runs in Docker container `highplains-db`. Use `docker exec` for psql commands:
```bash
cat file.sql | docker exec -i highplains-db psql -U pi -d highplains
```

### Data Storage
- **Git:** Code, schema, templates, reference data
- **External SSD (/mnt/devdata/highplains/):** Database, images, backups, personal inventory data
- Card checklists in `data-local/imports/card_checklists/` are working files (quantity=1 default, edit to 0 for missing)

### Code Style
- Python: Black formatter, 88 char lines, 4-space indents
- SQL: 2-space indents, lowercase keywords
- JS/React: Prettier, 2-space indents

## Agent Interaction Commands
Use these to switch personas or trigger specific workflows:
- `/log_error`: Trigger "Practice Coach" interview -> `scripts/utils/manage_logs.py`
- `/log_success`: Trigger Success interview -> `scripts/utils/manage_logs.py`
- `/product`: Switch to Product Owner (MVP & Strategy)
- `/architect`: Switch to Architect persona (Planning & Schema)
- `/senior`: Switch to Senior Dev persona (Task Breakdown & Review)
- `/deployer`: Switch to Deployer persona (Pi Operations)
- `/junior`: Switch to Junior Dev persona (TDD Implementation)
- `/story "Title"`: Scaffolds a new user story file.
- `/pi_check`: Verifies the codebase against Raspberry Pi constraints.

## Security & Guardrails
**Active Hooks:**
- `pre-commit`: Blocks `rm -rf`, secrets, and runs `pi_audit.py`. # nosec
- `pre-push`: Blocks direct pushes to `main` (use `make deploy`).

**Lifecycle Hooks (Runtime):**
- `PreToolUse`: `scripts/lifecycle/pre_tool_use.py` (Blocks dangerous args)
- `PostToolUse`: `scripts/lifecycle/post_tool_use.py` (Logs tool results)
- `SubagentStop`: `scripts/lifecycle/subagent_stop.py` (Updates Telemetry)
- `UserPromptSubmit`: `scripts/lifecycle/user_prompt_submit.py` (Logs prompts)
- `SessionStart`: `scripts/lifecycle/session_start.py` (Marks session start)
