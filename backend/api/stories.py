from backend.utils.errors import AppError
import logging
logger = logging.getLogger(__name__)
from flask import Blueprint, jsonify
import sqlite3
import os
import uuid
import time
from contextlib import closing
from backend.middleware.auth import require_auth
from backend.utils.validate import validate
from backend.schemas.stories import StoryCreateRequest, StoryUpdateRequest

stories_bp = Blueprint('stories', __name__)

def get_db_connection():
    db_path = os.environ.get('COPERNICUS_DB_PATH', os.path.expanduser('~/.copernicus/copernicus.db'))
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.execute('PRAGMA foreign_keys = ON')
    conn.execute('PRAGMA journal_mode = WAL')
    conn.execute('PRAGMA synchronous = NORMAL')
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with closing(get_db_connection()) as conn:
        # Create the stories table if it doesn't exist just in case, though the electron app usually creates it
        conn.execute('''
            CREATE TABLE IF NOT EXISTS stories (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                body_md TEXT,
                status TEXT,
                created_at INTEGER,
                updated_at INTEGER
            )
        ''')
        conn.commit()

# Try to init db when module loads
try:
    init_db()
except Exception:
        logger.error("Unexpected error", exc_info=True)

@stories_bp.route('', methods=['GET'])
@require_auth
def list_stories():
    try:
        with closing(get_db_connection()) as conn:
            cursor = conn.execute('SELECT * FROM stories ORDER BY created_at DESC')
            stories = [dict(row) for row in cursor.fetchall()]
            return jsonify({"ok": True, "data": stories}), 200
    except Exception as e:
        raise AppError(str(e))

@stories_bp.route('/<story_id>', methods=['GET'])
@require_auth
def get_story(story_id):
    try:
        with closing(get_db_connection()) as conn:
            cursor = conn.execute('SELECT * FROM stories WHERE id = ?', (story_id,))
            row = cursor.fetchone()
            if row:
                return jsonify({"ok": True, "data": dict(row)}), 200
            else:
                raise AppError("Story not found", status=404)
    except Exception as e:
        raise AppError(str(e))

@stories_bp.route('', methods=['POST'])
@require_auth
@validate(StoryCreateRequest)
def create_story(request_data: StoryCreateRequest):
    try:
        story_id = request_data.id or str(uuid.uuid4())
        title = request_data.title or 'New Story'
        body_md = request_data.body_md or ''
        status = request_data.status or 'PLANNING'
        now = int(time.time() * 1000)

        with closing(get_db_connection()) as conn:
            conn.execute(
                'INSERT INTO stories (id, title, body_md, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
                (story_id, title, body_md, status, now, now)
            )
            conn.commit()

            cursor = conn.execute('SELECT * FROM stories WHERE id = ?', (story_id,))
            new_story = dict(cursor.fetchone())

            return jsonify({"ok": True, "data": new_story}), 201
    except Exception as e:
        raise AppError(str(e))

@stories_bp.route('/<story_id>', methods=['PUT'])
@require_auth
@validate(StoryUpdateRequest)
def update_story(story_id, request_data: StoryUpdateRequest):
    try:
        with closing(get_db_connection()) as conn:
            # First check if exists
            cursor = conn.execute('SELECT * FROM stories WHERE id = ?', (story_id,))
            if not cursor.fetchone():
                raise AppError("Story not found", status=404)

            update_fields = []
            values = []

            data = request_data.model_dump(exclude_unset=True)

            for field in ['title', 'body_md', 'status']:
                if field in data and data[field] is not None:
                    update_fields.append(field + " = ?")
                    values.append(data[field])

            if not update_fields:
                raise AppError("No valid fields to update", status=400)

            now = int(time.time() * 1000)
            update_fields.append("updated_at = ?")
            values.append(now)

            query = "UPDATE stories SET " + ", ".join(update_fields) + " WHERE id = ?"
            values.append(story_id)

            conn.execute(query, tuple(values))
            conn.commit()

            cursor = conn.execute('SELECT * FROM stories WHERE id = ?', (story_id,))
            updated_story = dict(cursor.fetchone())

            return jsonify({"ok": True, "data": updated_story}), 200
    except Exception as e:
        raise AppError(str(e))

@stories_bp.route('/<story_id>', methods=['DELETE'])
@require_auth
def delete_story(story_id):
    try:
        with closing(get_db_connection()) as conn:
            cursor = conn.execute('SELECT * FROM stories WHERE id = ?', (story_id,))
            if not cursor.fetchone():
                raise AppError("Story not found", status=404)

            conn.execute('DELETE FROM stories WHERE id = ?', (story_id,))
            conn.commit()

            return jsonify({"ok": True, "data": {"deleted": True}}), 200
    except Exception as e:
        raise AppError(str(e))
