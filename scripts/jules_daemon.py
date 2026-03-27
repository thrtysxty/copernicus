#!/usr/bin/env python3
"""
jules_daemon.py — Persistent Jules session monitor

Polls active Jules sessions, approves plans, and merges completed PRs.
Runs as a background daemon alongside the Copernicus app.

Usage:
    python3 scripts/jules_daemon.py                          # run (blocks)
    python3 scripts/jules_daemon.py --once                   # single poll cycle then exit
    python3 scripts/jules_daemon.py --status                 # show all sessions in db
    python3 scripts/jules_daemon.py --skip-review            # bypass PR review gate (emergency)
    python3 scripts/jules_daemon.py --retry-review <id>      # reset review_state for a session

DB:  ~/Library/Application Support/copernicus/jules.db
Log: /tmp/jules-daemon.log
"""

import argparse
import glob
import json
import logging
import os
import signal
import sqlite3
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────

DB_PATH = Path.home() / "Library" / "Application Support" / "copernicus" / "jules.db"
LOG_PATH = Path("/tmp/jules-daemon.log")
JULES_API = "https://jules.googleapis.com/v1alpha"
ANTHROPIC_API = "https://api.anthropic.com/v1"
ANTHROPIC_VERSION = "2023-06-01" # Required for Anthropic API
RETRY_REVIEW_AFTER = 3600 # seconds (1 hour) for re-reviewing BLOCKED/REQUEST_CHANGES sessions
POLL_INTERVAL = 30  # seconds between full cycles
GITHUB_REPO = "JMThiessen/Copernicus"

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_PATH),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("jules_daemon")

# ── DB ────────────────────────────────────────────────────────────────────────

def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS jules_sessions (
                session_id    TEXT PRIMARY KEY,
                story         INTEGER,
                title         TEXT,
                state         TEXT DEFAULT 'QUEUED',
                pr_url        TEXT,
                pr_number     INTEGER,
                commit_sha    TEXT,
                branch        TEXT,
                dispatched    TEXT,
                plan_approved TEXT,
                pr_opened     TEXT,
                merged        TEXT,
                updated       TEXT
            )
        """)
        # Add new columns with IF NOT EXISTS using try/except for SQLite
        try:
            conn.execute("ALTER TABLE jules_sessions ADD COLUMN review_state TEXT")
        except sqlite3.OperationalError:
            pass
        try:
            conn.execute("ALTER TABLE jules_sessions ADD COLUMN review_verdict TEXT")
        except sqlite3.OperationalError:
            pass
        try:
            conn.execute("ALTER TABLE jules_sessions ADD COLUMN reviewer TEXT")
        except sqlite3.OperationalError:
            pass
        try:
            conn.execute("ALTER TABLE jules_sessions ADD COLUMN reviewed TEXT")
        except sqlite3.OperationalError:
            pass
        conn.commit()
    log.info(f"DB ready at {DB_PATH}")


def get_active_sessions(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    """Sessions that haven't reached a terminal state."""
    return conn.execute("""
        SELECT * FROM jules_sessions
        WHERE merged IS NULL
          AND state NOT IN ('FAILED', 'CANCELLED')
        ORDER BY dispatched
    """).fetchall()

# ── API Keys ──────────────────────────────────────────────────────────────────

def jules_api_key() -> str:
    key = os.environ.get("JULES_API_KEY", "")
    if not key:
        # Try sourcing ~/.secrets
        result = subprocess.run(
            ["bash", "-c", "source ~/.secrets 2>/dev/null && echo $JULES_API_KEY"],
            capture_output=True, text=True
        )
        key = result.stdout.strip()
    if not key:
        raise RuntimeError("JULES_API_KEY not set — add it to ~/.secrets")
    return key

def anthropic_api_key() -> str:
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        # Try sourcing ~/.secrets
        result = subprocess.run(
            ["bash", "-c", "source ~/.secrets 2>/dev/null && echo $ANTHROPIC_API_KEY"],
            capture_output=True, text=True
        )
        key = result.stdout.strip()
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY not set — add it to ~/.secrets")
    return key


def curl_get(url: str, key: str) -> dict:
    result = subprocess.run(
        ["curl", "-s", url, "-H", f"x-goog-api-key: {key}"],
        capture_output=True, text=True, timeout=15
    )
    return json.loads(result.stdout)


def curl_post(url: str, key: str, body: dict | None = None) -> tuple[int, dict]:
    cmd = [
        "curl", "-s", "-w", "\n__HTTP_CODE__%{http_code}",
        "-X", "POST", url,
        "-H", f"x-goog-api-key: {key}",
        "-H", "Content-Type: application/json",
        "-d", json.dumps(body if body is not None else {}),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
    parts = result.stdout.rsplit("__HTTP_CODE__", 1)
    body_text = parts[0].strip()
    status = int(parts[1].strip()) if len(parts) > 1 else 0
    try:
        return status, json.loads(body_text) if body_text else {}
    except json.JSONDecodeError:
        return status, {}


def get_session(session_id: str, key: str) -> dict:
    return curl_get(f"{JULES_API}/sessions/{session_id}", key)


def get_plan(session_id: str, key: str) -> dict | None:
    data = curl_get(f"{JULES_API}/sessions/{session_id}/activities", jules_api_key())
    for activity in data.get("activities", []):
        if "planGenerated" in activity:
            return activity["planGenerated"]["plan"]
    return None


def approve_plan(session_id: str, key: str) -> bool:
    status, _ = curl_post(f"{JULES_API}/sessions/{session_id}:approvePlan", jules_api_key())
    return status == 200


def send_message(session_id: str, key: str, prompt: str) -> bool:
    status, _ = curl_post(f"{JULES_API}/sessions/{session_id}:sendMessage", key, {"prompt": prompt})
    return status == 200

# ── GitHub ────────────────────────────────────────────────────────────────────


GH = "/opt/homebrew/bin/gh"
GH_ENV = {**os.environ, "HOME": str(Path.home()), "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"}


def merge_pr(pr_number: int) -> tuple[bool, str]:
    # AUTO_CREATE_PR still creates drafts — mark ready first
    subprocess.run(
        [GH, "pr", "ready", str(pr_number), "--repo", GITHUB_REPO],
        capture_output=True, text=True, timeout=15, env=GH_ENV
    )
    result = subprocess.run(
        [GH, "pr", "merge", str(pr_number),
         "--repo", GITHUB_REPO, "--squash"],
        capture_output=True, text=True, timeout=30, env=GH_ENV
    )
    return result.returncode == 0, result.stderr.strip()


def get_pr_commit(pr_number: int) -> str | None:
    result = subprocess.run(
        [GH, "pr", "view", str(pr_number),
         "--repo", GITHUB_REPO, "--json", "mergeCommit",
         "--jq", ".mergeCommit.oid"],
        capture_output=True, text=True, timeout=15, env=GH_ENV
    )
    sha = result.stdout.strip()
    return sha if sha and sha != "null" else None

def review_pr(pr_number: int, story_id: int) -> dict:
    """
    Reviews a PR using the Anthropic API.
    Returns a dictionary with review verdict and details.
    """
    anthropic_key = anthropic_api_key()
    model = "claude-sonnet-4-6"
    reviewer_model = model # Store the actual model used

    # Default verdict structure for fallbacks
    default_verdict = {
        "verdict": "BLOCKED",
        "acs_met": [],
        "acs_missing": [],
        "summary": "Failed to get a valid review verdict from Claude.",
        "reviewer_model": reviewer_model,
        "reviewed_at": now_iso(),
        "merge_sha": "unknown"
    }

    # 1. Fetch diff
    log.info(f"  Fetching PR #{pr_number} diff...")
    result = subprocess.run(
        [GH, "pr", "diff", str(pr_number), "--repo", GITHUB_REPO],
        capture_output=True, text=True, timeout=30, env=GH_ENV
    )
    diff = result.stdout[:12000] # cap at 12K chars

    if result.returncode != 0:
        log.error(f"  Failed to fetch PR diff: {result.stderr}")
        default_verdict["summary"] = "Failed to fetch PR diff."
        return default_verdict

    # 2. Read story file
    story_content = "Story file not found."
    story_files = glob.glob(f"docs/stories/story_{story_id}_*.md")
    if story_files:
        try:
            with open(story_files[0], "r") as f:
                story_content = f.read()
        except Exception as e:
            log.error(f"  Failed to read story file {story_files[0]}: {e}")

    # 3. Read forbidden patterns from AGENTS.md
    forbidden_patterns = "Forbidden patterns section not found in AGENTS.md."
    try:
        with open("AGENTS.md", "r") as f:
            agents_md_content = f.read()
            # Extract content after "## Forbidden" header to EOF
            forbidden_start_index = agents_md_content.find("## Forbidden")
            if forbidden_start_index != -1:
                forbidden_patterns = agents_md_content[forbidden_start_index:].strip()
    except Exception as e:
        log.error(f"  Failed to read AGENTS.md or extract forbidden patterns: {e}")

    # 4. Construct the prompt
    prompt = f"""
You are a senior code reviewer. Review this PR diff against the story's Acceptance Criteria and the project's forbidden patterns.

STORY ACCEPTANCE CRITERIA:
{story_content}

FORBIDDEN PATTERNS (never allowed):
{forbidden_patterns}

PR DIFF:
{diff}

Respond with a JSON object only:
```json
{{
  "verdict": "APPROVED" | "BLOCKED" | "REQUEST_CHANGES",
  "acs_met": ["AC text or ID"],
  "acs_missing": ["AC text or ID"],
  "summary": "one-paragraph prose",
  "reviewer_model": "{reviewer_model}",
  "reviewed_at": "{now_iso()}",
  "merge_sha": "unknown"
}}
```
Make sure the JSON is properly formatted within the ```json block.
"""
    messages = [{"role": "user", "content": prompt}]
    headers = {
        "x-api-key": anthropic_key,
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "max_tokens": 2000, # A reasonable max_tokens for a review
        "messages": messages
    }

    # 5. Make the API call to Claude
    log.info("  Calling Claude for PR review...")
    try:
        # Using subprocess curl for direct HTTP POST, similar to curl_post for Jules API
        cmd = [
            "curl", "-s", "-w", "\\n__HTTP_CODE__%{http_code}",
            "-X", "POST", f"{ANTHROPIC_API}/messages",
        ]
        for header, value in headers.items():
            cmd.extend(["-H", f"{header}: {value}"])
        cmd.extend(["-d", json.dumps(payload)])

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60) # 60s timeout
        parts = result.stdout.rsplit("__HTTP_CODE__", 1)
        response_body_text = parts[0].strip()
        status_code = int(parts[1].strip()) if len(parts) > 1 else 0

        if status_code != 200:
            log.error(f"  Claude API error (status {status_code}): {response_body_text}")
            default_verdict["summary"] = f"Claude API error: {status_code}"
            return default_verdict

        # 6. Parse the response
        response_data = json.loads(response_body_text)
        
        # Claude 3.5 returns an array of content blocks, pick the first text block
        verdict_content = ""
        if 'content' in response_data and isinstance(response_data['content'], list):
            for block in response_data['content']:
                if block.get('type') == 'text':
                    verdict_content = block['text']
                    break

        if not verdict_content:
            log.error("  Claude API response missing text content.")
            default_verdict["summary"] = "Claude API response missing text content."
            return default_verdict

        # Extract JSON from markdown code block if present
        if verdict_content.strip().startswith("```json"):
            verdict_content = verdict_content.split("```json", 1)[1].split("```", 1)[0].strip()

        try:
            verdict_json = json.loads(verdict_content)
            # Merge with default to ensure all keys are present
            final_verdict = {**default_verdict, **verdict_json}
            # Ensure acs_met and acs_missing are lists
            final_verdict["acs_met"] = final_verdict.get("acs_met", [])
            final_verdict["acs_missing"] = final_verdict.get("acs_missing", [])
            return final_verdict
        except json.JSONDecodeError as e:
            log.error(f"  Failed to parse Claude API response JSON: {e}. Content: {verdict_content}")
            default_verdict["summary"] = f"Failed to parse Claude API response JSON: {e}. Raw content: {verdict_content}"
            return default_verdict

    except subprocess.TimeoutExpired:
        log.error("  Claude API call timed out after 60 seconds.")
        default_verdict["summary"] = "Claude API call timed out."
        return default_verdict
    except json.JSONDecodeError as e:
        log.error(f"  Failed to parse Claude API response JSON (outer): {e}")
        default_verdict["summary"] = f"Failed to parse Claude API response JSON (outer): {e}"
        return default_verdict
    except Exception as e:
        log.error(f"  An unexpected error occurred during Claude API call: {e}")
        default_verdict["summary"] = f"An unexpected error occurred during Claude API call: {e}"
        return default_verdict


# ── Poll cycle ────────────────────────────────────────────────────────────────

def write_verification_record(story_path: str, verdict: dict) -> None:
    """
    Reads the story file, appends (or replaces if '## Verification Record' already present)
    a verification block, and updates the Status line to COMPLETE.
    Performs an atomic write using a temporary file.
    """
    if not Path(story_path).is_file():
        log.warning(f"Verification record: Story file not found at {story_path}")
        return

    try:
        with open(story_path, "r") as f:
            lines = f.readlines()

        output_lines = []
        in_existing_verification_block = False
        status_line_found_and_updated = False

        # Find and skip existing verification record, and update status line
        i = 0
        while i < len(lines):
            line = lines[i]
            if line.strip() == "## Verification Record":
                in_existing_verification_block = True
                # Skip all lines until next top-level heading or EOF
                i += 1
                while i < len(lines) and not lines[i].startswith("## "):
                    i += 1
                continue
            
            if not status_line_found_and_updated and line.startswith("**Status:**"):
                output_lines.append("**Status:** COMPLETE\n")
                status_line_found_and_updated = True
            else:
                output_lines.append(line)
            i += 1
        
        # If status line was not found, append it at the end of the initial content if needed
        if not status_line_found_and_updated:
            pass # We'll append the new record, which will contain status as well if it's new.

        # Construct new verification record
        acs_met_str = "\n".join([f"- {ac}" for ac in verdict.get("acs_met", [])]) if verdict.get("acs_met") else ""
        acs_missing_str = "\n".join([f"- {ac}" for ac in verdict.get("acs_missing", [])]) if verdict.get("acs_missing") else "_(none)_"

        verification_record_block = f"""
## Verification Record

**Reviewed:** {verdict.get("reviewed_at")}
**Reviewer:** {verdict.get("reviewer_model")}
**Verdict:** {verdict.get("verdict")}
**Merge SHA:** `{verdict.get("merge_sha", "unknown")}` (full 40-char; `git show <sha>` to inspect)

### ACs Met
{acs_met_str}

### ACs Flagged
{acs_missing_str}

### Summary
{verdict.get("summary")}
"""
        # Append the new record at the end of the file
        output_lines.append(verification_record_block)

        # Atomic write
        tmp_path = Path(story_path).with_suffix(".md.tmp")
        with open(tmp_path, "w") as f:
            f.writelines(output_lines)
        os.replace(tmp_path, story_path)
        log.info(f"Verification record written to {story_path}")

    except Exception as e:
        log.error(f"Failed to write verification record to {story_path}: {e}")

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def process_session(row: sqlite3.Row, key: str, conn: sqlite3.Connection, skip_review: bool = False):
    session_id = row["session_id"]
    story = row["story"]

    try:
        data = get_session(session_id, key)
    except Exception as e:
        log.warning(f"Story {story}: fetch failed — {e}")
        return

    state = data.get("state", "UNKNOWN")
    outputs = data.get("outputs", [])

    # Extract PR info from outputs
    pr_url = None
    for o in outputs:
        if "pullRequest" in o:
            pr_url = o["pullRequest"].get("url")
            break

    pr_number = None
    if pr_url:
        try:
            pr_number = int(pr_url.rstrip("/").split("/")[-1])
        except ValueError:
            pass

    updated = now_iso()

    # Determine if there's a state change or if a completed PR needs review/merge
    is_completed_pr_ready = (state == "COMPLETED" and pr_url and not row["merged"])
    if state == row["state"] and not is_completed_pr_ready:
        # No change — just update timestamp
        conn.execute(
            "UPDATE jules_sessions SET updated=?, state=? WHERE session_id=?",
            (updated, state, session_id)
        )
        return

    log.info(f"Story {story} [{session_id[:12]}...] {row['state']} → {state}")

    if state == "AWAITING_PLAN_APPROVAL":
        plan = get_plan(session_id, key)
        if plan:
            steps = plan.get("steps", [])
            log.info(f"  Plan ({len(steps)} steps):")
            for s in steps:
                log.info(f"    {s.get('index', 0) + 1}. {s['title']}")

        ok = approve_plan(session_id, key)
        if ok:
            log.info(f"  ✓ Plan approved")
            conn.execute(
                "UPDATE jules_sessions SET state=?, plan_approved=?, updated=? WHERE session_id=?",
                (state, updated, updated, session_id)
            )
        else:
            log.warning(f"  ❌ Plan approval failed")
            conn.execute(
                "UPDATE jules_sessions SET state=?, updated=? WHERE session_id=?",
                (state, updated, session_id)
            )

    elif state == "AWAITING_USER_FEEDBACK":
        log.warning(f"  ⏸  Jules is waiting for user feedback — check dashboard: https://jules.google.com/session/{session_id}")
        conn.execute(
            "UPDATE jules_sessions SET state=?, updated=? WHERE session_id=?",
            (state, updated, session_id)
        )

    elif is_completed_pr_ready:
        log.info(f"  PR ready: {pr_url}")
        conn.execute(
            "UPDATE jules_sessions SET state=?, pr_url=?, pr_number=?, pr_opened=?, updated=? WHERE session_id=?",
            (state, pr_url, pr_number, updated, updated, session_id)
        )
        conn.commit()

        if pr_number:
            final_verdict = {
                "verdict": row["review_state"] or "PENDING",
                "acs_met": [],
                "acs_missing": [],
                "summary": "No review performed or decision made yet.",
                "reviewer_model": row["reviewer"] or "unknown",
                "reviewed_at": row["reviewed"] or now_iso(),
                "merge_sha": "unknown"
            }
            if skip_review:
                log.warning(f"  ⚠ SKIP-REVIEW flag active — merging PR #{pr_number} without review.")
                do_merge = True
            elif row["review_state"] == "APPROVED":
                log.info(f"  ✓ PR #{pr_number} already APPROVED. Proceeding to merge.")
                do_merge = True
            else:
                do_review = False
                if row["review_state"] is None or row["review_state"] == "FAILED":
                    do_review = True
                elif row["review_state"] in ("BLOCKED", "REQUEST_CHANGES"):
                    if row["reviewed"]:
                        last_reviewed_dt = datetime.fromisoformat(row["reviewed"].replace("Z", "+00:00"))
                        time_since_review = (datetime.now(timezone.utc) - last_reviewed_dt).total_seconds()
                        if time_since_review > RETRY_REVIEW_AFTER:
                            log.info(f"  PR #{pr_number} was {row['review_state']}, but {time_since_review:.0f}s passed. Retrying review.")
                            do_review = True
                        else:
                            log.info(f"  PR #{pr_number} {row['review_state']}. Skipping merge. Will re-review in {(RETRY_REVIEW_AFTER - time_since_review)/60:.0f} min.")
                    else:
                        # Should not happen for BLOCKED/REQUEST_CHANGES, but if reviewed is null, try reviewing
                        do_review = True

                if do_review:
                    final_verdict = review_pr(pr_number, story)
                    final_verdict_str = json.dumps(final_verdict)
                    
                    # Always update DB with the latest review outcome
                    conn.execute(
                        "UPDATE jules_sessions SET review_state=?, review_verdict=?, reviewer=?, reviewed=?, updated=? WHERE session_id=?",
                        (final_verdict["verdict"], final_verdict_str, final_verdict["reviewer_model"], final_verdict["reviewed_at"], now_iso(), session_id)
                    )
                    conn.commit()

                    if final_verdict["verdict"] == "APPROVED":
                        log.info(f"  ✓ Review APPROVED — {final_verdict['summary']}")
                        do_merge = True
                    else:
                        do_merge = False
                        log.warning(f"  ❌ Review {final_verdict['verdict']} — {final_verdict['summary']}")
                        if final_verdict.get("issues"):
                            for issue in final_verdict["issues"]:
                                log.warning(f"   • {issue}")
                        if final_verdict.get("acs_missing"):
                            for ac in final_verdict["acs_missing"]:
                                log.warning(f"   • AC not met: {ac}")
                else:
                    do_merge = False # Not approved, not retrying

            if do_merge:
                ok, err = merge_pr(pr_number)
                if ok:
                    # Populate merge_sha and write verification record
                    merge_sha = get_pr_commit(pr_number)
                    final_verdict["merge_sha"] = merge_sha if merge_sha else "unknown"

                    story_paths = glob.glob(f"docs/stories/story_{story}_*.md")
                    if story_paths:
                        write_verification_record(story_paths[0], final_verdict)
                    else:
                        log.warning(f"  ❌ Story file for story {story} not found. Cannot write verification record.")

                    log.info(f"  ✓ Merged PR #{pr_number}" + (f" ({final_verdict['merge_sha'][:8]})" if final_verdict['merge_sha'] else ""))
                    conn.execute(
                        "UPDATE jules_sessions SET merged=?, commit_sha=?, updated=? WHERE session_id=?",
                        (now_iso(), final_verdict["merge_sha"], now_iso(), session_id)
                    )
                else:
                    log.warning(f"  ❌ Merge failed: {err}")

    elif state in ("FAILED", "CANCELLED"):
        log.warning(f"  Terminal state: {state}")
        conn.execute(
            "UPDATE jules_sessions SET state=?, updated=? WHERE session_id=?",
            (state, updated, session_id)
        )

    else:
        conn.execute(
            "UPDATE jules_sessions SET state=?, pr_url=?, pr_number=?, updated=? WHERE session_id=?",
            (state, pr_url, pr_number, updated, session_id)
        )


def poll_cycle(skip_review: bool = False):
    key = jules_api_key()
    with get_db() as conn:
        sessions = get_active_sessions(conn)
        if not sessions:
            return
        log.info(f"Polling {len(sessions)} active session(s)...")
        for row in sessions:
            process_session(row, key, conn, skip_review)
        conn.commit()

# ── Status display ────────────────────────────────────────────────────────────

def show_status():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM jules_sessions ORDER BY dispatched DESC LIMIT 50"
        ).fetchall()
    if not rows:
        print("No sessions in db.")
        return
    print(f"{'STORY':<8} {'STATE':<22} {'REVIEW':<14} {'PR':<8} {'SHA':<10} {'TITLE'}")
    print("-" * 90) # Adjusted separator length
    for r in rows:
        sha = (r["commit_sha"] or "")[:8]
        pr = f"#{r['pr_number']}" if r["pr_number"] else ""
        review_state = (r["review_state"] or "—")
        if review_state == "REQUEST_CHANGES":
            review_state = "REQ_CHANGES" # Abbreviate for display
        print(f"{str(r['story']):<8} {(r['state'] or ''):<22} {review_state:<14} {pr:<8} {sha:<10} {r['title'] or ''}")

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Jules session monitor daemon.")
    parser.add_argument("--once", action="store_true", help="Run a single poll cycle then exit.")
    parser.add_argument("--status", action="store_true", help="Show all sessions in db.")
    parser.add_argument("--skip-review", action="store_true", help="Bypass PR review and merge directly (emergency use).")
    parser.add_argument("--retry-review", type=str, metavar="SESSION_ID", help="Reset review state for a session to force re-review.")
    args = parser.parse_args()

    init_db()

    if args.status:
        show_status()
        return

    if args.retry_review:
        session_id_to_retry = args.retry_review
        with get_db() as conn:
            conn.execute(
                "UPDATE jules_sessions SET review_state=NULL, reviewed=NULL WHERE session_id=?",
                (session_id_to_retry,)
            )
            conn.commit()
        log.info(f"Review state for session {session_id_to_retry} reset to NULL. It will be re-reviewed on next poll.")
        return

    if args.skip_review:
        log.warning("⚠ SKIP-REVIEW flag active — PRs will be merged without review.")

    if args.once:
        poll_cycle(skip_review=args.skip_review)
        return

    log.info(f"Jules daemon starting — polling every {POLL_INTERVAL}s")
    log.info(f"DB: {DB_PATH}")
    log.info(f"Log: {LOG_PATH}")

    # Graceful shutdown
    running = True
    def _stop(_sig, _frame):
        nonlocal running
        log.info("Shutting down...")
        running = False
    signal.signal(signal.SIGTERM, _stop)
    signal.signal(signal.SIGINT, _stop)

    while running:
        try:
            poll_cycle(skip_review=args.skip_review)
        except Exception as e:
            log.error(f"Poll cycle error: {e}")
        for _ in range(POLL_INTERVAL):
            if not running:
                break
            time.sleep(1)

    log.info("Daemon stopped.")


if __name__ == "__main__":
    main()
