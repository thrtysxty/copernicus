"""Docs endpoints with path traversal protection."""

import re
from pathlib import Path
from flask import Blueprint, request, jsonify

ALLOWED_ROOT = Path(__file__).parent.parent.parent  # copernicus directory


def sanitize_path(path: str) -> str:
    """Sanitize path to prevent traversal attacks."""
    if not path:
        return ''

    # Remove null bytes (case-insensitive for %00 variants)
    path = path.replace('\x00', '')
    path = re.sub(r'%00', '', path, flags=re.IGNORECASE)

    # Check for .. sequences in original path
    if '..' in path:
        return ''

    # Check for null bytes (defense in depth)
    if '\x00' in path or re.search(r'%00', path, re.IGNORECASE):
        return ''

    # Resolve to absolute path
    try:
        # Decode URL encoding
        decoded = path.encode('utf-8', errors='replace').decode('utf-8', errors='replace')
        resolved = Path(decoded).resolve()
    except (ValueError, OSError):
        return ''

    # Check if path escapes allowed root
    try:
        resolved.relative_to(ALLOWED_ROOT)
    except ValueError:
        # Path escapes root
        return ''

    return str(resolved)


docs_bp = Blueprint('docs', __name__, url_prefix='/docs')


@docs_bp.route('/', methods=['GET'])
def index():
    """Docs index."""
    return jsonify({'status': 'ok', 'message': 'Documentation endpoint'}), 200


@docs_bp.route('/<path:path>', methods=['GET'])
def get_doc(path: str):
    """Get documentation file."""
    safe_path = sanitize_path(path)

    if not safe_path:
        return jsonify({'error': 'Access denied'}), 403

    # Check if file exists (optional - currently just returns 404 for all)
    # In production, this would serve actual files
    return jsonify({'status': 'not_found', 'path': safe_path}), 404


@docs_bp.route('/readme', methods=['GET'])
def readme():
    """Readme endpoint."""
    return jsonify({'title': 'README', 'content': 'Documentation content'}), 200


@docs_bp.route('/api', methods=['GET'])
def api_docs():
    """API documentation."""
    return jsonify({
        'endpoints': [
            {'path': '/docs/readme', 'method': 'GET'},
            {'path': '/docs/api', 'method': 'GET'},
        ]
    }), 200