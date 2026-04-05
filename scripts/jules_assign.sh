#!/bin/bash
# jules_assign.sh — Dispatch a story to Jules API with full COPERNICUS context
#
# Usage:
#   ./scripts/jules_assign.sh docs/stories/story_182_flippablepanel_mode_prop.md
#   ./scripts/jules_assign.sh --as sentinel docs/stories/story_178_ipc_compliance.md
#   ./scripts/jules_assign.sh --dry-run docs/stories/story_182_flippablepanel_mode_prop.md
#   ./scripts/jules_assign.sh --skip-validation docs/stories/story_182_flippablepanel_mode_prop.md
#
# What this does:
#   1. Validates the story file has required headers
#   2. Guards against re-dispatching already-implemented stories
#   3. Injects AGENTS.md into the prompt header
#   4. Constructs a structured prompt with explicit DoD checklist
#   5. Dispatches via Jules REST API with AUTO_CREATE_PR + requirePlanApproval

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STORY_PATH=""
IDENTITY_HEADER=""
DRY_RUN=false
VERBOSE=false
SKIP_VALIDATION=false # Added this line
AUTO_SELECT=false
MANUAL_AGENT=""

# ── Helper Functions ────────────────────────────────────────────────────────────

# Atomically update **Status:** in a story file with retry logic
update_story_status() {
  local story_file="$1"
  local new_status="$2"
  local retries=3
  local retry_delay=2
  local attempt=0

  # Skip if story is already archived
  if [[ "$story_file" == */completed/* ]]; then
    echo "  Status: $story_file already archived — skipping status update"
    return 0
  fi

  if [ ! -f "$story_file" ]; then
    echo "  Status: File not found: $story_file"
    return 1
  fi

  while [ $attempt -lt $retries ]; do
    attempt=$((attempt + 1))

    # Create temp file with updated status
    local tmp_file="${story_file}.tmp"

    # Use sed to replace **Status:** line atomically
    if sed -E "s/^\*\*Status:\*\*.*/\*\*Status:\*\* $new_status/" "$story_file" > "$tmp_file" 2>/dev/null; then
      # Verify the replacement actually happened
      if grep -q "^\*\*Status:\*\* $new_status" "$tmp_file"; then
        # Atomic move
        if mv "$tmp_file" "$story_file" 2>/dev/null; then
          echo "  Status: Updated $story_file to $new_status"
          return 0
        fi
      else
        rm -f "$tmp_file"
        echo "  Status: No **Status:** line found in $story_file"
        return 1
      fi
    fi

    rm -f "$tmp_file"

    if [ $attempt -lt $retries ]; then
      echo "  Status: Attempt $attempt failed — retrying in ${retry_delay}s"
      sleep "$retry_delay"
    fi
  done

  # All retries exhausted — create sentinel file
  echo "  Status: All $retries retries failed for $story_file" >&2

  # Extract story number from filename
  local story_num=$(basename "$story_file" | grep -oE '^story_[0-9]+' | grep -oE '[0-9]+')
  if [ -n "$story_num" ]; then
    local sentinel_dir="$REPO_ROOT/docs/stories/.needs_status_update"
    mkdir -p "$sentinel_dir"
    local sentinel_file="$sentinel_dir/story_$story_num"
    if echo "Failed to update $story_file to $new_status" > "$sentinel_file" 2>/dev/null; then
      echo "  Status: Sentinel file created at $sentinel_file" >&2
    fi
  fi

  return 1
}

# ── Parse Args ────────────────────────────────────────────────────────────────

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --agent)
      MANUAL_AGENT="$2"
      shift ;;
    --auto-select)
      AUTO_SELECT=true ;;
    --as)
      case $2 in
        bolt)     IDENTITY_HEADER="PERSONA OVERLAY: BOLT ⚡ — Performance Mode
Focus: Algorithmic efficiency, O(1) optimization, bundle size awareness.

" ;;
        palette)  IDENTITY_HEADER="PERSONA OVERLAY: PALETTE 🎨 — UX/DX Mode
Focus: Visual precision, phosphor adherence, interactive polish.

" ;;
        sentinel) IDENTITY_HEADER="PERSONA OVERLAY: SENTINEL 🛡️ — Security Mode
Focus: Hardening, secret detection, IPC surface minimization.

" ;;
        *)        echo "❌ Unknown persona '$2'. Use: bolt | palette | sentinel"; exit 1 ;;
      esac
      shift ;;
    --dry-run) DRY_RUN=true ;;
    --verbose) VERBOSE=true ;;
    --skip-validation) SKIP_VALIDATION=true ;; # Added this line
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
  echo "Usage: ./scripts/jules_assign.sh [--agent <name>] [--auto-select] [--as bolt|palette|sentinel] [--dry-run] [--skip-validation] <story.md>"
  exit 1
fi

if [ ! -f "$STORY_PATH" ]; then
  echo "❌ Story file not found: $STORY_PATH"
  exit 1
fi

# New validation step: Run scripts/story-validator.sh
if [ "$SKIP_VALIDATION" = false ]; then
  echo "Running story spec validation..."
  # The scripts/story-validator.sh needs to be executable.
  # Assuming it's executable for this step to run.
  bash "$REPO_ROOT/scripts/story-validator.sh" "$STORY_PATH"
  VALIDATION_EXIT_CODE=$?
  if [ "$VALIDATION_EXIT_CODE" -ne 0 ]; then
    echo ""
    echo "❌ [BLOCKED] Story validation failed — fix errors before dispatch."
    exit 1
  fi
  echo "✓ Story spec validation passed."
else
  echo "⚠️  Skipping story spec validation as --skip-validation was provided."
fi

# Extract story number early — needed for the already-implemented guard below
STORY_NUMBER=$(basename "$STORY_PATH" | grep -oE '^story_[0-9]+' | grep -oE '[0-9]+' || echo "???")
STORY_TITLE=$(grep -m1 "^# \(User \)\?Story" "$STORY_PATH" | sed 's/^# //')

# Original validation checks (can be removed later if story-validator.sh covers them)
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
  echo "   Review the story ACs, then promote it before dispatching."
  exit 1
fi
# End of original validation checks

# ── Already-implemented guard ─────────────────────────────────────────────────
# Abort if any commit on main already mentions this story number.
# Prevents re-dispatching work that's already on main.
EXISTING_COMMIT=$(git log origin/main --oneline --grep="feat(story-${STORY_NUMBER})" -i 2>/dev/null | head -1)
if [ -z "$EXISTING_COMMIT" ]; then
  # Broaden search: also catch feat: prefixes and direct feat commits
  EXISTING_COMMIT=$(git log origin/main --oneline --grep="feat.*story.${STORY_NUMBER}[^0-9]" -i 2>/dev/null | head -1)
fi
if [ -n "$EXISTING_COMMIT" ]; then
  echo ""
  echo "❌ DISPATCH BLOCKED — story ${STORY_NUMBER} already has an implementation commit on main:"
  echo "   $EXISTING_COMMIT"
  echo ""
  echo "   Mark the story COMPLETE and move on."
  exit 1
fi
echo "✓ No prior implementation commit found — safe to dispatch"

echo "✓ Story validated: $STORY_PATH" # This line might need to be adjusted/removed after full integration

# ── Check API key ─────────────────────────────────────────────────────────────

# shellcheck source=/dev/null
source ~/.secrets 2>/dev/null || true

if [ -z "${JULES_API_KEY:-}" ]; then
  echo "❌ JULES_API_KEY not set. Add it to ~/.secrets:"
  echo "   export JULES_API_KEY="your-key-here""
  echo "   Get keys at: https://jules.google.com/settings"
  exit 1
fi

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

# Read AGENTS.md (Jules reads this from repo root automatically, but including
# it inline ensures she sees it even if her session working dir differs)
AGENTS_CONTENT=""
if [ -f "$REPO_ROOT/AGENTS.md" ]; then
  AGENTS_CONTENT=$(cat "$REPO_ROOT/AGENTS.md")
fi

echo "📖 Building prompt for: $STORY_TITLE"

# ── Retrieve Episodes ──────────────────────────────────────────────────────────
echo "🔍 Retrieving relevant past episodes..."
EPISODES_JSON=$(python3 "$REPO_ROOT/scripts/retrieve_episodes.py" "$STORY_TITLE" --limit 3 2>/dev/null || echo "[]")

EPISODES_TEXT=""
if [ "$EPISODES_JSON" != "[]" ] && [ -n "$EPISODES_JSON" ]; then
  EPISODES_TEXT=$(python3 -c "
import sys, json
try:
    episodes = json.loads(sys.stdin.read())
    if episodes:
        print('## Relevant Past Episodes')
        for ep in episodes:
            story_id = ep.get('story_id', 'Unknown')
            outcome = ep.get('outcome', 'UNKNOWN')
            score = ep.get('quality_score', 0)
            reasons = ', '.join(ep.get('blocked_reasons', [])) or 'None'
            files = ', '.join(ep.get('files_touched', [])) or 'None'
            print(f'- Story {story_id}: Outcome={outcome}, Quality={score:.1f}')
            print(f'  Blocked Reasons: {reasons}')
            print(f'  Files Touched: {files}')
except Exception:
    pass
" <<< "$EPISODES_JSON")
fi

if [ -n "$EPISODES_TEXT" ]; then
  echo "✓ Found relevant past episodes to inject."
else
  echo "  No relevant past episodes found."
fi

# ── Select Agent ───────────────────────────────────────────────────────────────

RECOMMENDED_AGENT="jules"
if [ -n "$MANUAL_AGENT" ]; then
  RECOMMENDED_AGENT="$MANUAL_AGENT"
  echo "✓ Manual agent override: $RECOMMENDED_AGENT"
else
  echo "🔍 Agent Selector evaluating story characteristics..."
  SELECTOR_OUT=$(python3 "$REPO_ROOT/scripts/select_agent.py" "$STORY_PATH" 2>/dev/null || echo "{}")
  RECOMMENDED_AGENT=$(python3 -c "import sys, json; print(json.loads(sys.stdin.read()).get('recommended_agent', 'jules'))" <<< "$SELECTOR_OUT" 2>/dev/null || echo "jules")
  CONFIDENCE=$(python3 -c "import sys, json; print(json.loads(sys.stdin.read()).get('confidence', 0.0))" <<< "$SELECTOR_OUT" 2>/dev/null || echo "0.0")
  REASONING=$(python3 -c "import sys, json; print(json.loads(sys.stdin.read()).get('reasoning', ''))" <<< "$SELECTOR_OUT" 2>/dev/null || echo "")

  if [ "$RECOMMENDED_AGENT" != "jules" ]; then
    echo "💡 Agent Selector recommends: ${RECOMMENDED_AGENT^^} (confidence: ${CONFIDENCE})"
    echo "   Reason: $REASONING"

    if [ "$AUTO_SELECT" = false ]; then
      read -p "Proceed with $RECOMMENDED_AGENT instead of default jules? [Y/n] " -n 1 -r
      echo
      if [[ $REPLY =~ ^[Nn]$ ]]; then
        echo "Reverting to default agent: jules"
        RECOMMENDED_AGENT="jules"
      fi
    else
      echo "✓ Auto-select enabled. Using $RECOMMENDED_AGENT"
    fi
  else
    echo "✓ Agent Selector recommends: JULES (confidence: ${CONFIDENCE})"
  fi
fi

# ── Build Prompt ───────────────────────────────────────────────────────────────

TMPFILE=$(mktemp /tmp/jules-prompt.XXXXXX)
trap "rm -f '$TMPFILE'" EXIT

printf '%s
' "$IDENTITY_HEADER" >> "$TMPFILE"
printf '%s
' "$(printf '━%.0s' {1..54})" >> "$TMPFILE"
printf '%s
' "COPERNICUS IDE — STORY IMPLEMENTATION REQUEST" >> "$TMPFILE"
printf '%s
' "$(printf '━%.0s' {1..54})" >> "$TMPFILE"
printf '
%s

' "You are implementing a story for the COPERNICUS IDE project." >> "$TMPFILE"
printf '%s
' "READ THE AGENTS.MD AND STORY IN FULL BEFORE WRITING ANY CODE." >> "$TMPFILE"
printf '
%s
' "$(printf '━%.0s' {1..54})" >> "$TMPFILE"
printf '%s
' "AGENTS.MD — YOUR PRIMARY CONTRACT" >> "$TMPFILE"
printf '%s
' "$(printf '━%.0s' {1..54})" >> "$TMPFILE"
printf '%s
' "$AGENTS_CONTENT" >> "$TMPFILE"
printf '
%s
' "$(printf '━%.0s' {1..54})" >> "$TMPFILE"
printf '%s
' "STORY TO IMPLEMENT" >> "$TMPFILE"
printf '%s
' "$(printf '━%.0s' {1..54})" >> "$TMPFILE"
printf '%s
' "$STORY_CONTENT" >> "$TMPFILE"

if [ -n "$EPISODES_TEXT" ]; then
  printf '
%s
' "$(printf '━%.0s' {1..54})" >> "$TMPFILE"
  printf '%s
' "$EPISODES_TEXT" >> "$TMPFILE"
fi

printf '
%s
' "$(printf '━%.0s' {1..54})" >> "$TMPFILE"
printf '%s
' "YOUR DEFINITION OF DONE — COMPLETE ALL BEFORE SUBMITTING PR" >> "$TMPFILE"
printf '%s

' "$(printf '━%.0s' {1..54})" >> "$TMPFILE"
printf '%s
' "STEP 1 — Implement only the ACs in the story. Do not refactor unrelated code." >> "$TMPFILE"
printf '
%s
' "STEP 2 — Run this BEFORE committing anything:" >> "$TMPFILE"
printf '%s
' "  cd copernicus && npx tsc --noEmit" >> "$TMPFILE"
printf '%s
' "  If there are TypeScript errors: FIX THEM. Do not submit with TS errors." >> "$TMPFILE"
printf '
%s
' "STEP 3 — Check AGENTS.md Forbidden Patterns. For every new ipcMain.handle():" >> "$TMPFILE"
printf '%s
' "  - Is handleIpc() wrapping the body? -> if not, add it" >> "$TMPFILE"
printf '%s
' "  - Is the channel in preload.ts SEND_CHANNELS? -> if not, add it" >> "$TMPFILE"
printf '%s
' "  For every renderer IPC call:" >> "$TMPFILE"
printf '%s
' "  - Is useIpcError() used? -> if not, replace window.ipcRenderer.invoke" >> "$TMPFILE"
printf '%s
' "  - Is result.data accessed (not the whole result)? -> check after result.ok" >> "$TMPFILE"
printf '
%s
' "STEP 4 — Verify: cd copernicus && npx tsc --noEmit AGAIN after all changes." >> "$TMPFILE"
printf '%s
' "  Zero errors = ready. Any errors = do not submit." >> "$TMPFILE"
printf '
%s
' "STEP 5 — Commit message format:" >> "$TMPFILE"
printf '%s
' "  feat(story-${STORY_NUMBER}): <short description matching story title>" >> "$TMPFILE"
printf '
%s
' "Do NOT amend prior commits. Do NOT skip the tsc check." >> "$TMPFILE"
printf '%s
' "Do NOT change files outside the scope listed in the story's Key Files section." >> "$TMPFILE"

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

# Update story status to IN PROGRESS before dispatch
echo "📝 Updating story status..."
if ! update_story_status "$STORY_PATH" "IN PROGRESS"; then
  echo "⚠️  Status update failed but continuing with dispatch..."
fi

echo "🚀 Dispatching Story ${STORY_NUMBER} to Jules API..."

# Build JSON payload using python3 to safely handle special characters in prompt
PAYLOAD=$(python3 -c "
import json, sys
prompt = sys.stdin.read()
payload = {
    'prompt': prompt,
    'title': 'Story ${STORY_NUMBER}: ${STORY_TITLE}',
    'sourceContext': {
        'source': 'sources/github/JMThiessen/Copernicus',
        'githubRepoContext': {
            'startingBranch': 'main'
        }
    },
    'automationMode': 'AUTO_CREATE_PR',
    'requirePlanApproval': False
}
print(json.dumps(payload))
" <<< "$PROMPT")

RESPONSE=$(curl -s -X POST \
  'https://jules.googleapis.com/v1alpha/sessions' \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: ${JULES_API_KEY}" \
  -d "$PAYLOAD")

# Extract session ID
SESSION_ID=$(python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))" <<< "$RESPONSE" 2>/dev/null || echo "")

if [ -z "$SESSION_ID" ]; then
  echo "❌ Dispatch failed. API response:"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
  exit 1
fi

echo "✓ Dispatched — session ${SESSION_ID}"
echo "  https://jules.google.com/session/${SESSION_ID}"
echo "  PR will be auto-created on completion (AUTO_CREATE_PR mode)."

# ── Register session in jules.db ──────────────────────────────────────────────
python3 -c "
import sqlite3, datetime
from pathlib import Path
db_path = Path.home() / 'Library' / 'Application Support' / 'copernicus' / 'jules.db'
conn = sqlite3.connect(db_path)
conn.execute('''
    CREATE TABLE IF NOT EXISTS jules_sessions (
        session_id TEXT PRIMARY KEY, story INTEGER, title TEXT,
        state TEXT DEFAULT 'QUEUED', pr_url TEXT, pr_number INTEGER,
        commit_sha TEXT, branch TEXT, dispatched TEXT,
        plan_approved TEXT, pr_opened TEXT, merged TEXT, updated TEXT
    )
''')
conn.execute(
    'INSERT OR IGNORE INTO jules_sessions (session_id, story, title, state, dispatched, updated) VALUES (?,?,?,?,?,?)',
    ('${SESSION_ID}', '${STORY_NUMBER}', '''${STORY_TITLE}''', 'QUEUED',
     datetime.datetime.utcnow().isoformat()+'Z', datetime.datetime.utcnow().isoformat()+'Z')
)
conn.commit()
count = conn.execute('SELECT COUNT(*) FROM jules_sessions WHERE merged IS NULL').fetchone()[0]
print(f'  Registered in jules.db ({count} active session(s))')
conn.close()
"

# ── Start Jules daemon if not already running ─────────────────────────────────
DAEMON_PIDFILE="/tmp/jules_daemon.pid"
DAEMON_RUNNING=false
if [ -f "$DAEMON_PIDFILE" ]; then
  DAEMON_PID=$(cat "$DAEMON_PIDFILE")
  if kill -0 "$DAEMON_PID" 2>/dev/null; then
    DAEMON_RUNNING=true
  fi
fi

if [ "$DAEMON_RUNNING" = false ]; then
  echo "🔄 Starting Jules daemon (plan approval + PR review + auto-merge)..."
  nohup python3 "$REPO_ROOT/scripts/agent_monitor.py" \
    >> /tmp/jules_daemon.log 2>&1 &
  echo $! > "$DAEMON_PIDFILE"
  echo "  Daemon PID $(cat $DAEMON_PIDFILE) — logs at /tmp/jules_daemon.log"
else
  echo "  Jules daemon already running (PID $DAEMON_PID)"
fi
