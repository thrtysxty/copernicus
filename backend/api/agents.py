from flask import Blueprint, jsonify, request
from backend.middleware.auth import require_auth

agents_bp = Blueprint('agents', __name__)

@agents_bp.route('/status', methods=['GET'])
@require_auth
def get_status():
    return jsonify({"ok": True, "data": {"sessions": []}}), 200

@agents_bp.route('/dispatch', methods=['POST'])
@require_auth
def dispatch_agent():
    data = request.get_json() or {}
    return jsonify({"ok": True, "data": {"queued": True, "details": data}}), 200

@agents_bp.route('/<agent_id>/stop', methods=['POST'])
@require_auth
def stop_agent(agent_id):
    return jsonify({"ok": True, "data": {"queued": True, "agent_id": agent_id}}), 200
