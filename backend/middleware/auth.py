from functools import wraps
from flask import request, jsonify
import os
import logging

logger = logging.getLogger(__name__)

def require_auth(f):
    """
    Authentication middleware for protecting backend routes.

    Requires COPERNICUS_API_KEY to be set in the environment.
    If the key is not set, returns 503 Service Unavailable with
    a warning rather than silently bypassing authentication.

    Note: codebase-memory-mcp graph incorrectly reported zero inbound callers
    for this function. It is actively used to decorate routes in stories.py,
    notebooklm.py, settings.py, llm.py, and agents.py.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        expected_key = os.environ.get('COPERNICUS_API_KEY')

        # If no key is set, refuse requests rather than silently bypassing
        if not expected_key:
            logger.warning(
                "[auth] COPERNICUS_API_KEY not set — refusing request. "
                "Set this environment variable to enable backend authentication. "
                "For local development, set it to any non-empty value."
            )
            return jsonify({
                "ok": False,
                "error": "Server misconfiguration: API key not set. Set COPERNICUS_API_KEY environment variable."
            }), 503

        provided_key = request.headers.get('X-API-Key')
        if not provided_key or provided_key != expected_key:
            return jsonify({"ok": False, "error": "Unauthorized"}), 401

        return f(*args, **kwargs)
    return decorated_function
