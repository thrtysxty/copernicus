from flask import Blueprint, jsonify, request
import sqlite3
import os
import uuid
import time
from backend.middleware.auth import require_auth

stories_bp = Blueprint('stories', __name__)

def get_db_connection():
    db_path = os.environ.get('COPERNICUS_DB_PATH', os.path.expanduser('~/.copernicus/copernicus.db'))
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
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
    conn.close()

# Try to init db when module loads
try:
    init_db()
except Exception:
    pass

@stories_bp.route('', methods=['GET'])
@require_auth
def list_stories():
    try:
        conn = get_db_connection()
        cursor = conn.execute('SELECT * FROM stories ORDER BY created_at DESC')
        stories = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return jsonify({"ok": True, "data": stories}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@stories_bp.route('/<story_id>', methods=['GET'])
@require_auth
def get_story(story_id):
    try:
        conn = get_db_connection()
        cursor = conn.execute('SELECT * FROM stories WHERE id = ?', (story_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return jsonify({"ok": True, "data": dict(row)}), 200
        else:
            return jsonify({"ok": False, "error": "Story not found"}), 404
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@stories_bp.route('', methods=['POST'])
@require_auth
def create_story():
    try:
        data = request.get_json() or {}
        story_id = data.get('id', str(uuid.uuid4()))
        title = data.get('title', 'New Story')
        body_md = data.get('body_md', '')
        status = data.get('status', 'PLANNING')
        now = int(time.time() * 1000)

        conn = get_db_connection()
        conn.execute(
            'INSERT INTO stories (id, title, body_md, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            (story_id, title, body_md, status, now, now)
        )
        conn.commit()

        cursor = conn.execute('SELECT * FROM stories WHERE id = ?', (story_id,))
        new_story = dict(cursor.fetchone())
        conn.close()

        return jsonify({"ok": True, "data": new_story}), 201
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@stories_bp.route('/<story_id>', methods=['PUT'])
@require_auth
def update_story(story_id):
    try:
        data = request.get_json() or {}

        conn = get_db_connection()
        # First check if exists
        cursor = conn.execute('SELECT * FROM stories WHERE id = ?', (story_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({"ok": False, "error": "Story not found"}), 404

        update_fields = []
        values = []

        for field in ['title', 'body_md', 'status']:
            if field in data:
                update_fields.append(f"{field} = ?")
                values.append(data[field])

        if not update_fields:
            conn.close()
            return jsonify({"ok": False, "error": "No valid fields to update"}), 400

        now = int(time.time() * 1000)
        update_fields.append("updated_at = ?")
        values.append(now)

        query = f"UPDATE stories SET {', '.join(update_fields)} WHERE id = ?"
        values.append(story_id)

        conn.execute(query, tuple(values))
        conn.commit()

        cursor = conn.execute('SELECT * FROM stories WHERE id = ?', (story_id,))
        updated_story = dict(cursor.fetchone())
        conn.close()

        return jsonify({"ok": True, "data": updated_story}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@stories_bp.route('/<story_id>', methods=['DELETE'])
@require_auth
def delete_story(story_id):
    try:
        conn = get_db_connection()
        cursor = conn.execute('SELECT * FROM stories WHERE id = ?', (story_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({"ok": False, "error": "Story not found"}), 404

        conn.execute('DELETE FROM stories WHERE id = ?', (story_id,))
        conn.commit()
        conn.close()

        return jsonify({"ok": True, "data": {"deleted": True}}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500
