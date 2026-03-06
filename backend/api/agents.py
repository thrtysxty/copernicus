from flask import Blueprint, jsonify, request
from backend.middleware.auth import require_auth
from ollama import Client
import os

agents_bp = Blueprint("agents", __name__)

MODEL_MAP = {
    "junior-dev": "qwen2.5-coder:7b",
    "scribe": "mistral:7b",
    "code-reviewer": "deepseek-coder:6.7b",
}
DEFAULT_MODEL = "qwen2.5-coder:7b"


@agents_bp.route("/status", methods=["GET"])
@require_auth
def get_status():
    return jsonify({"ok": True, "data": {"sessions": []}}), 200


@agents_bp.route("/dispatch", methods=["POST"])
@require_auth
def dispatch_agent():
    data = request.get_json() or {}
    return jsonify({"ok": True, "data": {"queued": True, "details": data}}), 200


@agents_bp.route("/<agent_id>/stop", methods=["POST"])
@require_auth
def stop_agent(agent_id):
    return jsonify({"ok": True, "data": {"queued": True, "agent_id": agent_id}}), 200


@agents_bp.route("/research", methods=["POST"])
@require_auth
def research():
    data = request.get_json() or {}

    prompt = data.get("prompt")
    if not prompt:
        return jsonify({"ok": False, "error": "Prompt is required"}), 400

    persona = data.get("persona", "junior-dev")
    model = MODEL_MAP.get(persona, DEFAULT_MODEL)
    base_url = os.getenv("OLLAMA_BASE_URL", "http://192.168.1.185:11434")

    try:
        client = Client(host=base_url)
        response = client.chat(
            model=model,
            messages=[{"role": "user", "content": prompt}]
        )
        # ollama SDK returns an object, not a dict
        result = response.message.content

        return jsonify({
            "ok": True,
            "data": {
                "result": result,
                "model": model,
                "persona": persona,
            }
        }), 200
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500
