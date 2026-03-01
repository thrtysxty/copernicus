#!/bin/bash
# ipc-lint.sh — IPC Compliance Checker for COPERNICUS
#
# Scans the copernicus/ directory for IPC pattern violations.
# Run before dispatching to Jules and after implementing a story.
#
# Usage:
#   ./scripts/ipc-lint.sh              # Full report
#   ./scripts/ipc-lint.sh --quiet      # Summary only (exit 1 if violations)
#   ./scripts/ipc-lint.sh --fix-hints  # Show suggested fixes alongside violations

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COPERNICUS="$REPO_ROOT/copernicus"
QUIET=false
FIX_HINTS=false
VIOLATIONS=0

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --quiet)     QUIET=true ;;
    --fix-hints) FIX_HINTS=true ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
  shift
done

RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RESET='\033[0m'

pass() { $QUIET || echo -e "  ${GREEN}✓${RESET} $1"; }
warn() { echo -e "  ${YELLOW}⚠ ${RESET} $1"; ((VIOLATIONS++)) || true; }
fail() { echo -e "  ${RED}✗${RESET} $1"; ((VIOLATIONS++)) || true; }
section() { $QUIET || echo -e "\n${CYAN}── $1 ──${RESET}"; }

# ── Check 1: Bare ipcMain.handle without handleIpc ────────────────────────────

section "ipcMain.handle — handleIpc() wrapper"

BARE_HANDLES=$(grep -rn "ipcMain\.handle(" "$COPERNICUS/electron/main.ts" 2>/dev/null \
  | grep -v "handleIpc(" \
  | grep -v "^\s*//" \
  | grep -v "handleIpc" \
  || true)

if [ -n "$BARE_HANDLES" ]; then
  fail "ipcMain.handle() without handleIpc() wrapper:"
  echo "$BARE_HANDLES" | while IFS= read -r line; do
    echo "    $line"
  done
  if $FIX_HINTS; then
    echo -e "    ${YELLOW}Fix: wrap body in handleIpc(() => ...)${RESET}"
  fi
else
  pass "All ipcMain.handle() calls use handleIpc() wrapper"
fi

# ── Check 2: Bare window.ipcRenderer.invoke in renderer ───────────────────────

section "Renderer IPC — useIpcError() hook usage"

BARE_INVOKES=$(grep -rn "window\.ipcRenderer\.invoke(" "$COPERNICUS/src/renderer/" 2>/dev/null \
  | grep -v "^\s*//" \
  || true)

if [ -n "$BARE_INVOKES" ]; then
  fail "window.ipcRenderer.invoke() used directly (should use useIpcError hook):"
  echo "$BARE_INVOKES" | head -20 | while IFS= read -r line; do
    echo "    $line"
  done
  if $FIX_HINTS; then
    echo -e "    ${YELLOW}Fix: const invoke = useIpcError(); const result = await invoke<T>('chan', arg)${RESET}"
  fi
else
  pass "No bare window.ipcRenderer.invoke() calls found"
fi

# ── Check 3: Channels in main.ts not in preload.ts SEND_CHANNELS ──────────────

section "IPC channel consistency (main.ts ↔ preload.ts)"

# Extract channel names from ipcMain.handle calls
MAIN_CHANNELS=$(grep -oE "ipcMain\.handle\('([^']+)'" "$COPERNICUS/electron/main.ts" 2>/dev/null \
  | grep -oE "'[^']+'" | tr -d "'" | sort || true)

# Extract channel names from SEND_CHANNELS in preload.ts
PRELOAD_CHANNELS=$(grep -oE "'[a-z][a-z0-9:_-]+'" "$COPERNICUS/electron/preload.ts" 2>/dev/null \
  | tr -d "'" | sort || true)

MISSING_IN_PRELOAD=$(comm -23 <(echo "$MAIN_CHANNELS") <(echo "$PRELOAD_CHANNELS") || true)

if [ -n "$MISSING_IN_PRELOAD" ]; then
  fail "Channels in main.ts but NOT in preload.ts SEND_CHANNELS:"
  echo "$MISSING_IN_PRELOAD" | while IFS= read -r chan; do
    echo "    '$chan'"
  done
  if $FIX_HINTS; then
    echo -e "    ${YELLOW}Fix: add each channel to SEND_CHANNELS Set in preload.ts${RESET}"
  fi
else
  pass "All main.ts channels are in preload.ts SEND_CHANNELS"
fi

# ── Check 4: Forbidden active state CSS ───────────────────────────────────────

section "Active state CSS — VT block pattern (§1.4)"

GHOST_TINT=$(grep -rn "bg-copernicus-phosphor/10" "$COPERNICUS/src/renderer/" 2>/dev/null \
  | grep -v "^\s*//" || true)

if [ -n "$GHOST_TINT" ]; then
  warn "Ghost tint active state found (forbidden — use solid VT block instead):"
  echo "$GHOST_TINT" | while IFS= read -r line; do echo "    $line"; done
  if $FIX_HINTS; then
    echo -e "    ${YELLOW}Fix: replace with 'bg-copernicus-phosphor text-[\#050505] rounded-none'${RESET}"
  fi
else
  pass "No ghost tint active states (bg-copernicus-phosphor/10) found"
fi

UNDERLINE_ACTIVE=$(grep -rn "border-b-2 border-copernicus-phosphor" "$COPERNICUS/src/renderer/" 2>/dev/null \
  | grep -v "^\s*//" || true)

if [ -n "$UNDERLINE_ACTIVE" ]; then
  warn "Underline active indicator found (forbidden — use VT block):"
  echo "$UNDERLINE_ACTIVE" | while IFS= read -r line; do echo "    $line"; done
else
  pass "No underline active indicators found"
fi

# ── Check 5: console.log calls ────────────────────────────────────────────────

section "console.log calls (should use electron-log)"

CONSOLE_LOG_OUTPUT=$(grep -rn "console\.log\|console\.warn\|console\.error" \
  "$COPERNICUS/electron/" "$COPERNICUS/src/renderer/" 2>/dev/null \
  | grep -v "node_modules" \
  | grep -v "^\s*//" \
  | grep -v "\.d\.ts:" \
  || true)

if [ -n "$CONSOLE_LOG_OUTPUT" ]; then
  CONSOLE_LOGS=$(echo "$CONSOLE_LOG_OUTPUT" | wc -l | tr -d '[:space:]')
  warn "$CONSOLE_LOGS console.log/warn/error call(s) found (Story 192 will clean these)"
  if ! $QUIET; then
    echo "$CONSOLE_LOG_OUTPUT" | head -10 | while IFS= read -r line; do echo "    $line"; done
    if [ "$CONSOLE_LOGS" -gt 10 ]; then
      echo "    ... and $((CONSOLE_LOGS - 10)) more (Story 192 handles these)"
    fi
  fi
else
  pass "No console.log calls found"
fi

# ── Check 6: Stale column IDs ─────────────────────────────────────────────────

section "Stale column IDs (blueprint, ui-design, staging)"

STALE_COLS=$(grep -rn "'blueprint'\|'ui-design'\|'staging'" \
  "$COPERNICUS/src/renderer/" "$COPERNICUS/electron/" 2>/dev/null \
  | grep -v "node_modules" | grep -v "^\s*//" || true)

if [ -n "$STALE_COLS" ]; then
  fail "Stale column IDs found (removed in Story 180):"
  echo "$STALE_COLS" | while IFS= read -r line; do echo "    $line"; done
else
  pass "No stale column IDs found"
fi

# ── Check 7: rotateColumn / toggleColumnMinimize calls ────────────────────────

section "Removed functions (rotateColumn, toggleColumnMinimize)"

REMOVED_FNS=$(grep -rn "rotateColumn\|toggleColumnMinimize" \
  "$COPERNICUS/src/renderer/" 2>/dev/null \
  | grep -v "^\s*//" || true)

if [ -n "$REMOVED_FNS" ]; then
  fail "Calls to removed functions:"
  echo "$REMOVED_FNS" | while IFS= read -r line; do echo "    $line"; done
  if $FIX_HINTS; then
    echo -e "    ${YELLOW}Fix: use setSpotlightLane(columnId) instead${RESET}"
  fi
else
  pass "No calls to removed column functions"
fi

# ── Check 8: vertical-text Tailwind class (doesn't exist) ─────────────────────

section "Non-existent Tailwind class (vertical-text)"

VERTICAL_TEXT=$(grep -rn '"vertical-text"' \
  "$COPERNICUS/src/renderer/" 2>/dev/null \
  | grep -v "^\s*//" || true)

if [ -n "$VERTICAL_TEXT" ]; then
  fail "vertical-text class used (doesn't exist in Tailwind):"
  echo "$VERTICAL_TEXT" | while IFS= read -r line; do echo "    $line"; done
  if $FIX_HINTS; then
    echo -e "    ${YELLOW}Fix: use inline style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}${RESET}"
  fi
else
  pass "No vertical-text class usage"
fi

# ── Check 9: Direct stateLedger.db.prepare() outside state-ledger.ts ──────────

section "DB access boundary (StateLedger encapsulation)"

DB_LEAKS=$(grep -rn "stateLedger\.db\." "$COPERNICUS/electron/" 2>/dev/null \
  | grep -v "state-ledger\.ts" \
  | grep -v "^\s*//" || true)

if [ -n "$DB_LEAKS" ]; then
  fail "Direct stateLedger.db access outside state-ledger.ts:"
  echo "$DB_LEAKS" | while IFS= read -r line; do echo "    $line"; done
  if $FIX_HINTS; then
    echo -e "    ${YELLOW}Fix: add a method to state-ledger.ts and call that instead${RESET}"
  fi
else
  pass "No direct stateLedger.db access outside state-ledger.ts"
fi

# ── Check 10: TypeScript compile ──────────────────────────────────────────────

section "TypeScript compile check"

if command -v npx &> /dev/null && [ -f "$COPERNICUS/package.json" ]; then
  TSC_OUTPUT=$(cd "$COPERNICUS" && npx tsc --noEmit 2>&1 || true)
  TSC_ERRORS=$(echo "$TSC_OUTPUT" | grep -c " error TS" || true)
  TSC_ERRORS=$(echo "$TSC_ERRORS" | tr -d '[:space:]')
  TSC_ERRORS="${TSC_ERRORS:-0}"
  if [ "$TSC_ERRORS" -gt 0 ] 2>/dev/null; then
    fail "TypeScript: $TSC_ERRORS error(s)"
    if ! $QUIET; then
      echo "$TSC_OUTPUT" | grep " error TS" | head -10 | while IFS= read -r line; do
        echo "    $line"
      done
    fi
  else
    pass "TypeScript: zero errors"
  fi
else
  warn "npx not found or copernicus/package.json missing — skipping tsc check"
fi

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
if [ "$VIOLATIONS" -eq 0 ]; then
  echo -e "${GREEN}✓ IPC lint passed — 0 violations${RESET}"
  exit 0
else
  echo -e "${RED}✗ IPC lint: $VIOLATIONS violation(s) found${RESET}"
  if $QUIET; then
    echo "  Run without --quiet for details."
  fi
  exit 1
fi
