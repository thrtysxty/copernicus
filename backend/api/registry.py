import json
import os
from flask import Blueprint, jsonify
from backend.utils.validate import validate
from backend.schemas.registry import ReloadRequest
import logging

logger = logging.getLogger(__name__)

registry_bp = Blueprint('registry', __name__)

# Module-level cache
_registry_data = None

def load_registry():
    global _registry_data
    # In a real app, we'd use a more robust path resolution
    base_dir = os.path.dirname(os.path.dirname(__file__))
    registry_path = os.path.join(base_dir, 'agent_registry.json')
    try:
        with open(registry_path, 'r') as f:
            _registry_data = json.load(f)
        return True
    except Exception as e:
        logger.error("Error loading registry: %s", e)
        return False

# Initial load
load_registry()

@registry_bp.route('/models', methods=['GET'])
def get_models():
    if _registry_data is None:
        return jsonify({"error": "Registry not loaded"}), 500
    return jsonify(_registry_data.get('models', []))

@registry_bp.route('/models/<model_id>', methods=['GET'])
def get_model(model_id):
    if not model_id or not isinstance(model_id, str) or not model_id.strip():
        return jsonify({"error": "Validation failed", "detail": ["model_id must be a non-empty string"]}), 422
    if _registry_data is None:
        return jsonify({"error": "Registry not loaded"}), 500
    models = _registry_data.get('models', [])
    model = next((m for m in models if m['id'] == model_id), None)
    if model:
        return jsonify(model)
    return jsonify({"error": "Model not found"}), 404

@registry_bp.route('/personas', methods=['GET'])
def get_personas():
    if _registry_data is None:
        return jsonify({"error": "Registry not loaded"}), 500
    return jsonify(_registry_data.get('personas', []))

@registry_bp.route('/personas/<alias>', methods=['GET'])
def get_persona(alias):
    if not alias or not isinstance(alias, str) or not alias.strip():
        return jsonify({"error": "Validation failed", "detail": ["alias must be a non-empty string"]}), 422
    if _registry_data is None:
        return jsonify({"error": "Registry not loaded"}), 500
    personas = _registry_data.get('personas', [])
    persona = next((p for p in personas if p['alias'] == alias), None)
    if persona:
        return jsonify(persona)
    return jsonify({"error": "Persona not found"}), 404

@registry_bp.route('/reload', methods=['POST'])
@validate(ReloadRequest)
def reload_registry(request_data: ReloadRequest):
    if load_registry():
        return jsonify({"message": "Registry reloaded successfully"})
    return jsonify({"error": "Failed to reload registry"}), 500
