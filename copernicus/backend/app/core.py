"""Core application logic shared across modules."""

import os
import sqlite3
from pathlib import Path
from typing import Any, Optional

# Configuration
BASE_DIR = Path(__file__).parent.parent
DATABASE_PATH = BASE_DIR / 'copernicus.db'


class Database:
    """Database connection helper."""

    def __init__(self):
        self.conn: Optional[sqlite3.Connection] = None

    def connect(self):
        """Connect to database."""
        self.conn = sqlite3.connect(str(DATABASE_PATH))
        self.conn.row_factory = sqlite3.Row
        return self.conn

    def close(self):
        """Close database connection."""
        if self.conn:
            self.conn.close()
            self.conn = None

    def execute(self, sql: str, params: tuple = ()) -> sqlite3.Cursor:
        """Execute SQL with parameterized query."""
        if not self.conn:
            self.connect()
        cursor = self.conn.cursor()
        cursor.execute(sql, params)
        self.conn.commit()
        return cursor

    def fetchone(self, sql: str, params: tuple = ()) -> Optional[sqlite3.Row]:
        """Fetch one row."""
        if not self.conn:
            self.connect()
        cursor = self.conn.cursor()
        cursor.execute(sql, params)
        return cursor.fetchone()

    def fetchall(self, sql: str, params: tuple = ()) -> list[sqlite3.Row]:
        """Fetch all rows."""
        if not self.conn:
            self.connect()
        cursor = self.conn.cursor()
        cursor.execute(sql, params)
        return cursor.fetchall()


db = Database()


def init_db():
    """Initialize database schema."""
    cursor = db.execute(
        """CREATE TABLE IF NOT EXISTS stories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL
        )"""
    )
