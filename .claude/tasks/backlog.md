# Task Backlog

## P1 - High Priority (Blocking)

### Data Import (Ready to Execute)
- [ ] Export vintage inventory from Google Sheets to CSV
- [ ] Import vintage inventory using csv_importer module
- [ ] Manual review of 38 card checklists (set quantity=0 for missing, 2+ for duplicates)
- [ ] Import card checklists: `python scripts/import_card_checklists.py`

### Infrastructure
- [ ] **Remote Pi Access** - Make Raspberry Pi accessible from outside local network
  - Options: Tailscale, WireGuard VPN, port forwarding + DDNS
  - Security considerations for exposing services
  - Discuss tradeoffs before implementation

### Testing & Security
- [ ] Test coverage (targeting 100%)
- [ ] Security hardening (Redis token store, rate limiting, HTTPS)

---

## P2 - Medium Priority

### API Enhancements
- [ ] Etsy API Integration - OAuth and listing sync (pending API approval)

---

## P3 - Lower Priority

- [ ] Multi-platform support (eBay, Mercari)
- [ ] Quick-entry mobile workflow
- [ ] Advanced analytics and reporting

---

## Completed

### Week 1: Planning & Design
- [x] Defined business requirements
- [x] Designed database schema (8 tables)
- [x] Created SKU system (YY-CC-NNN)
- [x] Planned workflows and pipelines
- [x] Documented in PROJECT_INSTRUCTIONS.md

### Week 2: Infrastructure
- [x] Mac development environment configured
- [x] Raspberry Pi server deployed
- [x] External SSD storage mounted
- [x] Docker installed on Pi
- [x] Git repository initialized
- [x] All SQL schema files created
- [x] Deployment scripts created
- [x] Migration plan prepared

### Week 3: Database & Checklists
- [x] PostgreSQL database deployed to Pi (8 tables)
- [x] Deploy script updated for Docker exec
- [x] Generated all 38 card set checklists
- [x] Created CLAUDE.md for Claude Code context
- [x] Sourcing workflow gap analysis completed

### Week 3: CSV Import System
- [x] Added old_sku, source_type, source_name, item_type to inventory schema
- [x] Created csv_importer module (base.py, validators.py, inventory.py)
- [x] Implemented old SKU conversion (24A200102 → 2402102)
- [x] Updated import_card_checklists.py for new schema
- [x] Updated inventory_import_template.csv with new fields
- [x] Deleted migrate_spreadsheet.py (replaced by csv_importer)

### Week 3-4: Flask REST API
- [x] Implemented Flask app factory with blueprints
- [x] JWT authentication (Flask-JWT-Extended)
- [x] Users table and bcrypt password hashing
- [x] Inventory CRUD + workflow status transitions
- [x] Card sets and individual cards management
- [x] Image upload and processing endpoints
- [x] Keywords management (max 13, 20 chars)
- [x] Etsy listings draft creation and publish
- [x] Claude AI research integration (era, materials, keywords, descriptions)
- [x] ~50 API endpoints total
- [x] API documentation (docs/api_reference.md)

### Week 4-5: Additional Features
- [x] Sourcing events table with ROI tracking (schema, model, 7 endpoints)
- [x] Pre-purchase decision tool with market research
  - eBay scraper (API + web fallback)
  - Profit calculator (Etsy/eBay fee structures)
  - Market lookup service with Claude Vision
  - 6 new /api/tools endpoints
- [x] Photo processing pipeline
  - HEIC, PNG, WebP, JPEG support
  - Auto-resize (1200px listing, 300px thumbnail)
  - Dominant color extraction, EXIF parsing
  - Batch upload and processing
- [x] Price research caching schema
- [x] ~60 API endpoints total

### Week 5: React Frontend Foundation
- [x] Vite + React 18 + TypeScript project setup
- [x] TailwindCSS styling
- [x] Auth store with Zustand + localStorage persistence
- [x] API client with JWT token refresh
- [x] React Query for server state
- [x] Login page, Dashboard, Inventory list
- [x] Inventory detail page, Tools page (price check)
- [x] Protected routes with auth redirect
- [x] Updated README.md and CLAUDE.md documentation

### Week 6: Frontend Feature Completion
- [x] Quick Add page (replaces Tools) - mobile-first acquisition workflow
  - Price check integration
  - Profit calculator integration
  - Direct add-to-inventory flow
- [x] Sourcing Events page with list view and ROI summary
- [x] Sourcing Event modal for create/edit
- [x] Dashboard enhanced with Recharts
  - Pie chart for status breakdown
  - Bar chart for item types
  - ROI summary cards
- [x] Mobile-responsive navigation (hamburger menu)
- [x] New API modules (tools.ts, sourcing.ts)
- [x] TypeScript types for sourcing, tools, ROI
