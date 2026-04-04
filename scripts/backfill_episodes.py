import sqlite3
import argparse
import sys
import os
from pathlib import Path

# Need to import _write_episode from agent_monitor
sys.path.insert(0, str(Path(__file__).parent))
try:
    from agent_monitor import _write_episode, get_db, init_db
except ImportError as e:
    print(f"Failed to import from agent_monitor: {e}")
    sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Backfill episodes from existing jules_sessions.")
    args = parser.parse_args()

    init_db()

    with get_db() as conn:
        # Find sessions with review_verdict (which holds the JSON with summary, blocked_reasons etc.)
        # and haven't been added to episodes table yet.
        rows = conn.execute("""
            SELECT s.session_id
            FROM jules_sessions s
            LEFT JOIN episodes e ON e.episode_id LIKE '%' || substr(s.session_id, 1, 8) || '%'
            WHERE s.review_verdict IS NOT NULL
              AND e.episode_id IS NULL
        """).fetchall()

        if not rows:
            print("No new sessions to backfill.")
            return

        print(f"Found {len(rows)} sessions to backfill.")

        for idx, row in enumerate(rows):
            session_id = row["session_id"]
            print(f"Backfilling session {idx + 1}/{len(rows)}: {session_id}")
            _write_episode(session_id, conn)

if __name__ == "__main__":
    main()
