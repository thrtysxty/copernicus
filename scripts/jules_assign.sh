#!/bin/bash
# jules_assign.sh — Dispatch a story to Jules CLI with full COPERNICUS context
#
# Usage:
#   ./scripts/jules_assign.sh docs/stories/story_182_flippablepanel_mode_prop.md
#   ./scripts/jules_assign.sh --as sentinel docs/stories/story_178_ipc_compliance.md
#   ./scripts/jules_assign.sh --dry-run docs/stories/story_182_flippablepanel_mode_prop.md
#
# What this does:
#   1. Validates the story file has required headers
#   2. Runs the IPC compliance pre-check on the current codebase
#   3. Injects the AGENTS.md into the prompt header
#   4. Constructs a structured prompt with explicit DoD checklist
#   5. Dispatches via `jules new`

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STORY_PATH=""
IDENTITY_HEADER=""
DRY_RUN=false
VERBOSE=false

# ── Parse Args ────────────────────────────────────────────────────────────────

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --as)
      case $2 in
        bolt)     IDENTITY_HEADER="PERSONA OVERLAY: BOLT ⚡ — Performance Mode\nFocus: Algorithmic efficiency, O(1) optimization, bundle size awareness.\n\n" ;;
        palette)  IDENTITY_HEADER="PERSONA OVERLAY: PALETTE 🎨 — UX/DX Mode\nFocus: Visual precision, phosphor adherence, interactive polish.\n\n" ;;
        sentinel) IDENTITY_HEADER="PERSONA OVERLAY: SENTINEL 🛡️ — Security Mode\nFocus: Hardening, secret detection, IPC surface minimization.\n\n" ;;
        *)        echo "❌ Unknown persona '$2'. Use: bolt | palette | sentinel"; exit 1 ;;
      esac
      shift ;;
    --dry-run) DRY_RUN=true ;;
    --verbose) VERBOSE=true ;;
    -*) echo "❌ Unknown flag: $1"; exit 1 ;;
    *)
      if [ -z "$STORY_PATH" ]; then STORY_PATH="$1"
      else echo "❌ Unexpected argument: $1"; exit 1
      fi ;;
  esac
  shift
done

# ── Validation ────────────────────────────────────────────────────────────────

if [ -z "$STORY_PATH" ]; then
  echo "Usage: ./scripts/jules_assign.sh [--as bolt|palette|sentinel] [--dry-run] <story.md>"
  exit 1
fi

if [ ! -f "$STORY_PATH" ]; then
  echo "❌ Story file not found: $STORY_PATH"
  exit 1
fi

# Check story has required headers
REQUIRED_HEADERS=("Status:" "Blocked By:" "Blocks:" "Acceptance Criteria" "Definition of Done")
MISSING=()
for h in "${REQUIRED_HEADERS[@]}"; do
  if ! grep -q "$h" "$STORY_PATH"; then
    MISSING+=("$h")
  fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "⚠️  Story is missing required sections:"
  for m in "${MISSING[@]}"; do echo "   • $m"; done
  echo "Fix the story file before dispatching."
  exit 1
fi

# Check story is APPROVED
if ! grep -q "APPROVED FOR IMPLEMENTATION" "$STORY_PATH"; then
  STATUS=$(grep "Status:" "$STORY_PATH" | head -1)
  echo "❌ Story is not APPROVED FOR IMPLEMENTATION"
  echo "   Current status: $STATUS"
  exit 1
fi

# ── Already-implemented guard ─────────────────────────────────────────────────
# Abort if any commit on main already mentions this story number.
# Prevents re-dispatching work that's already on main.
EXISTING_COMMIT=$(git log origin/main --oneline --grep="story.${STORY_NUMBER}[^0-9]" -i 2>/dev/null | head -1)
if [ -n "$EXISTING_COMMIT" ]; then
  echo ""
  echo "❌ DISPATCH BLOCKED — story ${STORY_NUMBER} already has a commit on main:"
  echo "   $EXISTING_COMMIT"
  echo ""
  echo "   If this story is genuinely incomplete, update its commit message or"
  echo "   override with: --force flag (not implemented — talk to Claude first)."
  exit 1
fi
echo "✓ No prior implementation commit found — safe to dispatch"

# Check Jules CLI
if ! $DRY_RUN && ! command -v jules &> /dev/null; then
  echo "❌ 'jules' CLI not found in PATH."
  echo "   Install: npm install -g @google/jules-cli (or check your PATH)"
  exit 1
fi

echo "✓ Story validated: $STORY_PATH"

# ── Check origin/main is up to date ───────────────────────────────────────────
# Jules fetches from origin/main — if local main is ahead, Jules can't see those
# files and will report "file not found" errors mid-session.

echo "Checking origin/main is in sync with local main..."
git fetch origin main --quiet 2>/dev/null || {
  echo "⚠️  Could not fetch origin/main — skipping sync check (no network?)"
}

UNPUSHED=$(git log origin/main..main --oneline 2>/dev/null)
if [ -n "$UNPUSHED" ]; then
  echo ""
  echo "❌ DISPATCH BLOCKED — local main is ahead of origin/main."
  echo "   Jules fetches from origin and won't see these commits:"
  echo "$UNPUSHED" | sed 's/^/   /'
  echo ""
  echo "   Fix: git push origin main"
  echo "   Then re-run this dispatch."
  exit 1
fi

echo "✓ origin/main is in sync"

# ── Run pre-flight IPC lint ────────────────────────────────────────────────────

if [ -f "$REPO_ROOT/scripts/ipc-lint.sh" ]; then
  echo "Running IPC compliance pre-check..."
  bash "$REPO_ROOT/scripts/ipc-lint.sh" --quiet || {
    echo "⚠️  IPC compliance issues found in current codebase."
    echo "   These are pre-existing — Jules should NOT fix them unless her story requires it."
    echo "   (She should avoid making them worse.)"
  }
fi

# ── Read inputs ───────────────────────────────────────────────────────────────

STORY_CONTENT=$(cat "$STORY_PATH")
STORY_NUMBER=$(basename "$STORY_PATH" | grep -oE '^story_[0-9]+' | grep -oE '[0-9]+' || echo "???")
STORY_TITLE=$(grep -m1 "^# \(User \)\?Story" "$STORY_PATH" | sed 's/^# //')

# Read AGENTS.md (Jules reads this from repo root automatically, but including
# it inline ensures she sees it even if her session working dir differs)
AGENTS_CONTENT=""
if [ -f "$REPO_ROOT/AGENTS.md" ]; then
  AGENTS_CONTENT=$(cat "$REPO_ROOT/AGENTS.md")
fi

echo "📖 Building prompt for: $STORY_TITLE"

# ── Build Prompt (temp file approach — avoids quoting issues with story content) ──

TMPFILE=$(mktemp /tmp/jules-prompt.XXXXXX)
trap "rm -f '$TMPFILE'" EXIT

# Write prompt to temp file section by section — printf handles special chars
printf '%s\n' "$IDENTITY_HEADER" >> "$TMPFILE"
printf '%s\n' "$(printf '━%.0s' {1..54})" >> "$TMPFILE"
printf '%s\n' "COPERNICUS IDE — STORY IMPLEMENTATION REQUEST" >> "$TMPFILE"
printf '%s\n' "$(printf '━%.0s' {1..54})" >> "$TMPFILE"
printf '\n%s\n\n' "You are implementing a story for the COPERNICUS IDE project." >> "$TMPFILE"
printf '%s\n' "READ THE AGENTS.MD AND STORY IN FULL BEFORE WRITING ANY CODE." >> "$TMPFILE"
printf '\n%s\n' "$(printf '━%.0s' {1..54})" >> "$TMPFILE"
printf '%s\n' "AGENTS.MD — YOUR PRIMARY CONTRACT" >> "$TMPFILE"
printf '%s\n' "$(printf '━%.0s' {1..54})" >> "$TMPFILE"
printf '%s\n' "$AGENTS_CONTENT" >> "$TMPFILE"
printf '\n%s\n' "$(printf '━%.0s' {1..54})" >> "$TMPFILE"
printf '%s\n' "STORY TO IMPLEMENT" >> "$TMPFILE"
printf '%s\n' "$(printf '━%.0s' {1..54})" >> "$TMPFILE"
printf '%s\n' "$STORY_CONTENT" >> "$TMPFILE"
printf '\n%s\n' "$(printf '━%.0s' {1..54})" >> "$TMPFILE"
printf '%s\n' "YOUR DEFINITION OF DONE — COMPLETE ALL BEFORE SUBMITTING PR" >> "$TMPFILE"
printf '%s\n\n' "$(printf '━%.0s' {1..54})" >> "$TMPFILE"
printf '%s\n' "STEP 1 — Implement only the ACs in the story. Do not refactor unrelated code." >> "$TMPFILE"
printf '\n%s\n' "STEP 2 — Run this BEFORE committing anything:" >> "$TMPFILE"
printf '%s\n' "  cd copernicus && npx tsc --noEmit" >> "$TMPFILE"
printf '%s\n' "  If there are TypeScript errors: FIX THEM. Do not submit with TS errors." >> "$TMPFILE"
printf '\n%s\n' "STEP 3 — Check AGENTS.md Forbidden Patterns. For every new ipcMain.handle():" >> "$TMPFILE"
printf '%s\n' "  - Is handleIpc() wrapping the body? -> if not, add it" >> "$TMPFILE"
printf '%s\n' "  - Is the channel in preload.ts SEND_CHANNELS? -> if not, add it" >> "$TMPFILE"
printf '%s\n' "  For every renderer IPC call:" >> "$TMPFILE"
printf '%s\n' "  - Is useIpcError() used? -> if not, replace window.ipcRenderer.invoke" >> "$TMPFILE"
printf '%s\n' "  - Is result.data accessed (not the whole result)? -> check after result.ok" >> "$TMPFILE"
printf '\n%s\n' "STEP 4 — Verify: cd copernicus && npx tsc --noEmit AGAIN after all changes." >> "$TMPFILE"
printf '%s\n' "  Zero errors = ready. Any errors = do not submit." >> "$TMPFILE"
printf '\n%s\n' "STEP 5 — Commit message format:" >> "$TMPFILE"
printf '%s\n' "  feat: Story ${STORY_NUMBER} -- <short description matching story title>" >> "$TMPFILE"
printf '\n%s\n' "Do NOT amend prior commits. Do NOT skip the tsc check." >> "$TMPFILE"
printf '%s\n' "Do NOT change files outside the scope listed in the story's Key Files section." >> "$TMPFILE"

PROMPT=$(cat "$TMPFILE")

# ── Output / Dispatch ─────────────────────────────────────────────────────────

CHAR_COUNT=${#PROMPT}
echo "   Prompt size: $CHAR_COUNT chars"

if $VERBOSE; then
  echo ""
  echo "━━━━ PROMPT PREVIEW (first 500 chars) ━━━━"
  echo "${PROMPT:0:500}..."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

if $DRY_RUN; then
  echo ""
  echo "✓ DRY RUN — prompt built successfully. Not dispatching."
  echo "  To dispatch: remove --dry-run flag"
  exit 0
fi

echo "🚀 Dispatching Story ${STORY_NUMBER} to Jules..."
jules new --repo JMThiessen/Copernicus "$PROMPT"
echo "✓ Dispatched. Monitor in Jules dashboard or IDE Jules panel."
