from flask import Blueprint, jsonify, request
from backend.middleware.auth import require_auth
import subprocess
import os
import re
import time
import uuid
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from pathlib import Path
from collections import OrderedDict

agents_bp = Blueprint("agents", __name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
GATEWAY_PATH = PROJECT_ROOT / "scripts" / "agent_gateway.py"

# Map chat tool personas to agent gateway roles
PERSONA_ROLE_MAP = {
    "junior-dev": "coder",
    "scribe": "researcher",
    "code-reviewer": "architect",
}

# Model tier detection (case-insensitive, supports e.g., :7b, :70b, -7b, etc.)
MODEL_TIER_PATTERN = re.compile(r'[:_-]?(7|70)b', re.IGNORECASE)


@dataclass
class ContextItem:
    id: str
    role: str  # 'system', 'user', 'assistant', 'tool'
    content: str
    timestamp: float = field(default_factory=time.time)
    token_count: int = 0
    type: str = "message"  # e.g., 'message', 'tool_output'
    pinned: bool = False


class ContextManager:
    """
    In-memory context manager for sessions.
    - Tracks token usage per session.
    - Auto-prunes (keep system & recent tool outputs) when >80%.
    - Supports pinning, relevance scoring, and tiered pruning.
    """

    # Default token limits per tier (model size approximation)
    TOKEN_LIMITS = {
        "7b": 8192,
        "70b": 32768,
        "default": 8192,
    }

    # Relevance decay per hour (e.g., 0.2 = 20% per hour)
    DECAY_RATE = 0.2

    def __init__(self):
        # session_id -> OrderedDict of context items (ordered by insertion, but with pin priority for pruning)
        self._sessions: Dict[str, OrderedDict] = {}
        # session_id -> total token count
        self._token_counts: Dict[str, int] = {}

    def _get_tier(self, model_name: Optional[str] = None) -> str:
        if not model_name:
            return "default"
        match = MODEL_TIER_PATTERN.search(model_name)
        if match:
            tier = match.group(1)  # "7" or "70"
            return f"{tier}b"
        return "default"

    def _get_limit(self, model_name: Optional[str] = None) -> int:
        tier = self._get_tier(model_name)
        return self.TOKEN_LIMITS.get(tier, self.TOKEN_LIMITS["default"])

    def _prune_aggressiveness(self, model_name: Optional[str] = None) -> float:
        """
        Aggressiveness factor: higher model → keep more.
        7B: prune to 70% (keep 30%); 70B: prune to 90% (keep 10%).
        """
        tier = self._get_tier(model_name)
        if tier == "7b":
            return 0.70  # keep 70% of content after pruning
        elif tier == "70b":
            return 0.90  # keep 90%
        return 0.80

    def ensure_session(self, session_id: str, model_name: Optional[str] = None) -> None:
        if session_id not in self._sessions:
            self._sessions[session_id] = OrderedDict()
            self._token_counts[session_id] = 0

    def add_item(self, session_id: str, item: ContextItem, model_name: Optional[str] = None) -> None:
        self.ensure_session(session_id, model_name)
        self._sessions[session_id][item.id] = item
        self._token_counts[session_id] += item.token_count

        # Auto-prune if >80% limit
        limit = self._get_limit(model_name)
        if self._token_counts[session_id] > 0.8 * limit:
            self._prune(session_id, model_name)

    def get_items(self, session_id: str) -> List[ContextItem]:
        return list(self._sessions.get(session_id, {}).values())

    def _prune(self, session_id: str, model_name: Optional[str] = None) -> None:
        items = list(self._sessions[session_id].values())

        # Prioritize: pinned > system > tool outputs > others (latest first)
        # Group by priority
        pinned = [i for i in items if i.pinned]
        system = [i for i in items if i.role == "system" and not i.pinned]
        tools = [i for i in items if i.type == "tool_output" and not i.pinned and i.role != "system"]
        others = [i for i in items if i not in pinned and i not in system and i not in tools]

        # Re-sort others by timestamp descending (newest first)
        others.sort(key=lambda x: x.timestamp, reverse=True)

        # Combine: pinned + system + tools (latest first) + recent others
        prioritized = (
            pinned +
            system +
            tools +
            others  # we’ll cut later
        )

        # Find cutoff based on limit and aggressiveness
        limit = self._get_limit(model_name)
        target = int(self._prune_aggressiveness(model_name) * limit)

        total_tokens = sum(i.token_count for i in prioritized)
        if total_tokens <= target:
            return

        kept_items: List[ContextItem] = []
        kept_tokens = 0

        for item in prioritized:
            if kept_tokens + item.token_count <= target:
                kept_items.append(item)
                kept_tokens += item.token_count
            else:
                break

        # Update session state
        self._sessions[session_id] = OrderedDict()
        for item in kept_items:
            self._sessions[session_id][item.id] = item
        self._token_counts[session_id] = kept_tokens

    def get_relevance_score(self, session_id: str, task_keywords: List[str]) -> Dict[str, float]:
        """
        Score each context item by:
          - recency: exp(-decay * age_hours)
          - keyword overlap: cosine-like (simplified: overlap / len(task_keywords))
        """
        if not task_keywords:
            return {item.id: 1.0 for item in self._sessions.get(session_id, {}).values()}

        scores: Dict[str, float] = {}
        now = time.time()
        items = self.get_items(session_id)

        for item in items:
            # Recency score
            age_hours = (now - item.timestamp) / 3600.0
            recency = max(0.0, 1.0 - self.DECAY_RATE * age_hours)

            # Keyword overlap (simple Jaccard-like)
            content_tokens = set(item.content.lower().split())
            task_tokens = set(task_keywords)
            overlap = len(content_tokens & task_tokens)
            keyword_score = overlap / len(task_keywords) if task_keywords else 0.0

            # Combine: weighted average (can tune weights)
            scores[item.id] = 0.6 * recency + 0.4 * keyword_score

        return scores

    def pin_item(self, session_id: str, item_id: str) -> bool:
        session = self._sessions.get(session_id)
        if not session or item_id not in session:
            return False
        session[item_id].pinned = True
        return True

    def get_status(self, session_id: str) -> Dict[str, Any]:
        if session_id not in self._sessions:
            return {"session_id": session_id, "active": False}
        items = list(self._sessions[session_id].values())
        return {
            "session_id": session_id,
            "active": True,
            "token_count": self._token_counts.get(session_id, 0),
            "item_count": len(items),
            "pinned_count": sum(1 for i in items if i.pinned),
            "last_updated": max((i.timestamp for i in items), default=0.0),
        }

    def reset_session(self, session_id: str) -> None:
        if session_id in self._sessions:
            del self._sessions[session_id]
        if session_id in self._token_counts:
            del self._token_counts[session_id]


# Instantiate context manager
context_manager = ContextManager()


# ---------- NEW ENDPOINTS ----------

@agents_bp.route("/context/status", methods=["GET"])
@require_auth
def get_context_status():
    session_id = request.args.get("session_id")
    model_name = request.args.get("model", None)

    if not session_id:
        return jsonify({"ok": False, "error": "session_id required"}), 400

    # Ensure session exists (if not, return empty status)
    context_manager.ensure_session(session_id, model_name)

    status = context_manager.get_status(session_id)
    return jsonify({"ok": True, "data": status}), 200


@agents_bp.route("/context/pin", methods=["POST"])
@require_auth
def pin_context_item():
    data = request.get_json() or {}
    session_id = data.get("session_id")
    item_id = data.get("item_id")

    if not session_id or not item_id:
        return jsonify({"ok": False, "error": "session_id and item_id required"}), 400

    success = context_manager.pin_item(session_id, item_id)
    if not success:
        return jsonify({"ok": False, "error": "Item or session not found"}), 404

    return jsonify({"ok": True, "data": {"pinned": True}}), 200


@agents_bp.route("/context/relevance", methods=["POST"])
@require_auth
def get_context_relevance():
    """
    GET relevance score for items in session, given a task query.
    Body: { session_id, task_query }
    """
    data = request.get_json() or {}
    session_id = data.get("session_id")
    task_query = data.get("task_query", "")

    if not session_id:
        return jsonify({"ok": False, "error": "session_id required"}), 400

    context_manager.ensure_session(session_id)

    keywords = [w.lower() for w in task_query.split() if len(w) > 2]
    scores = context_manager.get_relevance_score(session_id, keywords)

    # Sort by score descending
    ranked = [
        {"item_id": item_id, "score": round(score, 4)}
        for item_id, score in sorted(scores.items(), key=lambda x: x[1], reverse=True)
    ]

    return jsonify({"ok": True, "data": {"session_id": session_id, "items": ranked}}), 200


# ---------- INTEGRATION INTO RESEARCH FLOW ----------

def _add_context_to_payload(
    session_id: str,
    persona: str,
    prompt: str,
    model_name: Optional[str] = None,
    context_items: Optional[List[ContextItem]] = None,
) -> Dict[str, Any]:
    """
    Adds contextual items to payload for gateway (e.g., as chat history).
    Prunes context if needed before adding.
    """
    # Ensure session exists (for auto-pruning or reusing context)
    context_manager.ensure_session(session_id, model_name)

    # Get or compute relevance? For now, just get items (already pruned on add)
    items = context_manager.get_items(session_id)

    # Prepend system instruction (if persona -> system prompt mapping exists)
    system_prompts = {
        "junior-dev": "You are a capable junior developer. Explain code clearly and concisely.",
        "scribe": "You are a technical writer. Respond in clear, structured markdown.",
        "code-reviewer": "You are an expert code reviewer. Focus on correctness, maintainability, and best practices.",
    }
    system_content = system_prompts.get(persona, "You are an helpful assistant.")

    # Add system item if not already present
    system_item = next((i for i in items if i.role == "system"), None)
    if not system_item:
        system_item = ContextItem(
            id=f"sys_{session_id}",
            role="system",
            content=system_content,
            token_count=len(system_content.split()),
            type="message",
        )
        context_manager.add_item(session_id, system_item, model_name=model_name)
        items = [system_item] + items  # prepend for gateway order

    # For gateway, build messages array
    messages = []
    for item in items:
        msg = {
            "role": item.role,
            "content": item.content,
        }
        if item.type == "tool_output":
            msg["tool_role"] = "tool"  # optional extension
        messages.append(msg)

    return {
        "messages": messages,
        "new_message": {
            "role": "user",
            "content": prompt,
        },
    }


@agents_bp.route("/research", methods=["POST"])
@require_auth
def research():
    data = request.get_json() or {}

    prompt = data.get("prompt")
    if not prompt:
        return jsonify({"ok": False, "error": "Prompt is required"}), 400

    persona = data.get("persona", "junior-dev")
    role = PERSONA_ROLE_MAP.get(persona, "coder")

    session_id = data.get("session_id", str(uuid.uuid4()))
    model_name = data.get("model", None)

    # Ensure session and generate context-aware payload
    payload = _add_context_to_payload(session_id, persona, prompt, model_name)

    # Pass full chat context to gateway (via JSON file or env)
    # For now, serialize messages & new_message as a JSON string passed as --history
    import json
    import tempfile

    with tempfile.NamedTemporaryFile(mode="w+", suffix=".json", delete=False) as f:
        json.dump(payload, f)
        history_path = f.name

    try:
        result = subprocess.run(
            ["python3", str(GATEWAY_PATH), prompt, "--role", role, "--no-stream", "--history", history_path],
            capture_output=True,
            text=True,
            timeout=120,
            env={**os.environ, "AGENT_SESSION_ID": session_id},
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or f"Gateway exited with code {result.returncode}")

        # Parse output and record assistant response
        assistant_output = result.stdout.strip()
        response_item = ContextItem(
            id=str(uuid.uuid4()),
            role="assistant",
            content=assistant_output,
            token_count=len(assistant_output.split()),
            type="message",
        )

        # Record user query too (if not already present)
        user_item = ContextItem(
            id=str(uuid.uuid4()),
            role="user",
            content=prompt,
            token_count=len(prompt.split()),
            type="message",
        )

        # Add both to context (may trigger pruning)
        context_manager.add_item(session_id, user_item, model_name=model_name)
        context_manager.add_item(session_id, response_item, model_name=model_name)

        return jsonify({
            "ok": True,
            "data": {
                "result": assistant_output,
                "role": role,
                "persona": persona,
                "session_id": session_id,
            }
        }), 200
    except subprocess.TimeoutExpired:
        return jsonify({"ok": False, "error": "Research timed out after 120s"}), 504
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500
    finally:
        # Cleanup temp file
        try:
            os.unlink(history_path)
        except OSError:
            pass


@agents_bp.route("/context/reset", methods=["POST"])
@require_auth
def reset_context():
    """
    Optional endpoint: reset context for session (e.g., new task).
    """
    data = request.get_json() or {}
    session_id = data.get("session_id")

    if not session_id:
        return jsonify({"ok": False, "error": "session_id required"}), 400

    context_manager.reset_session(session_id)
    return jsonify({"ok": True, "data": {"session_id": session_id, "reset": True}}), 200
