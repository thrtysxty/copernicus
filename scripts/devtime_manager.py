import sqlite3
import datetime
import json
import logging
import subprocess
from pathlib import Path
from typing import Optional, List

class DevTimeManager:
    DB_PATH = Path.home() / ".copernicus" / "devtime.db"
    LOCK_PATH = Path.home() / ".copernicus" / ".devtime_active"
    RATE = 65.0  # USD/hour

    SCHEMA = """
CREATE TABLE IF NOT EXISTS dev_sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    date        TEXT    NOT NULL,
    start_time  TEXT,
    duration    REAL    NOT NULL CHECK (duration >= 0.25),
    phase       TEXT    NOT NULL CHECK (phase IN (
                    'PRELIMINARY', 'DEVELOPMENT', 'POST_IMPLEMENTATION')),
    financial_category TEXT NOT NULL CHECK (financial_category IN ('CAPEX', 'OPEX', 'NONE')),
    component   TEXT    NOT NULL,
    description TEXT    NOT NULL,
    commits     TEXT,
    story_id    TEXT,
    capitalizable INTEGER GENERATED ALWAYS AS (
        CASE WHEN financial_category = 'CAPEX' AND phase = 'DEVELOPMENT'
             THEN 1 ELSE 0 END
    ) STORED,
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE VIEW IF NOT EXISTS v_monthly_capex AS
SELECT
    strftime('%Y-%m', date) AS month,
    component,
    SUM(duration)           AS total_hours,
    COUNT(*)                AS sessions,
    ROUND(SUM(duration) * 65.0, 2) AS asset_value_usd
FROM dev_sessions
WHERE capitalizable = 1
GROUP BY month, component
ORDER BY month, component;

CREATE VIEW IF NOT EXISTS v_capex_total AS
SELECT
    SUM(CASE WHEN capitalizable = 1 THEN duration ELSE 0 END) AS total_capitalizable_hours,
    ROUND(SUM(CASE WHEN capitalizable = 1 THEN duration ELSE 0 END) * 65.0, 2) AS total_asset_value_usd,
    MIN(CASE WHEN capitalizable = 1 THEN date END) AS first_capitalizable_date
FROM dev_sessions;
"""

    def __init__(self):
        # Set up logging
        logging.basicConfig(level=logging.WARNING)
        self.logger = logging.getLogger("DevTimeManager")
        self._ensure_schema()

    def _ensure_schema(self) -> None:
        """Idempotently creates DB + schema on first use."""
        try:
            self.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
            with sqlite3.connect(self.DB_PATH) as conn:
                conn.executescript(self.SCHEMA)
        except Exception as e:
            self.logger.warning(f"Failed to ensure schema: {e}")

    def is_active(self) -> bool:
        """Check if a session is currently active (lockfile exists)."""
        return self.LOCK_PATH.exists()

    def get_context(self) -> Optional[dict]:
        """Get the context from the lockfile if it exists."""
        if not self.is_active():
            return None
        try:
            with open(self.LOCK_PATH, "r") as f:
                return json.load(f)
        except Exception as e:
            self.logger.warning(f"Failed to read lockfile: {e}")
            return None

    def get_elapsed_seconds(self) -> float:
        """Get elapsed time in seconds for the current session."""
        context = self.get_context()
        if not context:
            return 0.0
        
        start_time_str = context.get("start_time")
        if not start_time_str:
            return 0.0
            
        try:
            start_time = datetime.datetime.fromisoformat(start_time_str)
            elapsed = (datetime.datetime.now() - start_time).total_seconds()
            return max(0.0, elapsed)
        except Exception as e:
            self.logger.warning(f"Failed to calculate elapsed time: {e}")
            return 0.0

    def open_session(
        self,
        financial_category: str,
        component: str,
        phase: str,
        story_id: Optional[str],
    ) -> None:
        """Start a new session by creating a lockfile."""
        if self.is_active():
            self.logger.warning("Session already active")
            return

        session_data = {
            "financial_category": financial_category,
            "component": component,
            "phase": phase,
            "story_id": story_id,
            "start_time": datetime.datetime.now().isoformat(),
        }

        try:
            with open(self.LOCK_PATH, "w") as f:
                json.dump(session_data, f)
        except Exception as e:
            self.logger.warning(f"Failed to create lockfile: {e}")
            raise

    def close_session(
        self,
        description: str,
        commits: Optional[str],
    ) -> None:
        """Close the current session and write to DB."""
        context = self.get_context()
        if not context:
            self.logger.warning("No active session to close")
            return

        try:
            start_time = datetime.datetime.fromisoformat(context["start_time"])
            end_time = datetime.datetime.now()
            duration_hours = (end_time - start_time).total_seconds() / 3600.0
            
            # Round to nearest 0.25h, minimum 0.25h
            duration = max(0.25, round(duration_hours * 4) / 4)
            
            with sqlite3.connect(self.DB_PATH) as conn:
                conn.execute(
                    """
                    INSERT INTO dev_sessions (
                        date, start_time, duration, phase, financial_category, component, 
                        description, commits, story_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        start_time.date().isoformat(),
                        start_time.isoformat(),
                        duration,
                        context["phase"],
                        context["financial_category"],
                        context["component"],
                        description,
                        commits,
                        context.get("story_id"),
                    )
                )
            
            # Remove lockfile only after successful DB write
            if self.LOCK_PATH.exists():
                self.LOCK_PATH.unlink()
            
        except Exception as e:
            self.logger.error(f"Failed to close session: {e}")
            raise

    def get_recent_commits(self, n: int = 5) -> List[str]:
        """Get recent git commits from current directory."""
        try:
            result = subprocess.check_output(
                ["git", "log", f"-{n}", "--format=%h %s"],
                stderr=subprocess.DEVNULL,
                text=True
            )
            return [line.strip() for line in result.splitlines() if line.strip()]
        except Exception:
            return []
