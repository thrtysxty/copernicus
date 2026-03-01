from flask import Blueprint, jsonify, request
import os
import json
from backend.middleware.auth import require_auth

settings_bp = Blueprint('settings', __name__)

def get_settings_path():
    return os.environ.get('COPERNICUS_SETTINGS_PATH', os.path.expanduser('~/.copernicus/settings.json'))

@settings_bp.route('', methods=['GET'])
@require_auth
def get_settings():
    settings_path = get_settings_path()
    try:
        if os.path.exists(settings_path):
            with open(settings_path, 'r') as f:
                settings = json.load(f)
        else:
            settings = {}
        return jsonify({"ok": True, "data": settings}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@settings_bp.route('', methods=['PUT'])
@require_auth
def update_settings():
    settings_path = get_settings_path()
    try:
        data = request.get_json() or {}

        # Merge with existing settings
        settings = {}
        if os.path.exists(settings_path):
            with open(settings_path, 'r') as f:
                try:
                    settings = json.load(f)
                except json.JSONDecodeError:
                    pass

        settings.update(data)

        os.makedirs(os.path.dirname(settings_path), exist_ok=True)
        with open(settings_path, 'w') as f:
            json.dump(settings, f, indent=2)

        return jsonify({"ok": True, "data": settings}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500
