"""Copernicus Backend Application."""

from flask import Flask, Blueprint, request, jsonify
from pathlib import Path
import os
import sqlite3

# Configuration
BASE_DIR = Path(__file__).parent.parent
DATABASE_PATH = BASE_DIR / 'copernicus.db'

# Global variable for current database path
_current_db_path = str(DATABASE_PATH)

# Reset flag — set this in test setUp to get a fresh temp DB per test
_test_reset_flag = False
_test_db_path: str | None = None


class Database:
    """Database helper."""
    def __init__(self):
        self.conn = None
        self._path = None

    def connect(self):
        self._path = _current_db_path
        self.conn = sqlite3.connect(self._path)
        self.conn.row_factory = sqlite3.Row
        return self.conn

    def close(self):
        if self.conn:
            self.conn.close()
            self.conn = None
            self._path = None

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

    def reset_for_test(self):
        self.close()


db = Database()


def init_db():
    """Initialize database schema."""
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


def reset_test_db():
    """Force the next create_app('testing') to get a fresh temp DB."""
    global _test_reset_flag, _test_db_path
    _test_reset_flag = True
    if _test_db_path and os.path.exists(_test_db_path):
        try:
            os.unlink(_test_db_path)
        except OSError:
            pass
    _test_db_path = None


def create_app(config_name: str = 'development') -> Flask:
    """Create Flask application."""
    global _test_reset_flag, _test_db_path

    app = Flask(__name__)
    app.config['DATABASE'] = str(DATABASE_PATH)
    app.config['TESTING'] = config_name == 'testing'
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')

    # Reset the db singleton before each app creation to ensure isolation
    db.reset_for_test()

    # Set database path (file-based temp for testing)
    if config_name == 'testing':
        if _test_reset_flag or _test_db_path is None:
            import tempfile, uuid
            if _test_db_path and os.path.exists(_test_db_path):
                try:
                    os.unlink(_test_db_path)
                except OSError:
                    pass
            _test_db_path = os.path.join(tempfile.gettempdir(), f'ccb_test_{uuid.uuid4().hex}.db')
            _test_reset_flag = False
        set_db_path(_test_db_path)
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

__all__ = ['create_app', 'init_db', 'reset_test_db']
