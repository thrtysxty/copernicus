#!/usr/bin/env python3
"""
select_agent.py — Agent Selector: Data-Driven Dispatch Routing

Given a story file, analyzes its characteristics, queries past episode performance,
checks agent availability and harness constraints, and recommends the best agent.
"""

import argparse
import json
import logging
import os
import re
import sqlite3
import subprocess
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from urllib import request, error

# Set up logging for non-JSON output if needed (stderr so it doesn't pollute stdout JSON)
logging.basicConfig(level=logging.WARNING, format="%(levelname)s: %(message)s")
log = logging.getLogger("select_agent")

DB_PATH = Path.home() / "Library" / "Application Support" / "copernicus" / "jules.db"

def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def read_harnesses() -> dict:
    harnesses_file = Path(__file__).parent / "harnesses.json"
    if not harnesses_file.exists():
        return {"jules": {"capabilities": ["pty", "typescript", "ipc"]}, "gemini": {"capabilities": ["git", "multi-file"]}}
    try:
        with open(harnesses_file, "r") as f:
            return json.load(f)
    except json.JSONDecodeError:
        log.warning(f"Error parsing {harnesses_file}, using defaults.")
        return {"jules": {"capabilities": ["pty", "typescript", "ipc"]}, "gemini": {"capabilities": ["git", "multi-file"]}}

def check_jules_availability() -> bool:
    """Check if Jules API is reachable."""
    # Attempt to use JULES_API_KEY from environment or ~/.secrets
    api_key = os.environ.get("JULES_API_KEY", "")
    if not api_key:
        result = subprocess.run(
            ["bash", "-c", "source ~/.secrets 2>/dev/null && echo $JULES_API_KEY"],
            capture_output=True, text=True
        )
        api_key = result.stdout.strip()

    if not api_key:
        return False

    url = "https://google.com" # Just a ping
    try:
        req = request.Request(url, method="GET")
        try:
            with request.urlopen(req, timeout=3) as _:
                return True
        except error.HTTPError as e:
            # 400 Bad Request or 403 etc means the API is reachable
            return True
    except error.URLError:
        return False
    return False

def check_gemini_availability() -> bool:
    """Check if Gemini CLI is available."""
    # Check if the 'gemini' CLI command is available
    result = subprocess.run(["which", "gemini"], capture_output=True)
    if result.returncode == 0:
        return True

    # Fallback to checking ollama as it might be used as a proxy
    result = subprocess.run(["which", "ollama"], capture_output=True)
    if result.returncode == 0:
        return True

    return False

def analyze_story(story_path: Path) -> dict:
    """Analyze story file for characteristics."""
    if not story_path.exists():
        return {"ipc": False, "backend": False, "frontend": False, "infra": False, "pty": False, "git": False, "multi-file": False}

    content = story_path.read_text().lower()

    # Heuristics for story type/characteristics
    ipc = "ipc" in content or "ipcmain.handle" in content or "useipcerror" in content
    backend = "python" in content or "sqlite" in content or "better-sqlite3" in content or ".py" in content
    frontend = "react" in content or "tsx" in content or "tailwind" in content or "renderer" in content
    infra = "scripts/" in content or "docker" in content or "bash" in content or ".sh" in content

    pty = "pty" in content or "terminal" in content
    git = "git" in content or "github" in content
    multi_file = "multi-file" in content or "multiple files" in content

    return {
        "ipc": ipc,
        "backend": backend,
        "frontend": frontend,
        "infra": infra,
        "pty": pty,
        "git": git,
        "multi-file": multi_file
    }

def get_performance_data(characteristics: dict) -> dict:
    """Query DB for performance of agents over last 90 days matching these characteristics."""
    # Since episode store doesn't strictly have boolean characteristics typed columns,
    # we might have to query based on 'files_touched' or 'notes' containing keywords.
    # For now, we will aggregate average quality_score by agent.
    # A more advanced query would try to match 'task' or 'notes' against our characteristics.

    performance = {"jules": {"score": 0.0, "count": 0}, "gemini": {"score": 0.0, "count": 0}}

    db_path = DB_PATH
    if not db_path.exists():
        return performance

    try:
        with get_db() as conn:
            ninety_days_ago = (datetime.now() - timedelta(days=90)).isoformat()

            # Simple aggregation by agent
            # Ideally, we should filter by story type, but without structured data in `episodes`, we do a LIKE search
            # We'll build a simple query combining overall performance
            query = """
                SELECT agent, AVG(quality_score) as avg_score, COUNT(*) as cnt
                FROM episodes
                WHERE timestamp >= ?
                GROUP BY agent
            """
            rows = conn.execute(query, (ninety_days_ago,)).fetchall()
            for r in rows:
                agent = r["agent"].lower()
                if agent in performance:
                    performance[agent]["score"] = r["avg_score"]
                    performance[agent]["count"] = r["cnt"]

            # Refined query: If the story has specific characteristics, try to find similar past stories
            filters = []
            if characteristics["ipc"]: filters.append("task LIKE '%ipc%' OR notes LIKE '%ipc%'")
            if characteristics["backend"]: filters.append("task LIKE '%backend%' OR files_touched LIKE '%.py%'")
            if characteristics["frontend"]: filters.append("task LIKE '%frontend%' OR files_touched LIKE '%.tsx%'")
            if characteristics["infra"]: filters.append("files_touched LIKE '%.sh%' OR task LIKE '%infra%'")

            if filters:
                filter_clause = " OR ".join(filters)
                refined_query = f"""
                    SELECT agent, AVG(quality_score) as avg_score, COUNT(*) as cnt
                    FROM episodes
                    WHERE timestamp >= ? AND ({filter_clause})
                    GROUP BY agent
                """
                try:
                    refined_rows = conn.execute(refined_query, (ninety_days_ago,)).fetchall()
                    for r in refined_rows:
                        agent = r["agent"].lower()
                        if agent in performance:
                            # Weight the refined score more if we have data points
                            if r["cnt"] > 0:
                                performance[agent]["score"] = r["avg_score"] # override with specific
                                performance[agent]["count"] = r["cnt"]
                except sqlite3.OperationalError:
                    pass

    except Exception as e:
        log.error(f"Error querying episodes DB: {e}")

    return performance

def main():
    parser = argparse.ArgumentParser(description="Agent Selector: Data-Driven Dispatch Routing")
    parser.add_argument("story_file", nargs='?', help="Path to the story markdown file")
    parser.add_argument("--explain", action="store_true", help="Show full scoring breakdown")
    args = parser.parse_args()

    if not args.story_file:
        print(json.dumps({"error": "No story file provided"}))
        return 1

    story_path = Path(args.story_file)
    if not story_path.exists():
        print(json.dumps({"error": f"Story file {story_path} not found"}))
        return 1

    harnesses = read_harnesses()
    characteristics = analyze_story(story_path)

    jules_avail = check_jules_availability()
    gemini_avail = check_gemini_availability()

    performance = get_performance_data(characteristics)

    # Scoring and Selection Logic
    scores = {}
    breakdown = {}

    # 1. Harness capability filter
    capable_agents = []
    harness_reasons = {}

    for agent, config in harnesses.items():
        caps = config.get("capabilities", [])
        is_capable = True
        reasons = []

        if characteristics["pty"] and "pty" not in caps:
            is_capable = False
            reasons.append("Missing capability: pty")
        if characteristics["git"] and "git" not in caps:
            is_capable = False
            reasons.append("Missing capability: git")

        harness_reasons[agent] = reasons
        if is_capable:
            capable_agents.append(agent)

    # 2. Availability filter
    available_agents = []
    avail_map = {"jules": jules_avail, "gemini": gemini_avail}
    for agent in capable_agents:
        if avail_map.get(agent, False):
            available_agents.append(agent)

    # 3. Performance scoring
    for agent in available_agents:
        base_score = performance.get(agent, {}).get("score", 0.5) # Default 0.5 if no data
        # Minor bump for having more experience
        count_bonus = min(performance.get(agent, {}).get("count", 0) / 100.0, 0.2)
        scores[agent] = base_score + count_bonus

    # Determine recommended agent
    recommended_agent = "jules" # Default fallback
    confidence = 0.0
    reasoning = "Default fallback"

    if scores:
        best_agent = max(scores, key=scores.get)
        recommended_agent = best_agent
        confidence = scores[best_agent]
        reasoning = f"Highest performance score ({confidence:.2f}) based on past episodes."
    else:
        # Fallbacks if none available or capable
        if not available_agents:
            if not capable_agents:
                 reasoning = "No agents capable based on harness requirements. Defaulting to jules."
            else:
                 reasoning = "No capable agents are currently available (API reachable). Defaulting to jules."
        else:
             reasoning = "No scoring data available. Defaulting to jules."

    # Force gemini if multi-file and no strong preference? (Legacy intuition encoded as fallback)
    if characteristics["multi-file"] and "gemini" in available_agents and recommended_agent != "gemini":
        if scores.get("gemini", 0) + 0.3 > scores.get("jules", 0):
            recommended_agent = "gemini"
            confidence = scores.get("gemini", 0)
            reasoning = "Legacy heuristic override: multi-file story prefers Gemini."

    # If --explain, output human-readable
    if args.explain:
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("AGENT SELECTOR BREAKDOWN")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print(f"Story: {story_path.name}")
        print("\n[Characteristics]")
        for k, v in characteristics.items():
            if v: print(f" - {k}")

        print("\n[Availability]")
        print(f" - Jules API: {'✅ Reachable' if jules_avail else '❌ Unreachable'}")
        print(f" - Gemini CLI: {'✅ Available' if gemini_avail else '❌ Unavailable'}")

        print("\n[Harness Compatibility]")
        for agent in harnesses:
            caps = harnesses[agent].get("capabilities", [])
            print(f" - {agent}: {', '.join(caps)}")
            for reason in harness_reasons.get(agent, []):
                print(f"     ❌ {reason}")

        print("\n[Episode Performance (90 days)]")
        for agent in performance:
            score = performance[agent]['score']
            count = performance[agent]['count']
            print(f" - {agent}: avg quality {score:.2f} ({count} dispatches)")

        print("\n[Selection]")
        print(f" Recommended:  {recommended_agent.upper()}")
        print(f" Confidence:   {confidence:.2f}")
        print(f" Reasoning:    {reasoning}")
        return 0

    # Otherwise JSON output
    result = {
        "recommended_agent": recommended_agent,
        "confidence": confidence,
        "reasoning": reasoning,
        "availability": avail_map,
        "performance": performance
    }
    print(json.dumps(result))
    return 0

if __name__ == "__main__":
    sys.exit(main())
