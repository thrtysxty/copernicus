"""Context manager with session pruning."""

import time
from typing import Dict, Optional
from flask import Blueprint, request, jsonify

# Configuration
MAX_SESSIONS = int(__import__('os').environ.get('MAX_SESSIONS', '100'))


class ContextManager:
    """Manages sessions with automatic pruning."""

    def __init__(self):
        self._sessions: Dict[str, dict] = {}
        self._access_times: Dict[str, float] = {}
        self._lock = __import__('threading').Lock()

    def create_session(self, session_id: str, data: dict) -> tuple:
        """Create a new session. Returns (success, error_message)."""
        with self._lock:
            # Check if we need to prune
            if len(self._sessions) >= MAX_SESSIONS:
                self._prune()

            # Check if session already exists
            if session_id in self._sessions:
                return False, f"Session {session_id} already exists"

            self._sessions[session_id] = data
            self._access_times[session_id] = time.time()
            return True, None

    def get_session(self, session_id: str) -> Optional[dict]:
        """Get session data."""
        with self._lock:
            return self._sessions.get(session_id)

    def delete_session(self, session_id: str) -> bool:
        """Delete a session."""
        with self._lock:
            if session_id in self._sessions:
                del self._sessions[session_id]
                del self._access_times[session_id]
                return True
            return False

    def _prune(self):
        """Prune oldest sessions when limit is exceeded."""
        if len(self._sessions) < MAX_SESSIONS:
            return

        # Sort by access time (oldest first)
        sorted_sessions = sorted(
            self._sessions.items(),
            key=lambda x: self._access_times.get(x[0], 0)
        )

        # Remove oldest sessions, keeping active (most recent) one
        to_remove = sorted_sessions[:-1]  # Keep last (most recent)

        for session_id, _ in to_remove:
            del self._sessions[session_id]
            del self._access_times[session_id]

    def list_sessions(self) -> list:
        """List all sessions."""
        with self._lock:
            return list(self._sessions.keys())


def prune_expired_sessions():
    """Remove sessions that haven't been accessed recently."""
    # This would be called periodically to clean up stale sessions
    pass


# Global instance
context_manager = ContextManager()


context_bp = Blueprint('context', __name__, url_prefix='/api/context')


@context_bp.route('/create', methods=['POST'])
def create_session():
    """Create a new session."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    session_id = data.get('session_id', '')
    session_data = data.get('data', {})

    success, error = context_manager.create_session(session_id, session_data)

    if not success:
        return jsonify({'error': error}), 409

    return jsonify({
        'session_id': session_id,
        'status': 'created'
    }), 201


@context_bp.route('/<session_id>', methods=['GET'])
def get_session(session_id: str):
    """Get a specific session."""
    session = context_manager.get_session(session_id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404
    return jsonify({'session_id': session_id, 'data': session}), 200


@context_bp.route('/<session_id>', methods=['DELETE'])
def delete_session(session_id: str):
    """Delete a session."""
    success = context_manager.delete_session(session_id)
    if not success:
        return jsonify({'error': 'Session not found'}), 404
    return jsonify({'message': 'Session deleted'}), 200


@context_bp.route('/', methods=['GET'])
def list_sessions():
    """List all sessions."""
    sessions = context_manager.list_sessions()
    return jsonify({'sessions': sessions, 'count': len(sessions)}), 200