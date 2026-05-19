
# Security Audit Note (Story 248):
# No direct user-provided parameters in this file are passed to `open()`, `os.path`, or `Path()` in a way
# that would directly benefit from `assert_safe_path()`. Path constructions (e.g., for database, temporary files,
# or internal gateway scripts) are either internal to the application, derived from environment variables,
# or user home directory in a controlled manner. User prompts are treated as content, not file paths.
# The `get_db_path()` function resolves paths based on environment variables or project structure,
# and `research` endpoint's `history_path` is a securely created temporary file.
from backend.utils.errors import AppError
from flask import Blueprint, jsonify, request
from backend.limiter import limiter
from backend.middleware.auth import require_auth
from backend.utils.validate import validate
from backend.schemas.agents import ResetContextRequest, ContextHandoffRequest, ResearchRequest
import subprocess
import os
import re
import time
import uuid
import sqlite3
import threading
from contextlib import closing
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from pathlib import Path
from collections import OrderedDict
import json
import logging

logger = logging.getLogger(__name__)

# Constants for roles, models, and events
ROLE_SYSTEM = "system"
ROLE_USER = "user"
ROLE_ASSISTANT = "assistant"
ROLE_TOOL = "tool"

TYPE_MESSAGE = "message"
TYPE_TOOL_OUTPUT = "tool_output"

PERSONA_JUNIOR_DEV = "junior-dev"
PERSONA_SCRIBE = "scribe"
PERSONA_CODE_REVIEWER = "code-reviewer"

GATEWAY_ROLE_CODER = "coder"
GATEWAY_ROLE_RESEARCHER = "researcher"
GATEWAY_ROLE_ARCHITECT = "architect"


agents_bp = Blueprint("agents", __name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
GATEWAY_PATH = PROJECT_ROOT / "scripts" / "agent_gateway.py"

def get_db_path():
    """Returns the path to the Copernicus SQLite database."""
    # Priority: ENV > Default home location > Local repo location
    env_path = os.environ.get('COPERNICUS_DB_PATH')
    if env_path:
        return env_path
    
    home_path = os.path.expanduser('~/.copernicus/copernicus.db')
    if os.path.exists(home_path):
        return home_path
    
    local_path = PROJECT_ROOT / "copernicus" / "copernicus.db"
    return str(local_path.resolve())

# Map chat tool personas to agent gateway roles
PERSONA_ROLE_MAP = {
    PERSONA_JUNIOR_DEV: GATEWAY_ROLE_CODER,
    PERSONA_SCRIBE: GATEWAY_ROLE_RESEARCHER,
    PERSONA_CODE_REVIEWER: GATEWAY_ROLE_ARCHITECT,
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
    type: str = TYPE_MESSAGE  # e.g., 'message', 'tool_output'
    pinned: bool = False


class ContextManager:
    """
    In-memory context manager for sessions.
    - Tracks token usage per session.
    - Auto-prunes (keep system & recent tool outputs) when >80%.
    - Supports pinning, relevance scoring, and tiered pruning.
    - Thread-safe with RLock.
    - Max 100 sessions with TTL cleanup.
    """

    # Default token limits per tier (model size approximation)
    TOKEN_LIMITS = {
        "7b": 8192,
        "70b": 32768,
        "default": 8192,
    }

    # Relevance decay per hour (e.g., 0.2 = 20% per hour)
    DECAY_RATE = 0.2
    
    # Story 261: Session management constants
    MAX_SESSIONS = 100
    SESSION_TTL = 1800  # 30 minutes in seconds
    CLEANUP_INTERVAL = 300  # 5 minutes in seconds

    def __init__(self):
        # session_id -> OrderedDict of context items (ordered by insertion, but with pin priority for pruning)
        self._sessions: Dict[str, OrderedDict] = {}
        # session_id -> total token count
        self._token_counts: Dict[str, int] = {}
        # session_id -> last accessed timestamp
        self._last_accessed: Dict[str, float] = {}
        # Thread safety
        self._lock = threading.RLock()
        # Cleanup thread control
        self._stop_cleanup = threading.Event()
        self._cleanup_thread = threading.Thread(target=self._cleanup_expired_sessions, daemon=True)
        self._cleanup_thread.start()

    def _cleanup_expired_sessions(self):
        """Daemon thread that removes expired sessions every CLEANUP_INTERVAL."""
        while not self._stop_cleanup.is_set():
            time.sleep(self.CLEANUP_INTERVAL)
            if self._stop_cleanup.is_set():
                break
            self._remove_expired_sessions()

    def _remove_expired_sessions(self):
        """Remove sessions not accessed in SESSION_TTL seconds."""
        now = time.time()
        with self._lock:
            expired_sessions = [
                session_id for session_id, last_accessed in self._last_accessed.items()
                if now - last_accessed > self.SESSION_TTL
            ]
            for session_id in expired_sessions:
                self._sessions.pop(session_id, None)
                self._token_counts.pop(session_id, None)
                self._last_accessed.pop(session_id, None)

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
        with self._lock:
            if session_id not in self._sessions:
                # Story 261: Max session cap with LRU eviction (insertion-ordered)
                if len(self._sessions) >= self.MAX_SESSIONS:
                    # Evict oldest session (first inserted in OrderedDict)
                    oldest_session_id = next(iter(self._sessions))
                    self._sessions.pop(oldest_session_id, None)
                    self._token_counts.pop(oldest_session_id, None)
                    self._last_accessed.pop(oldest_session_id, None)
                
                self._sessions[session_id] = OrderedDict()
                self._token_counts[session_id] = 0
                self._last_accessed[session_id] = time.time()

    def add_item(self, session_id: str, item: ContextItem, model_name: Optional[str] = None) -> None:
        with self._lock:
            self.ensure_session(session_id, model_name)
            self._sessions[session_id][item.id] = item
            self._token_counts[session_id] += item.token_count
            # Story 261: Update last accessed
            self._last_accessed[session_id] = time.time()

            # Auto-prune if >80% limit
            limit = self._get_limit(model_name)
            if self._token_counts[session_id] > 0.8 * limit:
                self._prune(session_id, model_name)

    def get_items(self, session_id: str) -> List[ContextItem]:
        with self._lock:
            # Story 261: Update last accessed
            if session_id in self._sessions:
                self._last_accessed[session_id] = time.time()
            return list(self._sessions.get(session_id, {}).values())

    def _prune(self, session_id: str, model_name: Optional[str] = None) -> None:
        with self._lock:
            items = list(self._sessions[session_id].values())

            # Prioritize: pinned > system > tool outputs > others (latest first)
            # Group by priority
            pinned = [i for i in items if i.pinned]
            system = [i for i in items if i.role == ROLE_SYSTEM and not i.pinned]
            tools = [i for i in items if i.type == TYPE_TOOL_OUTPUT and not i.pinned and i.role != ROLE_SYSTEM]
            others = [i for i in items if i not in pinned and i not in system and i not in tools]

            # Re-sort others by timestamp descending (newest first)
            others.sort(key=lambda x: x.timestamp, reverse=True)

            # Combine: pinned + system + tools (latest first) + recent others
            prioritized = (
                pinned +
                system +
                tools +
                others  # we'll cut later
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
        with self._lock:
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
        with self._lock:
            session = self._sessions.get(session_id)
            if not session or item_id not in session:
                return False
            session[item_id].pinned = True
            return True

    def get_status(self, session_id: str) -> Dict[str, Any]:
        with self._lock:
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
        with self._lock:
            if session_id in self._sessions:
                del self._sessions[session_id]
            if session_id in self._token_counts:
                del self._token_counts[session_id]
            if session_id in self._last_accessed:
                del self._last_accessed[session_id]


# Instantiate context manager
context_manager = ContextManager()


# ---------- NEW ENDPOINTS ----------

@agents_bp.route("/context/status", methods=["GET"])
@require_auth
def get_context_status():
    session_id = request.args.get("session_id")
    model_name = request.args.get("model", None)

    if not session_id:
        raise AppError("session_id required", status=400)

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
        raise AppError("session_id and item_id required", status=400)

    success = context_manager.pin_item(session_id, item_id)
    if not success:
        raise AppError("Item or session not found", status=404)

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
        raise AppError("session_id required", status=400)

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
        PERSONA_JUNIOR_DEV: "You are a capable junior developer. Explain code clearly and concisely.",
        PERSONA_SCRIBE: "You are a technical writer. Respond in clear, structured markdown.",
        PERSONA_CODE_REVIEWER: "You are an expert code reviewer. Focus on correctness, maintainability, and best practices.",
    }
    system_content = system_prompts.get(persona, "You are an helpful assistant.")

    # Add system item if not already present
    system_item = next((i for i in items if i.role == ROLE_SYSTEM), None)
    if not system_item:
        system_item = ContextItem(
            id=f"sys_{session_id}",
            role=ROLE_SYSTEM,
            content=system_content,
            token_count=len(system_content.split()),
            type=TYPE_MESSAGE,
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
        if item.type == TYPE_TOOL_OUTPUT:
            msg["tool_role"] = ROLE_TOOL  # optional extension
        messages.append(msg)

    return {
        "messages": messages,
        "new_message": {
            "role": ROLE_USER,
            "content": prompt,
        },
    }


@agents_bp.route("/research", methods=["POST"])
@require_auth
@limiter.limit("10 per minute")
@validate(ResearchRequest)
def research(request_data: ResearchRequest):
    prompt = request_data.prompt
    if prompt.lstrip().startswith('-') or '\x00' in prompt:
        return jsonify({'error': 'Invalid prompt'}), 400
    persona = request_data.persona
    role = PERSONA_ROLE_MAP.get(persona, request_data.role or GATEWAY_ROLE_CODER)

    session_id = request_data.session_id or str(uuid.uuid4())
    model_name = request_data.model

    # Ensure session and generate context-aware payload
    payload = _add_context_to_payload(session_id, persona, prompt, model_name)

    # Pass full chat context to gateway (via JSON file)
    # Do NOT include prompt in command-line args — only in history file.
    import tempfile

    with tempfile.NamedTemporaryFile(mode="w+", suffix=".json", delete=False) as f:
        json.dump(payload, f)
        history_path = f.name
    os.chmod(history_path, 0o600)

    try:
        # Clean command-line args: prompt moved into history JSON, so omit it from args
        result = subprocess.run(
            [
                "python3", str(GATEWAY_PATH),
                "--role", role,
                "--no-stream",
                "--history", history_path,
                "--context-id", session_id,
            ],
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
            role=ROLE_ASSISTANT,
            content=assistant_output,
            token_count=len(assistant_output.split()),
            type=TYPE_MESSAGE,
        )

        # Record user query too (if not already present)
        user_item = ContextItem(
            id=str(uuid.uuid4()),
            role=ROLE_USER,
            content=prompt,
            token_count=len(prompt.split()),
            type=TYPE_MESSAGE,
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
        raise AppError("Research timed out after 120s", status=504)
    except Exception as e:
        raise AppError(str(e))
    finally:
        # Cleanup temp file
        try:
            os.unlink(history_path)
        except OSError:
            pass


@agents_bp.route("/context/reset", methods=["POST"])
@require_auth
@validate(ResetContextRequest)
def reset_context(request_data: ResetContextRequest):
    """
    Optional endpoint: reset context for session (e.g., new task).
    """
    session_id = request_data.session_id

    context_manager.reset_session(session_id)
    return jsonify({"ok": True, "data": {"session_id": session_id, "reset": True}}), 200


@agents_bp.route("/context/handoff", methods=["POST"])
@require_auth
@validate(ContextHandoffRequest)
def context_handoff(request_data: ContextHandoffRequest):
    """
    AC-2: Cross-Model "Context Handoff"
    Pulls the Top 5 most relevant RAG chunks from the previous agent's session.
    """
    session_id = request_data.session_id
    story_id = request_data.story_id

    db_path = get_db_path()
    try:
        if not os.path.exists(db_path):
             return jsonify({"ok": True, "data": {"context": None}, TYPE_MESSAGE: f"DB not found at {db_path}"}), 200

        with closing(sqlite3.connect(db_path)) as conn:
            conn.execute('PRAGMA foreign_keys = ON')
            conn.execute('PRAGMA journal_mode = WAL')
            conn.execute('PRAGMA synchronous = NORMAL')
            cursor = conn.cursor()
            
            # Pull from jules_sessions if story_id provided, or by session_id
            if story_id:
                cursor.execute("SELECT last_search_context FROM jules_sessions WHERE story_id = ? AND last_search_context IS NOT NULL ORDER BY started_at DESC LIMIT 1", (story_id,))
            else:
                cursor.execute("SELECT last_search_context FROM jules_sessions WHERE id = ? LIMIT 1", (session_id,))
                
            row = cursor.fetchone()

        if row and row[0]:
            context = row[0]
            # Pre-inject into current session's context manager
            if session_id:
                handoff_item = ContextItem(
                    id=f"handoff_{int(time.time())}",
                    role=ROLE_SYSTEM,
                    content=f"[HANDOFF CONTEXT]\nPrior relevant chunks:\n{context}",
                    token_count=len(context.split()),
                    type=TYPE_MESSAGE,
                    pinned=True
                )
                context_manager.add_item(session_id, handoff_item)
            
            return jsonify({"ok": True, "data": {"context": context}}), 200
        else:
            return jsonify({"ok": True, "data": {"context": None}, TYPE_MESSAGE: "No handoff context found"}), 200

    except Exception as e:
        raise AppError(str(e))
