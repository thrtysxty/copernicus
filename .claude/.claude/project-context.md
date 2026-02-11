# High Plains Hipster - Project Context

**Last Updated:** January 4, 2026
**Current Phase:** Week 3-4 - Flask API Complete
**Status:** Full Flask REST API implemented with JWT auth, all CRUD endpoints, and Claude AI integration

---

## Quick Reference

### Active Work (Next Session)
1. Export vintage inventory from Google Sheets to CSV
2. Import vintage inventory: `from csv_importer import VintageInventoryImporter`
3. Manually review card checklists (set quantity=0 for missing, 2+ for duplicates)
4. Import card checklists: `python scripts/import_card_checklists.py`
5. Test Flask API endpoints
6. Begin frontend development

### Current Blockers
- None (Etsy API approval pending but not blocking current work)

### Recent Accomplishments
- ✅ Complete database schema designed (9 tables including users)
- ✅ Raspberry Pi server deployed and configured
- ✅ External SSD storage mounted and ready
- ✅ All deployment scripts created and tested
- ✅ Git repository initialized with proper structure
- ✅ Migration plan for Claude Code prepared
- ✅ PostgreSQL database deployed to Pi
- ✅ Deploy script updated for Docker exec
- ✅ All 38 card checklists generated (data-local/imports/card_checklists/)
- ✅ CLAUDE.md created for future Claude Code sessions
- ✅ Schema updated: added old_sku, source_type, source_name, item_type columns
- ✅ CSV import system implemented (scripts/csv_importer/)
- ✅ Old SKU migration support (24A200102 → 2402102)
- ✅ Card import script updated for new schema
- ✅ **Full Flask REST API implemented (~50 endpoints)**
- ✅ JWT authentication with Flask-JWT-Extended
- ✅ CRUD for all 9 tables (inventory, cards, images, keywords, listings, users)
- ✅ Claude AI integration for item research, keywords, descriptions
- ✅ Users table added for API authentication

---

## Project Overview

### Business Context
- **Business:** High Plains Hipster (vintage reselling on Etsy)
- **Owner:** One person, budget-conscious, time-limited
- **Goal:** Replace rideshare income ($300-400/month) with Etsy sales
- **Timeline:** 10 weeks to first listings

### Current Inventory
- ~150 vintage items from 2024 (in Google Sheets)
- ~50 new items from 2025 (not yet entered)
- 38 trading card sets (1991-1996 era, checklists generated)
- Photos: Partial coverage, need batch processing

### Income Target
- Initial: $300-400/month profit
- Replaces: 2-3 rideshare sessions/week (6-12 hours)
- Creates: Time for more sourcing and inventory growth

---

## Development Environment

### Hardware
- **Mac (Development):** M1, 8GB RAM, ~/Projects/high-plains-hipster/
- **Raspberry Pi (Production):** 3B+, hostname: devpi, IP: 192.168.1.18
- **Storage:** External SSD at /mnt/devdata/highplains/

### Software Stack
- **Backend:** Python 3.11, Flask, SQLAlchemy, PostgreSQL
- **Frontend (Planned):** React, TailwindCSS
- **Deployment:** Docker on Raspberry Pi
- **AI:** Claude API (Anthropic) for research

### Key Paths
```bash
# Development (Mac)
~/Projects/high-plains-hipster/

# Deployment (Pi)
pi@192.168.1.18:~/projects/high-plains-hipster/

# Data Storage (Pi)
/mnt/devdata/highplains/
  ├── images/      # Photo storage
  ├── database/    # PostgreSQL data
  ├── backups/     # Automated backups
  └── logs/        # Application logs

# Database
postgresql://pi:password@192.168.1.18:5432/highplains
```

---

## Database Schema (9 Tables)

### Core Tables
1. **inventory** - All items (vintage + card sets)
   - SKU system: YY-CC-NNN format
   - Workflow status tracking
   - Purchase/sale data

2. **card_sets** - Trading card set details
   - Links to inventory (1:1)
   - Completion tracking
   - Multi-platform flags

3. **individual_cards** - Individual cards within sets
   - Card tiers and pricing
   - Availability tracking
   - Etsy variation support

4. **card_pricing_tiers** - Pricing strategy
   - Base price + premiums
   - Example: Base $2, Chase +$3, Hologram +$6

5. **item_metadata** - Research data
   - AI-generated descriptions
   - Market comparables
   - Category/subcategory

6. **etsy_listings** - Etsy-specific data
   - API sync status
   - Required Etsy fields
   - Performance metrics

7. **images** - Photo management
   - Original, processed, thumbnail versions
   - Display order tracking
   - Upload status

8. **keywords** - Tags and search terms
   - Max 13 per item (Etsy limit)
   - Max 20 chars per tag (Etsy limit)
   - Source tracking

9. **users** - API authentication
   - bcrypt password hashing
   - JWT token support
   - Admin flag for permissions

---

## SKU System

### Format: YY-CC-NNN
- **YY:** 2-digit year (24 = 2024, 25 = 2025)
- **CC:** 2-digit crate number (01-99, 00 = unassigned)
- **NNN:** 3-digit sequence per crate (001-999)

### Examples
- `24-03-127` = Year 2024, Crate 3, Item 127
- `25-01-001` = Year 2025, Crate 1, Item 1
- `24-00-042` = Temporary/Unassigned

### Storage
- Database: 7 digits without dashes (`2403127`)
- Display: With dashes for readability (`24-03-127`)

---

## Workflow Pipelines

### Vintage Item Workflow
```
Purchase
  ↓ Enter into system
unlisted
  ↓ AI research
needs_research → research_complete
  ↓ Photography session
needs_photos → photos_processed
  ↓ Review listing
ready_to_list
  ↓ Publish to Etsy
listed
  ↓ Sale occurs
sold
```

### Trading Card Workflow (One-Time Setup)
```
Generate complete checklists (Claude Code)
  ↓ Set all quantity=1
39 CSV files created
  ↓ Manual review
Edit quantities (0 = missing, 2+ = duplicates)
  ↓ Bulk import
Import to database (quantity > 0 only)
  ↓
Database is source of truth
  ↓ Future acquisitions
Add via web UI
```

---

## Key Technical Decisions

### Database Choice: PostgreSQL
- **Why:** Advanced features (JSONB, arrays, triggers, views)
- **Over:** MySQL (simpler but fewer features)
- **Benefits:** Better for complex queries and metadata storage

### Storage Architecture
- **SD Card:** Code, Docker containers, OS
- **External SSD:** Data, images, backups, logs
- **Reason:** Protect SD card from wear, easier data migration

### SKU Design
- **Format:** YY-CC-NNN (7 digits)
- **Why:** Compact, sortable, scalable
- **Capacity:** 98,901 items per year (99 crates × 999 items)

### Development Approach
- **Mac First:** Develop and test locally
- **Pi Deployment:** Git pull → Docker restart
- **No Local Database:** Always connect to Pi (simplifies backups)

---

## Data Management Strategy

### What Goes in Git (✅)
- Source code (.py, .js, .sql)
- Configuration templates (.env.example)
- Documentation (.md files)
- Small reference data (templates, lookup tables)
- Schema definitions

### What Stays Local (❌)
- .env files (secrets)
- Personal inventory CSVs
- Photos and images
- Database files
- Generated checklists (working data)
- Backup files

### Directory Structure
```
data/                          # IN GIT
├── templates/                # Empty CSV templates
├── reference/                # Small lookup tables
└── seed/                     # Initial seed data
    └── card_sets.csv         # 39 card set metadata

data-local/                   # NOT IN GIT
├── imports/                  # Working import files
│   └── card_checklists/      # Generated complete lists
└── exports/                  # Generated exports
```

---

## Trading Card Checklist Workflow

### Phase 1: Generate Complete Checklists (Claude Code)
**Script:** `scripts/generate_all_card_checklists.py`

- Read `data/seed/card_sets.csv` (39 sets)
- Research official checklist for each set
- Generate CSV with ALL cards
- Set quantity=1 for all (assume owned)
- Output to `data-local/imports/card_checklists/`

**Time Estimate:** 20-40 minutes automated

### Phase 2: Manual Review (User)
- Open each CSV in Excel/Numbers
- Set quantity=0 for missing cards
- Set quantity=2+ for duplicates
- Verify card names and tiers
- Save edits

**Time Estimate:** 3-6 hours (can batch)

### Phase 3: Bulk Import (Claude Code)
**Script:** `scripts/import_card_checklists.py`

- Read all edited CSVs
- Filter to quantity > 0 only
- Create card_sets records
- Create individual_cards records
- Calculate completion percentages

**Time Estimate:** ~5 minutes

### Phase 4: Future Acquisitions
- Use web UI for new cards
- Database is source of truth
- No more CSV editing

---

## External Dependencies

### Etsy Developer Account
- **Status:** Application submitted Week 1
- **Approval Time:** 5-7 business days
- **Blocking:** No - can develop without API initially
- **Needed For:** Publishing listings, syncing status

### Anthropic Claude API
- **Status:** Ready to use
- **Purpose:** AI research, listing generation
- **Cost:** ~$0.01-0.05 per item
- **Key Location:** .env file (never commit)

### GitHub
- **Status:** Repository initialized
- **Purpose:** Version control, backup
- **Authentication:** SSH key configured

---

## Current Task Details

### Task 1: Deploy Database (Week 2, Session 3)
**Objective:** Get PostgreSQL running on Pi with all 8 tables

**Steps:**
1. SSH to Pi: `ssh pi@192.168.1.18`
2. Navigate: `cd ~/projects/high-plains-hipster`
3. Deploy: `./scripts/deploy_database.sh`
4. Verify: `docker ps` and `psql $DATABASE_URL -c "\dt"`
5. Test from Mac: `psql postgresql://pi:password@192.168.1.18:5432/highplains -c "\dt"`

**Success Criteria:**
- All 8 tables exist
- Connection works from both Pi and Mac
- No deployment errors

### Task 2: Generate Card Checklists (Week 2-3)
**Objective:** Create complete checklists for all 39 card sets

**Implementation:**
- Create `scripts/generate_all_card_checklists.py`
- Research official card lists (web search)
- Output format: set_name, card_number, card_name, card_tier, quantity
- Set all quantity=1 initially
- Save to `data-local/imports/card_checklists/`

**Success Criteria:**
- 39 CSV files generated
- All cards included (base, chase, hologram, etc.)
- Quantities default to 1
- Ready for manual review

---

## Development Priorities

### Immediate (Week 4)
1. ✅ Deploy database
2. ✅ Generate card checklists (38 sets complete)
3. ✅ Flask API complete (~50 endpoints)
4. ⏳ Manual review and edit card quantities
5. ⏳ Import initial inventory (vintage + cards)
6. ⏳ Deploy users table to Pi

### Short Term (Week 4-5)
1. ✅ Flask API (CRUD endpoints) - COMPLETE
2. ✅ AI research integration - COMPLETE
3. Create photo processing pipeline (Pillow)
4. Design basic frontend UI (React)

### Medium Term (Week 5-7)
1. Etsy API integration (OAuth pending)
2. Complete frontend development
3. Publish first listings
4. Monitor and optimize

### Long Term (Week 8-10)
1. Analytics dashboard
2. Multi-platform expansion
3. Mobile app (future consideration)
4. Scale to full-time income replacement

---

## Important Reminders

### Security
- Never commit .env files
- Never commit personal data (prices, notes)
- Never commit photos to Git
- Always use .gitignore properly

### Backup Strategy
- Code: Git + GitHub
- Data: External SSD + periodic cloud backup
- Database: Daily automated backups to SSD

### Development Workflow
1. Develop on Mac
2. Test locally (connect to Pi database)
3. Commit to Git
4. SSH to Pi, git pull
5. Restart services if needed
6. Verify in production

### Communication Preferences
- Educational code comments
- Explain "why" not just "what"
- Practical examples over theory
- Working code first, then explain
- No practice exercises

---

## Success Metrics

### Technical Milestones
- [x] Database deployed (9 tables)
- [x] 38 card checklists generated
- [x] Flask API functional (~50 endpoints)
- [x] AI research integration (Claude API)
- [ ] Initial inventory imported (200+ items)
- [ ] Photo processing working
- [ ] First Etsy listings published

### Business Goals
- [ ] Replace 2-3 rideshare shifts/week
- [ ] 40+ active listings
- [ ] $300-400/month profit
- [ ] 20+ hours/month saved via automation

---

## Quick Commands Reference

### SSH & Deployment
```bash
# Connect to Pi
ssh pi@192.168.1.18

# Deploy code
cd ~/projects/high-plains-hipster
git pull origin main
docker-compose restart

# View logs
docker-compose logs -f
```

### Database
```bash
# Connect to PostgreSQL
psql $DATABASE_URL

# List tables
\dt

# Describe table
\d inventory

# Exit
\q
```

### Git
```bash
# Status
git status

# Commit
git add .
git commit -m "Description"
git push origin main

# Recent history
git log --oneline -10
```

---

## Context Files

### Must Read
1. **This file** - Current status and quick reference
2. `docs/PROJECT_INSTRUCTIONS.md` - Complete documentation
3. `docs/claude-code-handoff.md` - Migration summary

### Reference as Needed
- `database/schema/*.sql` - Table definitions
- `docs/database_schema.md` - Schema details
- `docs/claude-code-guide.md` - How to work with this project
- `.claude/tasks/current.md` - Active task details
- `.claude/tasks/backlog.md` - Future work

---

## Notes & Updates

### 2026-01-04 - Flask REST API Complete
- **Full API Implementation (~50 endpoints):**
  - `/api/auth` - JWT login, logout, refresh, register
  - `/api/inventory` - CRUD + workflow status + metadata
  - `/api/cards` - Card sets, individual cards, pricing tiers
  - `/api/images` - Upload, processing, ordering
  - `/api/keywords` - Tag management (max 13, 20 chars)
  - `/api/listings` - Etsy draft creation, publish, sync
  - `/api/research` - Claude AI for era, materials, keywords, descriptions

- **New Dependencies:**
  - Flask-SQLAlchemy==3.1.1
  - Flask-JWT-Extended==4.6.0
  - bcrypt==4.1.2
  - marshmallow==3.20.1

- **New Database Table:**
  - `users` - API authentication with bcrypt password hashing

- **To Run API:**
  ```bash
  cd backend
  pip install -r requirements.txt
  python app.py  # Runs on http://localhost:5000
  ```

### 2026-01-04 - CSV Import System Implementation
- **Schema Updates:**
  - Added `old_sku` field for preserving original labels (24A200102 format)
  - Added `source_type`, `source_name` for acquisition tracking
  - Added `item_type` to distinguish vintage/card_set/card_single

- **CSV Import Module (`scripts/csv_importer/`):**
  - `base.py` - BaseImporter class with DB connection, ImportResult dataclass
  - `validators.py` - SKU conversion (24A200102 → 2402102), price parsing
  - `inventory.py` - VintageInventoryImporter with flexible column detection

- **Card Import Updates:**
  - Updated `import_card_checklists.py` for new schema
  - Card sets use crate 99 with generated SKUs

**Sourcing Workflow Gaps (Updated):**
| Priority | Gap | Status |
|----------|-----|--------|
| P1 | Source tracking in inventory | ✅ DONE |
| P1 | Import script | ✅ DONE (csv_importer) |
| P1 | SKU migration (old_sku) | ✅ DONE |
| P2 | Sourcing events table | Future |
| P2 | Import template | ✅ DONE |
| P2 | Pre-purchase decision tool | Future |
| P3 | Quick-entry mobile workflow | Future |
| P3 | Batch processing UI | Future |

### 2026-01-04 - Card Checklists Complete
- Generated all 38 card set checklists
- Created CLAUDE.md for future sessions
- Card sets: Marvel Universe (91-94), X-Men, DC, Image, Lady Death, Conan, etc.

### 2024-12-27 - Migration to Claude Code
- Completed all planning in web UI
- Created migration documentation
- Ready to begin development in Claude Code
- Database deployment and deploy script Docker exec fix completed

### Key Insights
- Card checklist workflow: Generate → Edit → Import (one-time)
- Database is source of truth after initial import
- CSVs are for import/export only, not ongoing management
- Automation saves ~15-35 hours vs. manual web UI approach

---

**End of Project Context**

*This file is automatically read by Claude Code at the start of each session.*
*Update this file to reflect current project status and priorities.*
