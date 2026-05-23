"""Stories endpoints."""

from flask import Blueprint, request, jsonify

# Import database path from app module
from app import DATABASE_PATH

stories_bp = Blueprint('stories', __name__)


def get_db_path():
    """Get database path."""
    return str(DATABASE_PATH)


@stories_bp.route('/api/stories', methods=['POST'])
def create_story():
    """Create a new story."""
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
    conn = sqlite3.connect(get_db_path())
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
    import sqlite3
    conn = sqlite3.connect(get_db_path())
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
    import sqlite3
    conn = sqlite3.connect(get_db_path())
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
    conn = sqlite3.connect(get_db_path())
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
    import sqlite3
    conn = sqlite3.connect(get_db_path())
    cursor = conn.cursor()
    cursor.execute("DELETE FROM stories WHERE id = ?", (story_id,))
    if not cursor.rowcount:
        conn.close()
        return jsonify({'error': 'Story not found'}), 404
    conn.commit()
    conn.close()
    return jsonify({'message': 'Story deleted'}), 200
