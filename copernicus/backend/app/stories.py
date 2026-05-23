"""Stories endpoints."""

from flask import Blueprint, request, jsonify

# NOTE: _current_db_path is accessed at call-time inside each route function,
# not at module load time, to ensure it picks up the :memory: path when
# create_app('testing') is called (which happens after this module is imported).
#
# Do NOT replace this with a module-level binding like:
#   from app import _current_db_path   # WRONG - captures value at import time

stories_bp = Blueprint('stories', __name__)


@stories_bp.route('/api/stories', methods=['POST'])
def create_story():
    """Create a new story."""
    # Import at call-time so we get the current _current_db_path value
    from app import _current_db_path

    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    title = data.get('title', '')
    description = data.get('description', '')
    if not title or not description:
        return jsonify({'error': 'title and description are required'}), 400
    if len(title) > 500 or len(description) > 10000:
        return jsonify({'error': 'Field too long'}), 400

    import sqlite3
    conn = sqlite3.connect(_current_db_path)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO stories (title, description) VALUES (?, ?)", (title, description))
    story_id = cursor.lastrowid
    conn.commit()
    cursor.execute("SELECT id, title, description FROM stories WHERE id = ?", (story_id,))
    story = cursor.fetchone()
    conn.close()

    return jsonify({
        'id': story_id,
        'title': story[1],
        'description': story[2]
    }), 201


@stories_bp.route('/api/stories', methods=['GET'])
def get_stories():
    """Get all stories."""
    from app import _current_db_path

    import sqlite3
    conn = sqlite3.connect(_current_db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT id, title, description FROM stories ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    return jsonify([{
        'id': row[0],
        'title': row[1],
        'description': row[2]
    } for row in rows]), 200


@stories_bp.route('/api/stories/<int:story_id>', methods=['GET'])
def get_story(story_id: int):
    """Get a specific story."""
    from app import _current_db_path

    import sqlite3
    conn = sqlite3.connect(_current_db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT id, title, description FROM stories WHERE id = ?", (story_id,))
    story = cursor.fetchone()
    conn.close()

    if not story:
        return jsonify({'error': 'Story not found'}), 404

    return jsonify({
        'id': story[0],
        'title': story[1],
        'description': story[2]
    }), 200


@stories_bp.route('/api/stories/<int:story_id>', methods=['PUT'])
def update_story(story_id: int):
    """Update a story."""
    from app import _current_db_path

    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    title = data.get('title', '')
    description = data.get('description', '')
    if not title or not description:
        return jsonify({'error': 'title and description are required'}), 400
    if len(title) > 500 or len(description) > 10000:
        return jsonify({'error': 'Field too long'}), 400

    import sqlite3
    conn = sqlite3.connect(_current_db_path)
    cursor = conn.cursor()
    cursor.execute("UPDATE stories SET title = ?, description = ? WHERE id = ?", (title, description, story_id))
    if not cursor.rowcount:
        conn.close()
        return jsonify({'error': 'Story not found'}), 404
    conn.commit()
    cursor.execute("SELECT id, title, description FROM stories WHERE id = ?", (story_id,))
    story = cursor.fetchone()
    conn.close()

    return jsonify({
        'id': story[0],
        'title': story[1],
        'description': story[2]
    }), 200


@stories_bp.route('/api/stories/<int:story_id>', methods=['DELETE'])
def delete_story(story_id: int):
    """Delete a story."""
    from app import _current_db_path

    import sqlite3
    conn = sqlite3.connect(_current_db_path)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM stories WHERE id = ?", (story_id,))
    if not cursor.rowcount:
        conn.close()
        return jsonify({'error': 'Story not found'}), 404
    conn.commit()
    conn.close()
    return jsonify({'message': 'Story deleted'}), 200
