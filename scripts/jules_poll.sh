#!/bin/bash
# jules_poll.sh — Poll active Jules sessions, approve plans, merge completed PRs
#
# Usage:
#   ./scripts/jules_poll.sh              # poll all tracked sessions
#   ./scripts/jules_poll.sh --approve    # auto-approve all pending plans
#   ./scripts/jules_poll.sh --merge      # auto-merge all completed PRs
#   ./scripts/jules_poll.sh --approve --merge  # full automation
#
# Session registry: scripts/.jules-sessions.json
# Format: [{"sessionId":"...","story":"NNN","title":"...","dispatched":"ISO"}]

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGISTRY="$REPO_ROOT/scripts/.jules-sessions.json"
JULES_API="https://jules.googleapis.com/v1alpha"
AUTO_APPROVE=false
AUTO_MERGE=false

# ── Parse Args ────────────────────────────────────────────────────────────────
for arg in "$@"; do
  case $arg in
    --approve) AUTO_APPROVE=true ;;
    --merge)   AUTO_MERGE=true ;;
    *) echo "❌ Unknown flag: $arg"; exit 1 ;;
  esac
done

# ── Load API key ──────────────────────────────────────────────────────────────
source ~/.secrets 2>/dev/null || true
if [ -z "${JULES_API_KEY:-}" ]; then
  echo "❌ JULES_API_KEY not set in ~/.secrets"
  exit 1
fi

# ── Load registry ─────────────────────────────────────────────────────────────
if [ ! -f "$REGISTRY" ]; then
  echo "⚠️  No session registry found at $REGISTRY"
  echo "   Sessions are registered automatically when you dispatch via jules_assign.sh"
  exit 0
fi

SESSIONS=$(python3 -c "import json; print(json.dumps(json.load(open('$REGISTRY'))))")
COUNT=$(python3 -c "import json; print(len(json.loads('$SESSIONS'.replace(\"'\",\"'\"))))" 2>/dev/null || echo 0)

if [ "$COUNT" -eq 0 ]; then
  echo "✓ No active sessions in registry."
  exit 0
fi

echo "Polling $COUNT session(s)..."
echo ""

COMPLETED=()

python3 << PYEOF
import json, subprocess, sys, os

registry_path = "$REGISTRY"
api_base = "$JULES_API"
api_key = os.environ.get("JULES_API_KEY", "")
auto_approve = "$AUTO_APPROVE" == "true"
auto_merge = "$AUTO_MERGE" == "true"

sessions = json.load(open(registry_path))
remaining = []

for entry in sessions:
    session_id = entry["sessionId"]
    story = entry.get("story", "?")
    title = entry.get("title", "?")

    # Get session state
    result = subprocess.run(
        ["curl", "-s",
         f"{api_base}/sessions/{session_id}",
         "-H", f"x-goog-api-key: {api_key}"],
        capture_output=True, text=True
    )
    try:
        data = json.loads(result.stdout)
    except Exception:
        print(f"  ⚠️  Story {story}: could not parse response")
        remaining.append(entry)
        continue

    state = data.get("state", "UNKNOWN")
    outputs = data.get("outputs", [])
    pr_url = None
    for o in outputs:
        if "pullRequest" in o:
            pr_url = o["pullRequest"].get("url")
            break

    print(f"  Story {story} [{session_id[:16]}...]  state={state}")

    if state == "AWAITING_PLAN_APPROVAL":
        # Fetch plan steps
        acts_result = subprocess.run(
            ["curl", "-s",
             f"{api_base}/sessions/{session_id}/activities",
             "-H", f"x-goog-api-key: {api_key}"],
            capture_output=True, text=True
        )
        try:
            acts = json.loads(acts_result.stdout).get("activities", [])
            for a in acts:
                if "planGenerated" in a:
                    steps = a["planGenerated"]["plan"].get("steps", [])
                    print(f"    Plan ({len(steps)} steps):")
                    for s in steps:
                        print(f"      {s.get('index',0)+1}. {s['title']}")
                    break
        except Exception:
            pass

        if auto_approve:
            approve = subprocess.run(
                ["curl", "-s", "-w", "\nHTTP %{http_code}", "-X", "POST",
                 f"{api_base}/sessions/{session_id}:approvePlan",
                 "-H", f"x-goog-api-key: {api_key}",
                 "-H", "Content-Type: application/json",
                 "-d", "{}"],
                capture_output=True, text=True
            )
            if "HTTP 200" in approve.stdout:
                print(f"    ✓ Plan approved")
            else:
                print(f"    ❌ Approve failed: {approve.stdout[-100:]}")
        else:
            print(f"    ↳ Run with --approve to approve, or review at:")
            print(f"      https://jules.google.com/session/{session_id}")

        remaining.append(entry)

    elif state == "COMPLETED" and pr_url:
        print(f"    PR: {pr_url}")
        if auto_merge:
            # Extract PR number from URL
            pr_num = pr_url.rstrip("/").split("/")[-1]
            merge = subprocess.run(
                ["gh", "pr", "merge", pr_num,
                 "--repo", "JMThiessen/Copernicus", "--squash"],
                capture_output=True, text=True
            )
            if merge.returncode == 0:
                print(f"    ✓ Merged PR #{pr_num}")
            else:
                print(f"    ❌ Merge failed: {merge.stderr[:200]}")
                remaining.append(entry)
        else:
            print(f"    ↳ Run with --merge to auto-merge")
            remaining.append(entry)

    elif state in ("COMPLETED", "FAILED", "CANCELLED"):
        print(f"    ↳ Terminal state — removing from registry")
        # Don't add to remaining

    else:
        # IN_PROGRESS, QUEUED, etc — keep tracking
        remaining.append(entry)

# Write back remaining sessions
json.dump(remaining, open(registry_path, "w"), indent=2)
removed = len(sessions) - len(remaining)
if removed:
    print(f"\n  Removed {removed} completed session(s) from registry.")
print(f"\nDone. {len(remaining)} session(s) still active.")
PYEOF
