from flask import Blueprint, jsonify, request
from backend.middleware.auth import require_auth
import subprocess
import os
from pathlib import Path

agents_bp = Blueprint("agents", __name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
GATEWAY_PATH = PROJECT_ROOT / "scripts" / "agent_gateway.py"

# Map chat tool personas to agent gateway roles
PERSONA_ROLE_MAP = {
    "junior-dev": "coder",
    "scribe": "researcher",
    "code-reviewer": "architect",
}


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
    role = PERSONA_ROLE_MAP.get(persona, "coder")

    try:
        result = subprocess.run(
            ["python3", str(GATEWAY_PATH), prompt, "--role", role, "--no-stream"],
            capture_output=True,
            text=True,
            timeout=120,
            env={**os.environ},
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or f"Gateway exited with code {result.returncode}")

        return jsonify({
            "ok": True,
            "data": {
                "result": result.stdout.strip(),
                "role": role,
                "persona": persona,
            }
        }), 200
    except subprocess.TimeoutExpired:
        return jsonify({"ok": False, "error": "Research timed out after 120s"}), 504
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500
