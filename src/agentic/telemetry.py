"""
Agent Telemetry & State Ledger

Lightweight SQLite-backed telemetry for sub-agent tracking and shared asset registry.
Stores agent records, events, and shared assets in benway.db at the project root.
"""

import os
import sqlite3
import uuid
import json
from datetime import datetime, timezone


PROJECT_ROOT = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
DB_PATH = os.path.join(PROJECT_ROOT, "benway.db")


class Telemetry:
    """SQLite-backed agent telemetry tracker and state ledger."""

    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._ensure_tables()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _ensure_tables(self):
        conn = self._connect()
        try:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS agents (
                    id TEXT PRIMARY KEY,
                    name TEXT,
                    role TEXT NOT NULL,
                    task_description TEXT,
                    parent_id TEXT,
                    status TEXT DEFAULT 'RUNNING',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS events (
                    id TEXT PRIMARY KEY,
                    agent_id TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    data TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (agent_id) REFERENCES agents(id)
                )
            """)
            # Surgical Registry for Shared Assets
            conn.execute("""
                CREATE TABLE IF NOT EXISTS shared_assets (
                    id TEXT PRIMARY KEY,
                    asset_type TEXT NOT NULL,
                    name TEXT NOT NULL,
                    content TEXT,
                    metadata TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(asset_type, name)
                )
            """)
            conn.commit()
        finally:
            conn.close()

    def register_agent(
        self,
        name: str,
        role: str,
        task: str,
        parent_id: str | None = None,
    ) -> str:
        """Register a new agent and return its ID."""
        agent_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        conn = self._connect()
        try:
            conn.execute(
                "INSERT INTO agents (id, name, role, task_description, parent_id, status, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, 'RUNNING', ?, ?)",
                (agent_id, name, role, task, parent_id, now, now),
            )
            conn.commit()
        finally:
            conn.close()
        return agent_id

    def update_status(self, agent_id: str, status: str):
        """Update an agent's status."""
        now = datetime.now(timezone.utc).isoformat()
        conn = self._connect()
        try:
            conn.execute(
                "UPDATE agents SET status = ?, updated_at = ? WHERE id = ?",
                (status, now, agent_id),
            )
            conn.commit()
        finally:
            conn.close()

    def log_event(self, agent_id: str, event_type: str, data: dict | None = None):
        """Log an event for an agent."""
        event_id = str(uuid.uuid4())
        conn = self._connect()
        try:
            conn.execute(
                "INSERT INTO events (id, agent_id, event_type, data) VALUES (?, ?, ?, ?)",
                (event_id, agent_id, event_type, json.dumps(data) if data else None),
            )
            conn.commit()
        finally:
            conn.close()

    def get_running_agents(self) -> list[dict]:
        """Get all agents with RUNNING status."""
        conn = self._connect()
        try:
            cursor = conn.execute(
                "SELECT id, name, role, task_description, parent_id, created_at "
                "FROM agents WHERE status = 'RUNNING' ORDER BY created_at DESC"
            )
            return [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()

    def cleanup_stale_agents(self, max_age_hours: int = 1) -> int:
        """Mark agents that have been RUNNING for too long as STALE.

        Args:
            max_age_hours: Maximum age in hours before marking as stale

        Returns:
            Number of agents marked as stale
        """
        conn = self._connect()
        try:
            # SQLite datetime comparison - agents older than max_age_hours
            cursor = conn.execute(
                """
                UPDATE agents
                SET status = 'STALE', updated_at = datetime('now')
                WHERE status = 'RUNNING'
                AND datetime(created_at) < datetime('now', ? || ' hours')
                """,
                (f"-{max_age_hours}",),
            )
            conn.commit()
            return cursor.rowcount
        finally:
            conn.close()
    
    # --- Surgical Registry (Shared Assets) ---

    def register_asset(
        self,
        asset_type: str,
        name: str,
        content: str,
        metadata: dict | None = None
    ) -> str:
        """Register a shared asset in the Surgical Registry."""
        asset_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        conn = self._connect()
        try:
            conn.execute(
                "INSERT OR REPLACE INTO shared_assets (id, asset_type, name, content, metadata, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (asset_id, asset_type, name, content, json.dumps(metadata) if metadata else None, now, now),
            )
            conn.commit()
        finally:
            conn.close()
        return asset_id

    def get_asset(self, asset_type: str, name: str) -> dict | None:
        """Retrieve an asset by type and name."""
        conn = self._connect()
        try:
            cursor = conn.execute(
                "SELECT * FROM shared_assets WHERE asset_type = ? AND name = ?",
                (asset_type, name)
            )
            row = cursor.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()


# Module-level singleton
telemetry = Telemetry()
