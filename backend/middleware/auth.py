from functools import wraps
from flask import request, jsonify
import os

def require_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        expected_key = os.environ.get('COPERNICUS_API_KEY')

        # If no key is set in environment, skip auth (dev mode)
        if not expected_key:
            return f(*args, **kwargs)

        provided_key = request.headers.get('X-API-Key')
        if not provided_key or provided_key != expected_key:
            return jsonify({"ok": False, "error": "Unauthorized"}), 401

        return f(*args, **kwargs)
    return decorated_function
