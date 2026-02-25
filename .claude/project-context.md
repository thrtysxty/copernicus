# COPERNICUS Industrial Agentic OS - Project Context

**Last Updated:** February 24, 2026
**Current Phase:** REBRANDING & AESTHETIC OVERHAUL
**Status:** Project officially rebranded from COPERNICUS to COPERNICUS.

---

## 🛠️ THE TECHNICAL MANDATE
"Measure Twice, Cut Once." COPERNICUS is a state-first Industrial Agentic IDE. Every action must be deterministic, persisted to the State Ledger, and verified through the Industrial Pipeline.

### Active Feature (Story 094)
1. **Rebranding:** `copernicus/` directory has been renamed to `copernicus/`.
2. **Identity:** `package.json` and `package-lock.json` are updated to `copernicus`.
3. **Aesthetic:** Implementing "Professional Phosphor" (VT420 green glow, midnight oil black).
4. **State Ledger:** Initializing `copernicus.db` for universal agent memory.

---

## 🧬 DEVELOPMENT ENVIRONMENT

### Key Paths (CRITICAL)
- **Active Project Root:** `copernicus/` (Renamed from `copernicus/`)
- **Main Process:** `copernicus/src/main/`
- **Renderer Process:** `copernicus/src/renderer/`
- **State Ledger:** `~/.copernicus/state.db` (Transitioning to `copernicus.db`)

### Tooling & Commands
- **Root Makefile:** Use `make install`, `make build`, `make dev`, `make test`.
- **Ecosystem:** Electron v40.6.0, Vite v7.3.1, Vitest v4.0.18.
- **Styling:** Vanilla CSS + Tailwind (Technical Accents).

---

## 📋 INDUSTRIAL PIPELINE
Jules must follow the 6-column pipeline for every "Feature":
1. **Blueprint:** Plan the implementation in `docs/technical/`.
2. **Engine Room:** Implementation in `copernicus/src/`.
3. **Test Bench:** Mandatory Vitest unit tests and Playwright E2E tests.
4. **QA:** Build verification (`npm run build`).
5. **Documenting:** 3-tier documentation (Technical, User, Troubleshooting).
6. **Done:** Final validation and telemetry sync.

---

## ⚠️ CRITICAL REMINDERS
- **DO NOT** look for `copernicus/`. It no longer exists. All work happens in `copernicus/`.
- **STATE FIRST:** Persist all tool results and intents to the State Ledger.
- **GLOW MANDATE:** All headers must utilize the `.phosphor-glow` aesthetic.

---

**End of Project Context**
*This file is read by agents at session start. Uphold the Copernicus Standard.*

## SDK Consumption Model

This repo is the canonical source for the agentic development SDK.
Consumer projects (LEGACY, CORE) copy lifecycle scripts at bootstrap and
own them after that. See docs/sdk/CONSUMER_GUIDE.md.
