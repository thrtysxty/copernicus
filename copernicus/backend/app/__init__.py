"""Copernicus Backend Application."""

from flask import Flask, Blueprint, request, jsonify
from pathlib import Path
import os
import sqlite3

# Configuration
BASE_DIR = Path(__file__).parent.parent
DATABASE_PATH = BASE_DIR / 'copernicus.db'

# Global variable for current database path (can be set by app)
_current_db_path = str(DATABASE_PATH)


class Database:
    """Database helper."""
    def __init__(self):
        self.conn = None

    def connect(self):
        self.conn = sqlite3.connect(str(DATABASE_PATH))
        self.conn.row_factory = sqlite3.Row
        return self.conn

    def close(self):
        if self.conn:
            self.conn.close()
            self.conn = None

    def execute(self, sql: str, params=()):
        if not self.conn:
            self.connect()
        cursor = self.conn.cursor()
        cursor.execute(sql, params)
        self.conn.commit()
        return cursor

    def fetchone(self, sql: str, params=()):
        if not self.conn:
            self.connect()
        cursor = self.conn.cursor()
        cursor.execute(sql, params)
        return cursor.fetchone()

    def fetchall(self, sql: str, params=()):
        if not self.conn:
            self.connect()
        cursor = self.conn.cursor()
        cursor.execute(sql, params)
        return cursor.fetchall()


db = Database()


def init_db():
    """Initialize database schema."""
    import sqlite3
    conn = sqlite3.connect(_current_db_path)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS stories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL
        )
    """)
    conn.close()


def set_db_path(path):
    """Set the current database path."""
    global _current_db_path
    _current_db_path = path


def create_app(config_name: str = 'development') -> Flask:
    """Create Flask application."""
    app = Flask(__name__)
    app.config['DATABASE'] = str(DATABASE_PATH)
    app.config['TESTING'] = config_name == 'testing'
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')

    # Set database path (in-memory for testing)
    if config_name == 'testing':
        set_db_path(':memory:')
    else:
        set_db_path(str(DATABASE_PATH))

    # Initialize database schema
    init_db()

    # Register blueprints
    from app.stories import stories_bp
    from app.docs import docs_bp
    from app.context_manager import context_bp
    app.register_blueprint(stories_bp)
    app.register_blueprint(docs_bp)
    app.register_blueprint(context_bp)

    return app

__all__ = ['create_app', 'init_db']