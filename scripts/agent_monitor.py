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
import re
from typing import Literal

import ollama
from pydantic import BaseModel


class ReviewVerdict(BaseModel):
    verdict: Literal["APPROVED", "BLOCKED", "REQUEST_CHANGES"]
    acs_met: list[str]
    acs_missing: list[str]
    summary: str
    reviewer_model: str
    reviewed_at: str
    merge_sha: str

# ── Config ────────────────────────────────────────────────────────────────────

DB_PATH = Path.home() / "Library" / "Application Support" / "copernicus" / "jules.db"
LOG_PATH = Path("/tmp/jules-daemon.log")
JULES_API = "https://jules.googleapis.com/v1alpha"
RETRY_REVIEW_AFTER = 3600 # seconds (1 hour) for re-reviewing BLOCKED/REQUEST_CHANGES sessions
POLL_INTERVAL = 30  # seconds between full cycles
GITHUB_REPO = "JMThiessen/Copernicus"

GEMINI_LOG_DIR = Path("/tmp")
GEMINI_LOG_PATTERN = re.compile(r"gemini_(\d+)\.log")
GEMINI_COMPLETION_MARKERS = (
    "I have completed",
    "All acceptance criteria",
    "feat(story-",
    "fix(story-",
    "[[DONE]]",
)
GEMINI_INACTIVITY_TIMEOUT_SECONDS = 60
GEMINI_MIN_LINES_FOR_INACTIVITY = 20

REVIEW_PROVIDER = os.environ.get("REVIEW_PROVIDER", "openrouter")  # "ollama" | "openrouter"
OPENROUTER_API = "https://openrouter.ai/api/v1"
# Good reviewer choices (cost-effective, large context, strong reasoning):
# FREE tier (use while available):
#   qwen/qwen3.6-plus-preview:free       — FREE preview
#   nvidia/nemotron-3-super-120b-a12b:free — FREE, 120B, Nvidia supervised
#   minimax/minimax-m2.5:free            — FREE tier, rate-limited
# Paid:
#   qwen/qwen3-235b-a22b-instruct-2507   — $0.071 in / $0.10 out, 262k ctx
#   mistralai/mistral-small-3.2-24b-instruct — $0.09 in / $0.25 out, 256k ctx
#   mistralai/devstral-2512              — $0.40 in / $2.00 out, 262k ctx, agentic coder
#   minimax/minimax-m2.5                 — $0.90 in / $3.60 out, strong structured output
REVIEW_MODEL_OPENROUTER = os.environ.get("REVIEW_MODEL_OPENROUTER", "mistralai/devstral-small")

# Dictionary to store last known state of Gemini log files for inactivity detection
_gemini_log_states = {}

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
        try:
            conn.execute("ALTER TABLE jules_sessions ADD COLUMN agent TEXT")
            conn.execute("UPDATE jules_sessions SET agent = 'jules' WHERE agent IS NULL")
        except sqlite3.OperationalError:
            pass

        # Episodes table (Story 573)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS episodes (
                episode_id     TEXT PRIMARY KEY,
                timestamp      TEXT NOT NULL,
                story_id       TEXT REFERENCES stories(id),
                agent          TEXT NOT NULL DEFAULT 'jules',
                task           TEXT NOT NULL DEFAULT '',
                approach       TEXT NOT NULL DEFAULT '',
                outcome        TEXT NOT NULL DEFAULT '',
                duration_ms    INTEGER DEFAULT 0,
                quality_score  REAL NOT NULL DEFAULT 0.0,
                revision_count INTEGER NOT NULL DEFAULT 0,
                blocked_reasons TEXT NOT NULL DEFAULT '[]',
                files_touched  TEXT NOT NULL DEFAULT '[]',
                memory_ids     TEXT NOT NULL DEFAULT '[]',
                notes          TEXT NOT NULL DEFAULT '',
                commit_sha     TEXT DEFAULT NULL,
                embedding_id   TEXT DEFAULT NULL
            )
        """)
        try:
            conn.execute("""
                CREATE VIRTUAL TABLE IF NOT EXISTS episodes_vec USING vec0(
                    embedding FLOAT[1536]
                )
            """)
        except sqlite3.OperationalError:
            pass  # sqlite-vec may not be loaded

        conn.commit()
    log.info(f"DB ready at {DB_PATH}")


# ── Episode Writing (Story 573) ────────────────────────────────────────────────

_QUALITY_SCORE_MAP = {0: 1.0, 1: 0.7, 2: 0.4}


def _write_episode(session_id: str, conn: sqlite3.Connection) -> None:
    """Write an episode record after successful story completion. Retries 3×."""
    row = conn.execute(
        "SELECT * FROM jules_sessions WHERE session_id = ?", (session_id,)
    ).fetchone()
    if not row:
        log.warning(f"[episode] session {session_id} not found — skipping")
        return

    verdict_data = json.loads(row["review_verdict"]) if row["review_verdict"] else {}
    revision_count = row.get("revision_count") or 0
    quality_score = _QUALITY_SCORE_MAP.get(int(revision_count), 0.2)
    blocked_reasons = verdict_data.get("acs_missing", [])
    episode_id = f"ep_{datetime.now().strftime('%Y%m%d')}_{session_id[:8]}"
    embed_text = " ".join(filter(None, [
        row["title"] or "",
        row.get("agent", "jules"),
        verdict_data.get("summary", ""),
        " ".join(blocked_reasons),
    ]))

    embedding: list | None = None
    try:
        import openai as _openai  # noqa: PLC0415
        emb_client = _openai.OpenAI(
            api_key=openrouter_api_key(),
            base_url="https://openrouter.ai/api/v1"
        )
        emb_resp = emb_client.embeddings.create(model="text-embedding-3-small", input=embed_text)
        embedding = emb_resp.data[0].embedding
    except Exception as e:
        log.warning(f"[episode] embedding failed for {episode_id}: {e}")

    for attempt in range(1, 4):
        try:
            with conn:
                conn.execute(
                    """INSERT INTO episodes
                       (episode_id, timestamp, story_id, agent, task, approach,
                        outcome, quality_score, revision_count, blocked_reasons,
                        files_touched, memory_ids, notes, commit_sha)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (
                        episode_id,
                        datetime.now(timezone.utc).isoformat(),
                        str(row["story"]),
                        row.get("agent", "jules"),
                        row["title"] or "",
                        row.get("agent", "jules"),
                        verdict_data.get("verdict", "UNKNOWN"),
                        quality_score,
                        revision_count,
                        json.dumps(blocked_reasons),
                        "[]",
                        "[]",
                        verdict_data.get("summary", ""),
                        row["commit_sha"],
                    ),
                )
                if embedding:
                    conn.execute(
                        "INSERT INTO episodes_vec (embedding) VALUES (?)",
                        (json.dumps(embedding),),
                    )
                    rowid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
                    conn.execute(
                        "UPDATE episodes SET embedding_id = ? WHERE episode_id = ?",
                        (rowid, episode_id),
                    )
            log.info(f"[episode] wrote {episode_id} (quality={quality_score})")
            return
        except Exception as exc:
            wait = 5 * attempt
            if attempt < 3:
                log.warning(f"[episode] write attempt {attempt} failed: {exc} — retry in {wait}s")
                time.sleep(wait)
            else:
                log.error(f"[episode] all retries exhausted for {episode_id}: {exc}")
                try:
                    conn.execute(
                        "INSERT INTO agent_work_log (id, project_id, bank_id, event_type, meta, ts) VALUES (?,?,?,?,?,?)",
                        (f"epfail_{episode_id}", "copernicus", "jules", "episode_write_failed",
                         json.dumps({"error": str(exc), "session_id": session_id}), int(time.time())),
                    )
                    conn.commit()
                except Exception:
                    pass


def show_episodes() -> None:
    """Print last 20 episodes sorted by timestamp DESC."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT episode_id, story_id, outcome, quality_score, timestamp FROM episodes ORDER BY timestamp DESC LIMIT 20"
        ).fetchall()
    if not rows:
        print("No episodes recorded yet.")
        return
    print(f"{'Episode':<28} {'Story':<12} {'Outcome':<20} {'Q':>5}  {'Timestamp'}")
    print("-" * 80)
    for r in rows:
        print(f"{r['episode_id']:<28} {str(r['story_id']):<12} {r['outcome']:<20} {r['quality_score']:>5.1f}  {r['timestamp'][:19]}")


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


def openrouter_api_key() -> str:
    key = os.environ.get("OPENROUTER_API_KEY", "")
    if not key:
        result = subprocess.run(
            ["bash", "-c", "source ~/.secrets 2>/dev/null && echo $OPENROUTER_API_KEY"],
            capture_output=True, text=True
        )
        key = result.stdout.strip()
    if not key:
        raise RuntimeError("OPENROUTER_API_KEY not set — add it to ~/.secrets")
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


def get_plan(session_id: str) -> dict | None:
    data = curl_get(f"{JULES_API}/sessions/{session_id}/activities", jules_api_key())
    for activity in data.get("activities", []):
        if "planGenerated" in activity:
            return activity["planGenerated"]["plan"]
    return None


def approve_plan(session_id: str) -> bool:
    status, _ = curl_post(f"{JULES_API}/sessions/{session_id}:approvePlan", jules_api_key())
    return status == 200


def send_message(session_id: str, key: str, prompt: str) -> bool:
    status, _ = curl_post(f"{JULES_API}/sessions/{session_id}:sendMessage", key, {"prompt": prompt})
    return status == 200

# ── GitHub ────────────────────────────────────────────────────────────────────


GH = "/opt/homebrew/bin/gh"
GH_ENV = {k: v for k, v in os.environ.items() if k != "GITHUB_TOKEN"}
GH_ENV.update({"HOME": str(Path.home()), "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"})


def get_pr_state(pr_number: int) -> str:
    """Return 'OPEN', 'CLOSED', or 'MERGED'. Returns 'OPEN' on error to avoid false skips."""
    try:
        result = subprocess.run(
            [GH, "pr", "view", str(pr_number), "--repo", GITHUB_REPO, "--json", "state"],
            capture_output=True, text=True, timeout=15, env=GH_ENV
        )
        if result.returncode == 0:
            return json.loads(result.stdout).get("state", "OPEN").upper()
    except Exception:
        pass
    return "OPEN"


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
    Reviews a PR using Ollama structured output.
    Returns a dictionary with review verdict and details.
    """
    model = "deepseek-v3.1:671b-cloud"

    # Default verdict structure for fallbacks
    default_verdict = {
        "verdict": "BLOCKED",
        "acs_met": [],
        "acs_missing": [],
        "summary": "Failed to get a valid review verdict from Ollama.",
        "reviewer_model": model,
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
    story_path_result = subprocess.run(
        ["python3", "scripts/story.py", "path", str(story_id)],
        capture_output=True, text=True
    )
    if story_path_result.returncode == 0:
        story_file = story_path_result.stdout.strip()
        try:
            with open(story_file, "r") as f:
                story_content = f.read()
        except Exception as e:
            log.error(f"  Failed to read story file {story_file}: {e}")

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

REVIEW SCOPE RULES (apply these before evaluating):
1. Evaluate whether the code changes correctly implement each AC — not whether runtime evidence was produced. The implementer is a headless agent that cannot run the app or produce log output. Do NOT require screenshots, log samples, test run output, or benchmark results.
2. AC ordering in a story describes logical sequence within the implementation, not a requirement for separate commits or PRs. A single PR that implements AC1 + AC2 together is acceptable as long as both are correctly implemented in the code.
3. Correction Notes in the story describe what was wrong in a previous PR. They guide what the implementer should fix — they are not additional ACs. Do not add new blocking requirements based on Correction Note wording unless they map to a stated AC.
4. Only block on issues that are verifiable from the diff itself: missing code, wrong logic, forbidden patterns, TypeScript errors, IPC violations. Do not block on hypothetical runtime behavior or missing evidence the agent cannot provide.
5. Do NOT request Playwright test runs, E2E test execution, browser automation, or any script execution from Jules. Jules is a headless code-writing agent — it cannot run interactive applications, start servers, or execute test frameworks. Any verdict that requires Jules to run Playwright or any other runtime test is invalid.

STORY ACCEPTANCE CRITERIA:
{story_content}

FORBIDDEN PATTERNS (never allowed):
{forbidden_patterns}

PR DIFF:
{diff}
"""

    # 5. Make the API call — branch on REVIEW_PROVIDER
    if REVIEW_PROVIDER == "openrouter":
        log.info("  Calling OpenRouter for PR review...")
        try:
            import openai  # noqa: PLC0415
            or_client = openai.OpenAI(api_key=openrouter_api_key(), base_url=OPENROUTER_API)
            or_response = or_client.chat.completions.create(
                model=REVIEW_MODEL_OPENROUTER,
                messages=[{"role": "user", "content": prompt}],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "ReviewVerdict",
                        "strict": True,
                        "schema": ReviewVerdict.model_json_schema(),
                    },
                },
                extra_body={"structured_outputs": True, "verbosity": "low"},
                temperature=0,
            )
            verdict = ReviewVerdict.model_validate_json(or_response.choices[0].message.content or "")
            return {
                **verdict.model_dump(),
                "reviewer_model": REVIEW_MODEL_OPENROUTER,
                "reviewed_at": now_iso(),
                "merge_sha": "unknown",
            }
        except Exception as e:
            log.error(f"  OpenRouter PR review error: {e}")
            default_verdict["summary"] = f"OpenRouter PR review error: {e}"
            default_verdict["reviewer_model"] = REVIEW_MODEL_OPENROUTER
            return default_verdict
    else:
        log.info("  Calling Ollama for PR review...")
        try:
            response = ollama.chat(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                format=ReviewVerdict.model_json_schema(),
                options={"temperature": 0},
            )
            verdict = ReviewVerdict.model_validate_json(response.message.content or "")
            return {
                **verdict.model_dump(),
                "reviewer_model": model,
                "reviewed_at": now_iso(),
                "merge_sha": "unknown",
            }
        except Exception as e:
            log.error(f"  Ollama PR review error: {e}")
            default_verdict["summary"] = f"Ollama PR review error: {e}"
            return default_verdict


# ── Poll cycle ────────────────────────────────────────────────────────────────

def write_status(story_path: str, new_status: str, retries: int = 3, retry_delay: int = 2) -> bool:
    """
    Atomically updates the **Status:** line in a story file.

    Args:
        story_path: Path to the story markdown file
        new_status: New status value (e.g. "COMPLETE", "IN PROGRESS")
        retries: Number of retry attempts on failure (default 3)
        retry_delay: Delay in seconds between retries (default 2)

    Returns:
        True if successful, False otherwise

    On unrecoverable failure, creates a sentinel file at
    docs/stories/.needs_status_update/story_{NNN} for manual recovery.
    """
    if not Path(story_path).is_file():
        log.warning(f"write_status: Story file not found at {story_path}")
        return False

    # Skip if story is already in completed folder
    if "completed" in str(story_path):
        log.info(f"write_status: Story {story_path} already archived — skipping")
        return True

    attempt = 0
    last_error = None

    while attempt < retries:
        try:
            with open(story_path, "r") as f:
                content = f.read()

            # Update status line (regex to match **Status:** followed by anything on that line)
            import re as regex_module
            updated_content = regex_module.sub(
                r"^\*\*Status:\*\*.*$",
                f"**Status:** {new_status}",
                content,
                count=1,
                flags=regex_module.MULTILINE
            )

            if updated_content == content:
                log.warning(f"write_status: No **Status:** line found in {story_path}")
                return False

            # Atomic write with temp file
            tmp_path = Path(story_path).with_suffix(".md.tmp")
            with open(tmp_path, "w") as f:
                f.write(updated_content)
            os.replace(tmp_path, story_path)

            log.info(f"write_status: Updated {story_path} to {new_status}")
            return True

        except Exception as e:
            last_error = e
            attempt += 1
            if attempt < retries:
                log.warning(f"write_status: Attempt {attempt} failed: {e} — retrying in {retry_delay}s")
                time.sleep(retry_delay)

    # All retries exhausted — create sentinel file for manual recovery
    log.error(f"write_status: All {retries} retries failed for {story_path}: {last_error}")

    # Extract story number from path
    match = re.search(r"story_(\d+)", str(story_path))
    if match:
        story_num = match.group(1)
        sentinel_dir = Path("docs/stories/.needs_status_update")
        sentinel_dir.mkdir(parents=True, exist_ok=True)
        sentinel_file = sentinel_dir / f"story_{story_num}"
        try:
            sentinel_file.write_text(
                f"Failed to update {story_path} to {new_status}\nLast error: {last_error}\n"
            )
            log.error(f"write_status: Sentinel file created at {sentinel_file}")
        except Exception as e:
            log.error(f"write_status: Failed to create sentinel file: {e}")

    return False


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
        status_line_found_and_updated = False

        # Find and skip existing verification record, and update status line
        i = 0
        while i < len(lines):
            line = lines[i]
            if line.strip() == "## Verification Record":
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


def stamp_story_id(story_id: str, started_at: str, completed_at: str) -> None:
    """Stamp story_id on agent_memory and agent_work_log rows within the session window."""
    copernicus_db = Path.home() / "Library" / "Application Support" / "COPERNICUS" / "copernicus.db"
    if not copernicus_db.exists():
        log.debug(f"copernicus.db not found at {copernicus_db} — skipping story_id stamp")
        return
    try:
        with sqlite3.connect(copernicus_db) as conn:
            conn.execute(
                "UPDATE agent_memory SET story_id = ? WHERE story_id IS NULL AND ts >= ? AND ts <= ?",
                (story_id, started_at, completed_at),
            )
            conn.execute(
                "UPDATE agent_work_log SET story_id = ? WHERE story_id IS NULL AND ts >= ? AND ts <= ?",
                (story_id, started_at, completed_at),
            )
            conn.commit()
        log.info(f"  Stamped story_id={story_id} on agent_memory/agent_work_log rows in [{started_at}, {completed_at}]")
    except Exception as e:
        log.warning(f"  stamp_story_id failed (non-fatal): {e}")


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
        plan = get_plan(session_id)
        if plan:
            steps = plan.get("steps", [])
            log.info(f"  Plan ({len(steps)} steps):")
            for s in steps:
                log.info(f"    {s.get('index', 0) + 1}. {s['title']}")

        ok = approve_plan(session_id)
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
                    pr_state = get_pr_state(pr_number)
                    if pr_state in ("CLOSED", "MERGED"):
                        log.info(f"  PR #{pr_number} is {pr_state} on GitHub — marking finished, skipping re-review.")
                        conn.execute(
                            "UPDATE jules_sessions SET merged=? WHERE session_id=?",
                            (pr_state, session_id)
                        )
                        conn.commit()
                        _write_episode(session_id, conn)
                    elif row["reviewed"]:
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

                    story_path_result = subprocess.run(
                        ["python3", "scripts/story.py", "path", str(story)],
                        capture_output=True, text=True
                    )
                    if story_path_result.returncode == 0:
                        story_path = story_path_result.stdout.strip()
                        write_verification_record(story_path, final_verdict)
                        # Update status to COMPLETE
                        write_status(story_path, "COMPLETE")
                    else:
                        log.warning(f"  ❌ Story file for story {story} not found. Cannot write verification record.")

                    log.info(f"  ✓ Merged PR #{pr_number}" + (f" ({final_verdict['merge_sha'][:8]})" if final_verdict['merge_sha'] else ""))
                    merge_ts = now_iso()
                    conn.execute(
                        "UPDATE jules_sessions SET merged=?, commit_sha=?, updated=? WHERE session_id=?",
                        (merge_ts, final_verdict["merge_sha"], merge_ts, session_id)
                    )
                    stamp_story_id(str(story), row["dispatched"], merge_ts)
                    _write_episode(session_id, conn)
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

def review_gemini_session(session_id: str, story_id: int, log_file_path: Path, conn: sqlite3.Connection, skip_review: bool = False):
    log.info(f"Reviewing Gemini session {session_id} for story {story_id} from log: {log_file_path.name}")

    session_record = conn.execute(
        "SELECT * FROM jules_sessions WHERE session_id=?", (session_id,)
    ).fetchone()

    if not session_record:
        log.error(f"Session record for {session_id} not found during Gemini review.")
        return

    # Default verdict structure for fallbacks
    final_verdict = {
        "verdict": "BLOCKED",
        "acs_met": [],
        "acs_missing": [],
        "summary": "Failed to get a valid review verdict from Claude (Gemini log review).",
        "reviewer_model": "claude-sonnet-4-6", # default reviewer for direct log analysis
        "reviewed_at": now_iso(),
        "merge_sha": "unknown"
    }

    try:
        with open(log_file_path, "r", errors="ignore") as f:
            log_content = f.read()
    except Exception as e:
        log.error(f"Could not read Gemini log file {log_file_path}: {e}")
        conn.execute(
            "UPDATE jules_sessions SET review_state='FAILED', review_verdict=?, updated=? WHERE session_id=?",
            (json.dumps(final_verdict), now_iso(), session_id)
        )
        conn.commit()
        return

    # 1. Try to extract PR number from log content
    pr_number = None
    pr_match = re.search(r"github\.com/[^/]+/[^/]+/pull/(\d+)", log_content)
    if pr_match:
        pr_number = int(pr_match.group(1))
        log.info(f"  Found PR #{pr_number} in Gemini log.")

    if pr_number:
        # Reuse the existing PR review logic
        if skip_review:
            log.warning(f"  ⚠ SKIP-REVIEW flag active — assuming approval for PR #{pr_number} without review.")
            final_verdict["verdict"] = "APPROVED"
            final_verdict["summary"] = "Skipped review due to --skip-review flag."
        else:
            final_verdict = review_pr(pr_number, story_id) # Reuse review_pr function
        
        final_verdict_str = json.dumps(final_verdict)

        # Update session with PR info and review verdict
        conn.execute(
            """UPDATE jules_sessions SET
                pr_url=?, pr_number=?,
                review_state=?, review_verdict=?, reviewer=?, reviewed=?, updated=?
            WHERE session_id=?
            """,
            (f"https://github.com/{GITHUB_REPO}/pull/{pr_number}", pr_number,
             final_verdict["verdict"], final_verdict_str, final_verdict["reviewer_model"], final_verdict["reviewed_at"], now_iso(),
             session_id)
        )
        conn.commit()

        if final_verdict["verdict"] == "APPROVED":
            log.info(f"  ✓ Review APPROVED for PR #{pr_number}. Attempting merge.")
            ok, err = merge_pr(pr_number)
            if ok:
                merge_sha = get_pr_commit(pr_number)
                final_verdict["merge_sha"] = merge_sha if merge_sha else "unknown"

                story_path_result = subprocess.run(
                    ["python3", "scripts/story.py", "path", str(story_id)],
                    capture_output=True, text=True
                )
                if story_path_result.returncode == 0:
                    story_path = story_path_result.stdout.strip()
                    write_verification_record(story_path, final_verdict)
                    # Update status to COMPLETE
                    write_status(story_path, "COMPLETE")
                else:
                    log.warning(f"  ❌ Story file for story {story_id} not found. Cannot write verification record.")

                log.info(f"  ✓ Merged PR #{pr_number}" + (f" ({final_verdict['merge_sha'][:8]})" if final_verdict['merge_sha'] else ""))
                merge_ts = now_iso()
                conn.execute(
                    "UPDATE jules_sessions SET merged=?, commit_sha=?, state='MERGED', updated=? WHERE session_id=?",
                    (merge_ts, final_verdict["merge_sha"], merge_ts, session_id)
                )
                stamp_story_id(str(story_id), session_record["dispatched"] or merge_ts, merge_ts)
                _write_episode(session_id, conn)
            else:
                log.warning(f"  ❌ Merge failed for PR #{pr_number}: {err}")
                conn.execute(
                    "UPDATE jules_sessions SET state='FAILED', updated=? WHERE session_id=?",
                    (now_iso(), session_id)
                )
            conn.commit()
        else:
            log.warning(f"  ❌ PR #{pr_number} review {final_verdict['verdict']}. No merge.")
            conn.execute(
                "UPDATE jules_sessions SET state=?, updated=? WHERE session_id=?",
                (final_verdict["verdict"], now_iso(), session_id)
            )
            conn.commit()
    else: # No PR found in log, review the log content directly
        log.info(f"  No PR found in log. Reviewing Gemini log content directly for story {story_id}.")
        model = "deepseek-v3.1:671b-cloud"

        # 2. Read story file
        story_content = "Story file not found."
        story_path_result = subprocess.run(
            ["python3", "scripts/story.py", "path", str(story_id)],
            capture_output=True, text=True
        )
        if story_path_result.returncode == 0:
            story_file = story_path_result.stdout.strip()
            try:
                with open(story_file, "r") as f:
                    story_content = f.read()
            except Exception as e:
                log.error(f"  Failed to read story file {story_file}: {e}")

        # 3. Read forbidden patterns from AGENTS.md
        forbidden_patterns = "Forbidden patterns section not found in AGENTS.md."
        try:
            with open("AGENTS.md", "r") as f:
                agents_md_content = f.read()
                forbidden_start_index = agents_md_content.find("## Forbidden")
                if forbidden_start_index != -1:
                    forbidden_patterns = agents_md_content[forbidden_start_index:].strip()
        except Exception as e:
            log.error(f"  Failed to read AGENTS.md or extract forbidden patterns: {e}")

        prompt = f"""
You are a senior code reviewer. Review the provided Gemini agent's execution log against the story's Acceptance Criteria and the project's forbidden patterns.
Determine if the agent successfully completed the story, resulted in a PR that should be merged, or if it got blocked/failed.

REVIEW SCOPE RULES:
1. The Gemini agent produces code and interacts with the system. Evaluate its *final outcome* as reflected in the log: if it claims completion, does the log *suggest* success? If it attempted a PR, was it successful?
2. Do NOT require screenshots, runtime evidence, or benchmark results. The agent is headless.
3. Only block on verifiable issues: the log explicitly states a failure, a crucial step was skipped, or the overall outcome indicates incomplete work.

STORY ACCEPTANCE CRITERIA:
{story_content}

FORBIDDEN PATTERNS (never allowed in generated code/output):
{forbidden_patterns}

GEMINI AGENT EXECUTION LOG (last ~200 lines if full log is too large):
```
{log_content[-10000:]}
```
"""

        if REVIEW_PROVIDER == "openrouter":
            log.info("  Calling OpenRouter for Gemini log review...")
            try:
                import openai  # noqa: PLC0415
                or_client = openai.OpenAI(api_key=openrouter_api_key(), base_url=OPENROUTER_API)
                or_response = or_client.chat.completions.create(
                    model=REVIEW_MODEL_OPENROUTER,
                    messages=[{"role": "user", "content": prompt}],
                    response_format={
                        "type": "json_schema",
                        "json_schema": {
                            "name": "ReviewVerdict",
                            "strict": True,
                            "schema": ReviewVerdict.model_json_schema(),
                        },
                    },
                    extra_body={"structured_outputs": True, "verbosity": "low"},
                    temperature=0,
                )
                verdict = ReviewVerdict.model_validate_json(or_response.choices[0].message.content or "")
                final_verdict.update(verdict.model_dump())
                final_verdict["reviewer_model"] = REVIEW_MODEL_OPENROUTER
                final_verdict["reviewed_at"] = now_iso()
            except Exception as e:
                log.error(f"  OpenRouter Gemini log review error: {e}")
                final_verdict["summary"] = f"OpenRouter Gemini log review error: {e}"
                final_verdict["reviewer_model"] = REVIEW_MODEL_OPENROUTER
        else:
            log.info("  Calling Ollama for Gemini log review...")
            try:
                response = ollama.chat(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    format=ReviewVerdict.model_json_schema(),
                    options={"temperature": 0},
                )
                verdict = ReviewVerdict.model_validate_json(response.message.content or "")
                final_verdict.update(verdict.model_dump())
                final_verdict["reviewer_model"] = model
                final_verdict["reviewed_at"] = now_iso()
            except Exception as e:
                log.error(f"  Ollama Gemini log review error: {e}")
                final_verdict["summary"] = f"Ollama Gemini log review error: {e}"

        final_verdict_str = json.dumps(final_verdict)
        conn.execute(
            """UPDATE jules_sessions SET
                review_state=?, review_verdict=?, reviewer=?, reviewed=?, updated=?, state=?
            WHERE session_id=?
            """,
            (final_verdict["verdict"], final_verdict_str, final_verdict["reviewer_model"], final_verdict["reviewed_at"], now_iso(),
             "MERGED" if final_verdict["verdict"] == "APPROVED" else final_verdict["verdict"],
             session_id)
        )
        conn.commit()
        log.info(f"  Gemini log review complete. Verdict: {final_verdict['verdict']}")

def watch_gemini_logs(conn: sqlite3.Connection, skip_review: bool = False):
    global _gemini_log_states

    for log_file in GEMINI_LOG_DIR.glob("gemini_*.log"):
        match = GEMINI_LOG_PATTERN.match(log_file.name)
        if not match:
            continue

        story_id = int(match.group(1))
        session_id_prefix = f"gemini-{story_id}"

        # Check if this Gemini story is already in the DB and processed
        existing_session = conn.execute(
            "SELECT * FROM jules_sessions WHERE story=? AND agent='gemini' AND (merged IS NOT NULL OR review_state NOT IN ('PENDING', 'FAILED'))",
            (story_id,)
        ).fetchone()
        
        if existing_session:
            # Already processed or under review. Skip.
            continue
        
        try:
            # Read last lines for completion markers
            with open(log_file, "r", errors="ignore") as f:
                lines = f.readlines()
            
            last_lines = [line.strip() for line in lines[-200:] if line.strip()] # Last 200 non-empty lines
            
            is_completed = False
            for marker in GEMINI_COMPLETION_MARKERS:
                if any(marker in line for line in last_lines):
                    is_completed = True
                    break
            
            # Inactivity check
            file_stat = log_file.stat()
            current_time = time.time()
            last_mod_time = file_stat.st_mtime
            current_size = file_stat.st_size

            log_state = _gemini_log_states.get(log_file.name, {"size": 0, "mtime": 0, "last_check": current_time})
            
            if not is_completed and len(lines) >= GEMINI_MIN_LINES_FOR_INACTIVITY:
                if current_size == log_state["size"] and (current_time - log_state["last_check"]) > GEMINI_INACTIVITY_TIMEOUT_SECONDS:
                     # File hasn't grown and it's been inactive for long enough
                    log.info(f"Gemini log {log_file.name} for story {story_id} detected as inactive (not grown for {GEMINI_INACTIVITY_TIMEOUT_SECONDS}s).")
                    is_completed = True
            
            _gemini_log_states[log_file.name] = {
                "size": current_size,
                "mtime": last_mod_time,
                "last_check": current_time
            }

            if is_completed:
                log.info(f"Gemini log {log_file.name} for story {story_id} detected as completed.")
                
                # Check again if session exists, might have been added by another check during this cycle
                existing_session = conn.execute(
                    "SELECT * FROM jules_sessions WHERE story=? AND agent='gemini' AND (merged IS NOT NULL OR review_state NOT IN ('PENDING', 'FAILED'))",
                    (story_id,)
                ).fetchone()

                if existing_session:
                    log.info(f"Gemini session for story {story_id} already exists in DB as processed. Skipping.")
                    continue

                # Create or update session record for Gemini
                session_id = f"{session_id_prefix}-{int(current_time)}"
                # If a session exists with agent='gemini' and state is PENDING or FAILED, update it
                existing_gemini_pending_session = conn.execute(
                    "SELECT session_id FROM jules_sessions WHERE story=? AND agent='gemini' AND review_state IN ('PENDING', 'FAILED')",
                    (story_id,)
                ).fetchone()

                if existing_gemini_pending_session:
                    conn.execute(
                        """UPDATE jules_sessions SET
                            session_id=?,
                            state='COMPLETED',
                            title=?,
                            pr_url=NULL,
                            pr_number=NULL,
                            commit_sha=NULL,
                            branch='main',
                            dispatched=?,
                            plan_approved=?,
                            pr_opened=?,
                            merged=NULL,
                            updated=?,
                            review_state='PENDING',
                            review_verdict=NULL,
                            reviewer=NULL,
                            reviewed=NULL,
                            agent='gemini'
                        WHERE story=? AND agent='gemini' AND review_state IN ('PENDING', 'FAILED')""",
                        (session_id, f"Gemini Story {story_id} completion", now_iso(), now_iso(), now_iso(), now_iso(), story_id)
                    )
                else:
                    conn.execute(
                        """INSERT INTO jules_sessions (
                            session_id, story, title, state, pr_url, pr_number,
                            commit_sha, branch, dispatched, plan_approved, pr_opened,
                            merged, updated, review_state, review_verdict, reviewer, reviewed, agent
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (session_id, story_id, f"Gemini Story {story_id} completion", "COMPLETED", None, None,
                         None, "main", now_iso(), now_iso(), now_iso(),
                         None, now_iso(), "PENDING", None, None, None, "gemini")
                    )
                conn.commit()
                log.info(f"Created/updated Gemini session for story {story_id} with session_id: {session_id}")
                review_gemini_session(session_id, story_id, log_file, conn, skip_review)

        except Exception as e:
            log.error(f"Error processing Gemini log {log_file.name}: {e}")


def poll_cycle(skip_review: bool = False):
    key = jules_api_key()
    with get_db() as conn:
        sessions = get_active_sessions(conn)
        if sessions:
            log.info(f"Polling {len(sessions)} active Jules session(s)...")
            for row in sessions:
                process_session(row, key, conn, skip_review)
        conn.commit()
        watch_gemini_logs(conn, skip_review)

# ── Status display ────────────────────────────────────────────────────────────

def show_status():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM jules_sessions ORDER BY dispatched DESC LIMIT 50"
        ).fetchall()
    if not rows:
        print("No sessions in db.")
        return
    print(f"{'AGENT':<8} {'STORY':<8} {'STATE':<22} {'REVIEW':<14} {'PR':<8} {'SHA':<10} {'TITLE'}")
    print("-" * 99) # Adjusted separator length
    for r in rows:
        sha = (r["commit_sha"] or "")[:8]
        pr = f"#{r['pr_number']}" if r["pr_number"] else ""
        review_state = (r["review_state"] or "—")
        if review_state == "REQUEST_CHANGES":
            review_state = "REQ_CHANGES" # Abbreviate for display
        print(f"{(r['agent'] or '—'):<8} {str(r['story']):<8} {(r['state'] or ''):<22} {review_state:<14} {pr:<8} {sha:<10} {r['title'] or ''}")
# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Jules session monitor daemon.")
    parser.add_argument("--once", action="store_true", help="Run a single poll cycle then exit.")
    parser.add_argument("--status", action="store_true", help="Show all sessions in db.")
    parser.add_argument("--skip-review", action="store_true", help="Bypass PR review and merge directly (emergency use).")
    parser.add_argument("--retry-review", type=str, metavar="SESSION_ID", help="Reset review state for a session to force re-review.")
    parser.add_argument("--episodes", action="store_true", help="Show last 20 episode records.")
    args = parser.parse_args()

    init_db()

    if args.status:
        show_status()
        return

    if args.episodes:
        show_episodes()
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
    def _stop(*_: object) -> None:
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
