"""Copernicus Flask Application."""

import os
import sqlite3
from pathlib import Path
from typing import Any, Optional

from flask import Flask, Blueprint, request, jsonify

# Import blueprints to avoid circular imports
from app import stories_bp, docs_bp

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


def create_app(config_name: str = 'development') -> Any:
    """Create Flask application."""
    app = Flask(__name__)
    app.config['DATABASE'] = str(DATABASE_PATH)
    app.config['TESTING'] = False
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')

    if config_name == 'testing':
        app.config['TESTING'] = True
        # Use in-memory database for testing
        app.config['DATABASE'] = ':memory:'

    # Initialize database schema
    init_db()

    # Register routes
    app.register_blueprint(stories_bp)
    app.register_blueprint(docs_bp)

    return app


from flask import Blueprint, request, jsonify

stories_bp = Blueprint('stories', __name__)


@stories_bp.route('/api/stories', methods=['POST'])
def create_story():
    """Create a new story."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    title = data.get('title', '')
    description = data.get('description', '')

    # Parameterized query to prevent SQL injection
    cursor = db.execute(
        """INSERT INTO stories (title, description) VALUES (?, ?)""",
        (title, description)
    )
    story_id = cursor.lastrowid

    # Fetch created story
    story = db.fetchone(
        "SELECT id, title, description FROM stories WHERE id = ?",
        (story_id,)
    )

    return jsonify({
        'id': story_id,
        'title': story['title'],
        'description': story['description']
    }), 201


@stories_bp.route('/api/stories', methods=['GET'])
def get_stories():
    """Get all stories."""
    stories = db.fetchall(
        "SELECT id, title, description FROM stories ORDER BY id DESC"
    )
    return jsonify([{
        'id': s['id'],
        'title': s['title'],
        'description': s['description']
    } for s in stories]), 200


@stories_bp.route('/api/stories/<int:story_id>', methods=['GET'])
def get_story(story_id: int):
    """Get a specific story."""
    story = db.fetchone(
        "SELECT id, title, description FROM stories WHERE id = ?",
        (story_id,)
    )

    if not story:
        return jsonify({'error': 'Story not found'}), 404

    return jsonify({
        'id': story['id'],
        'title': story['title'],
        'description': story['description']
    }), 200


@stories_bp.route('/api/stories/<int:story_id>', methods=['PUT'])
def update_story(story_id: int):
    """Update a story."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    title = data.get('title', '')
    description = data.get('description', '')

    cursor = db.execute(
        """UPDATE stories SET title = ?, description = ? WHERE id = ?""",
        (title, description, story_id)
    )

    if not cursor.rowcount:
        return jsonify({'error': 'Story not found'}), 404

    story = db.fetchone(
        "SELECT id, title, description FROM stories WHERE id = ?",
        (story_id,)
    )

    return jsonify({
        'id': story['id'],
        'title': story['title'],
        'description': story['description']
    }), 200


@stories_bp.route('/api/stories/<int:story_id>', methods=['DELETE'])
def delete_story(story_id: int):
    """Delete a story."""
    cursor = db.execute(
        "DELETE FROM stories WHERE id = ?",
        (story_id,)
    )

    if not cursor.rowcount:
        return jsonify({'error': 'Story not found'}), 404

    return jsonify({'message': 'Story deleted'}), 200


if __name__ == '__main__':
    create_app().run(debug=True, port=5001)
