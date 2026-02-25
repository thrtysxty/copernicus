# Execution Plan 001: Runtime Blockers
**Sprint:** 0 — Must complete before any other sprint
**Agent Role:** Senior Developer (Python)
**Story:** 101 (C-1, C-2, C-7, C-8)
**Date Authored:** 2026-02-25

---

## Context

The COPERNICUS platform cannot start. Three independent entry points import a missing module.
A fourth critical method is called but never defined. The backend entry point is absent.
The Makefile deploys to the wrong remote path.

This plan addresses all 4 blockers sequentially. Complete them in order.

---

## Prerequisites

Before starting, verify your environment:

```bash
cd ~/Projects/agentic-platform
python --version          # Must be 3.11+
source .venv/bin/activate # or however venv is activated
python -c "import flask"  # Must import cleanly
```

---

## Task 1: Create `UnifiedAgentBridge` Module (C-1)

### Problem

`scripts/agent_cli.py:22`, `scripts/agent_tui.py:51`, `scripts/agent_console.py:7` all execute:

```python
from unified_agent_bridge import UnifiedAgentBridge
```

The module `unified_agent_bridge` does not exist. All CLI entry points fail with
`ModuleNotFoundError` at startup.

### Implementation

Create the file `scripts/unified_agent_bridge.py` with the following content.
Study `scripts/agent_tui.py` and `scripts/agent_cli.py` FIRST to understand
the methods they call on `UnifiedAgentBridge` before writing, so the interface
matches exactly.

**Step 1: Audit the call sites.**

Read `scripts/agent_cli.py` in full.
Read `scripts/agent_tui.py` lines 1–120 to find every method called on the bridge.
Read `scripts/agent_console.py` in full.

Record every method name and its arguments. You will implement each one.

**Step 2: Implement `scripts/unified_agent_bridge.py`.**

The class must provide at minimum:
- `__init__(self, config_path: Optional[str] = None)` — load config from
  `claude_mcp_config.json` or the provided path.
- `connect(self) -> bool` — establish connection to MCP server or return
  `True` in stub mode.
- `disconnect(self)` — clean up.
- `send_message(self, message: str, agent_id: str = "default") -> str` — send
  a message and return the response. In stub mode, return
  `f"[UnifiedAgentBridge stub] Received: {message}"`.
- Any other methods discovered in Step 1.

Minimal working implementation (fill in real logic once blockers are cleared):

```python
"""
UnifiedAgentBridge — Canonical multi-agent communication layer.

Provides a unified interface to the MCP server and any registered agent backends.
This module is imported by agent_cli.py, agent_tui.py, and agent_console.py.
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)


class UnifiedAgentBridgeError(Exception):
    """Raised when the bridge cannot connect or communicate."""


class UnifiedAgentBridge:
    """Unified interface to the multi-agent orchestration layer."""

    DEFAULT_CONFIG = Path(__file__).parent.parent / "claude_mcp_config.json"

    def __init__(self, config_path: Optional[str] = None) -> None:
        self._config_path = Path(config_path) if config_path else self.DEFAULT_CONFIG
        self._config: dict[str, Any] = {}
        self._connected: bool = False
        self._load_config()

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def _load_config(self) -> None:
        if self._config_path.exists():
            with open(self._config_path, "r", encoding="utf-8") as fh:
                self._config = json.load(fh)
            logger.debug("Loaded bridge config from %s", self._config_path)
        else:
            logger.warning(
                "Config file not found at %s; running in stub mode.", self._config_path
            )

    def connect(self) -> bool:
        """Establish connection to backend services.

        Returns True on success. Does not raise; failures are logged.
        """
        try:
            # TODO(story-102): implement real MCP connection
            self._connected = True
            logger.info("UnifiedAgentBridge connected (stub mode).")
            return True
        except Exception as exc:  # noqa: BLE001
            logger.error("UnifiedAgentBridge.connect() failed: %s", exc)
            self._connected = False
            return False

    def disconnect(self) -> None:
        """Release all connections cleanly."""
        self._connected = False
        logger.info("UnifiedAgentBridge disconnected.")

    # ------------------------------------------------------------------
    # Messaging
    # ------------------------------------------------------------------

    def send_message(
        self,
        message: str,
        agent_id: str = "default",
        context: Optional[dict[str, Any]] = None,
    ) -> str:
        """Send a message to the specified agent and return its response."""
        if not self._connected:
            raise UnifiedAgentBridgeError("Bridge is not connected. Call connect() first.")
        # TODO(story-102): implement real message routing via MCP
        stub_response = f"[stub:{agent_id}] {message}"
        logger.debug("send_message agent=%s message=%r response=%r", agent_id, message, stub_response)
        return stub_response

    def get_status(self) -> dict[str, Any]:
        """Return current bridge status for health checks."""
        return {
            "connected": self._connected,
            "config_path": str(self._config_path),
            "stub_mode": True,  # TODO(story-102): set False when real impl done
        }

    # ------------------------------------------------------------------
    # Context helpers (consumed by agent_tui)
    # ------------------------------------------------------------------

    def get_agent_list(self) -> list[str]:
        """Return list of registered agent IDs."""
        # TODO(story-102): query MCP for registered agents
        return ["claude", "gemini", "jules"]

    def __repr__(self) -> str:
        return f"UnifiedAgentBridge(connected={self._connected}, stub=True)"
```

**Step 3: Verify import succeeds.**

```bash
cd ~/Projects/agentic-platform
python -c "from scripts.unified_agent_bridge import UnifiedAgentBridge; b = UnifiedAgentBridge(); print(b)"
```

Expected output:
```
UnifiedAgentBridge(connected=False, stub=True)
```

**Step 4: Verify CLI entry points no longer fail on import.**

```bash
python -c "import scripts.agent_cli" 2>&1 | head -5
python -c "import scripts.agent_console" 2>&1 | head -5
```

Neither should produce `ModuleNotFoundError`.

---

## Task 2: Implement `Telemetry.log_audit_event()` (C-2)

### Problem

`scripts/utils/manage_logs.py:93` calls:

```python
telemetry.log_audit_event(
    log_type=...,
    title=...,
    triggering_prompt=...,
    failure_category=...,
    root_cause=...,
    prevention_strategy=...,
)
```

`src/agentic/telemetry.py` defines no such method. Any invocation raises `AttributeError`.

### Implementation

**Step 1: Read `src/agentic/telemetry.py` in full.**

Note the existing schema and existing methods.
Note the SQLite table definitions.

**Step 2: Add `audit_events` table to the schema.**

Locate the `_ensure_schema()` method (or equivalent). Add:

```python
conn.execute("""
    CREATE TABLE IF NOT EXISTS audit_events (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        log_type    TEXT    NOT NULL CHECK(log_type IN ('SUCCESS','ERROR','WARNING','INFO')),
        title       TEXT    NOT NULL,
        triggering_prompt    TEXT,
        failure_category     TEXT,
        root_cause           TEXT,
        prevention_strategy  TEXT,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )
""")
```

**Step 3: Implement the method on the `Telemetry` class.**

Add the following method. Place it alongside existing log methods:

```python
def log_audit_event(
    self,
    log_type: str,
    title: str,
    triggering_prompt: str = "",
    failure_category: str = "",
    root_cause: str = "",
    prevention_strategy: str = "",
) -> int:
    """Persist an audit event (success, error, warning) to the database.

    Returns the rowid of the inserted record.
    Raises ValueError for invalid log_type.
    """
    valid_types = {"SUCCESS", "ERROR", "WARNING", "INFO"}
    normalised = log_type.upper().strip()
    if normalised not in valid_types:
        raise ValueError(
            f"log_type must be one of {valid_types}, got {log_type!r}"
        )

    with self._get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO audit_events
                (log_type, title, triggering_prompt, failure_category, root_cause, prevention_strategy)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (normalised, title, triggering_prompt, failure_category, root_cause, prevention_strategy),
        )
        conn.commit()
        return cursor.lastrowid
```

> Note: Replace `self._get_connection()` with whatever connection helper the existing
> class uses. If it uses `sqlite3.connect(self.db_path)` directly, match that pattern.

**Step 4: Verify no `AttributeError`.**

```bash
cd ~/Projects/agentic-platform
python -c "
from src.agentic.telemetry import Telemetry
t = Telemetry()
rowid = t.log_audit_event('SUCCESS', 'Test audit event', triggering_prompt='review')
print(f'Inserted row {rowid}')
"
```

Expected: `Inserted row 1` (or any integer).

**Step 5: Verify `manage_logs.py` does not raise AttributeError.**

```bash
python scripts/utils/manage_logs.py --type SUCCESS --title "Test" 2>&1 | head -10
```

---

## Task 3: Create `backend/app.py` (C-7)

### Problem

`Makefile:26` runs `python backend/app.py`. The file does not exist.
`make dev` and `make dev-backend` both fail immediately.

### Implementation

**Step 1: Read `Makefile` lines 20–40 to confirm the exact command used.**

**Step 2: Create `backend/app.py`.**

```python
"""
COPERNICUS Backend — Flask application entry point.

Exposes REST API for the Electron frontend and agent orchestration layer.
"""
from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

from flask import Flask, jsonify
from flask_cors import CORS

# ---------------------------------------------------------------------------
# Path setup — ensure project root is on sys.path
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

def create_app(config: dict | None = None) -> Flask:
    app = Flask(__name__)
    CORS(app)

    app.config.update(
        SECRET_KEY=os.getenv("FLASK_SECRET_KEY", "dev-secret-change-in-production"),
        DEBUG=os.getenv("FLASK_DEBUG", "false").lower() == "true",
    )

    if config:
        app.config.update(config)

    # -----------------------------------------------------------------------
    # Register blueprints
    # -----------------------------------------------------------------------
    from backend.routes import health  # noqa: PLC0415
    app.register_blueprint(health.bp)

    return app


# ---------------------------------------------------------------------------
# Routes — defined here until blueprints are created
# ---------------------------------------------------------------------------

_app = create_app()


@_app.route("/health")
def health_check():
    return jsonify({"status": "ok", "service": "copernicus-backend"}), 200


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    port = int(os.getenv("BACKEND_PORT", "5001"))
    _app.run(host="0.0.0.0", port=port)  # noqa: S104
```

**Step 3: Create `backend/__init__.py`.**

```python
"""COPERNICUS backend package."""
```

**Step 4: Create `backend/routes/__init__.py`.**

```python
"""Backend route blueprints."""
```

**Step 5: Create `backend/routes/health.py`.**

```python
"""Health-check route."""
from flask import Blueprint, jsonify

bp = Blueprint("health", __name__, url_prefix="/api")


@bp.route("/health")
def health():
    return jsonify({"status": "ok"}), 200
```

**Step 6: Verify the server starts.**

```bash
cd ~/Projects/agentic-platform
python backend/app.py &
sleep 2
curl -s http://localhost:5001/health
kill %1
```

Expected:
```json
{"service": "copernicus-backend", "status": "ok"}
```

**Step 7: Verify `make dev-backend` works.**

```bash
make dev-backend
# Should start server on port 5001 without FileNotFoundError
# Ctrl-C to stop
```

---

## Task 4: Fix Makefile Remote Deployment Path (C-8)

### Problem

`Makefile:48,51,55` hardcodes `cd ~/projects/high-plains-hipster`.
The live repository on the Dell R210ii Core is `agentic-platform`.
Every `make deploy` and `make db-deploy` targets the wrong directory.

### Implementation

**Step 1: Read the current Makefile in full.**

**Step 2: Add a variable block at the top of the Makefile (after existing variables).**

```makefile
# ---------------------------------------------------------------------------
# Remote deployment configuration
# ---------------------------------------------------------------------------
REMOTE_USER        ?= admin
REMOTE_HOST        ?= $(CORE_SERVER_IP)
REMOTE_PROJECT_DIR ?= ~/projects/agentic-platform
```

**Step 3: Replace every occurrence of the hardcoded path.**

Find all lines containing `high-plains-hipster` (there should be 3).
Replace `~/projects/high-plains-hipster` with `$(REMOTE_PROJECT_DIR)`.

Example — change:
```makefile
ssh admin@$(CORE_SERVER_IP) 'cd ~/projects/high-plains-hipster && docker compose ...'
```
To:
```makefile
ssh $(REMOTE_USER)@$(REMOTE_HOST) 'cd $(REMOTE_PROJECT_DIR) && docker compose ...'
```

Apply this substitution to all deployment-related targets (`deploy`, `db-deploy`, `db-migrate`).

**Step 4: Verify `make -n deploy` shows the corrected path.**

```bash
make -n deploy 2>&1 | grep "cd "
```

Expected output contains `agentic-platform`, NOT `high-plains-hipster`.

---

## Task 5: Add Minimum Test to Pass `make test` (C-8 related)

### Problem

`tests/` is empty. `make test` passes silently with 0 tests collected, masking failures.

### Implementation

**Step 1: Create `tests/__init__.py`.**

```python
"""COPERNICUS test suite."""
```

**Step 2: Create `tests/test_smoke.py`.**

```python
"""Smoke tests — verify core imports and runtime environment."""
import pytest


def test_unified_agent_bridge_importable():
    """UnifiedAgentBridge must be importable without error."""
    from scripts.unified_agent_bridge import UnifiedAgentBridge  # noqa: PLC0415
    bridge = UnifiedAgentBridge()
    assert bridge is not None


def test_telemetry_importable():
    """Telemetry must be importable and log_audit_event must exist."""
    from src.agentic.telemetry import Telemetry  # noqa: PLC0415
    t = Telemetry()
    assert hasattr(t, "log_audit_event"), "log_audit_event method is missing"


def test_backend_app_creates():
    """Flask app factory must return a valid app."""
    from backend.app import create_app  # noqa: PLC0415
    app = create_app({"TESTING": True})
    assert app is not None
    client = app.test_client()
    response = client.get("/health")
    assert response.status_code == 200


def test_manage_logs_no_attribute_error():
    """manage_logs must not raise AttributeError on import."""
    import importlib  # noqa: PLC0415
    # Only test import, not execution (requires CLI args)
    spec = importlib.util.spec_from_file_location(
        "manage_logs", "scripts/utils/manage_logs.py"
    )
    assert spec is not None
```

**Step 3: Verify tests pass.**

```bash
cd ~/Projects/agentic-platform
python -m pytest tests/test_smoke.py -v
```

All 4 tests must pass.

---

## Completion Checklist

Before marking this plan complete, verify every item:

- [ ] `python -c "from scripts.unified_agent_bridge import UnifiedAgentBridge"` succeeds
- [ ] `python -c "from src.agentic.telemetry import Telemetry; t=Telemetry(); t.log_audit_event('SUCCESS','test')"` succeeds
- [ ] `python backend/app.py` starts and responds to `GET /health` with 200
- [ ] `make -n deploy` shows `agentic-platform` in remote path, not `high-plains-hipster`
- [ ] `make test` collects ≥ 4 tests and all pass
- [ ] Context7 API key confirmed revoked by Product Owner (out-of-band action)
- [ ] `claude_mcp_config.json` and `agentic-boilerplate/claude_mcp_config.json` updated to `${CONTEXT7_API_KEY}`

**Commit message when done:**
```
fix(sprint-0): resolve all runtime blockers from story-101

- Implement UnifiedAgentBridge stub module (C-1)
- Add Telemetry.log_audit_event() with audit_events schema (C-2)
- Create backend/app.py Flask entry point with /health endpoint (C-7)
- Fix Makefile remote deployment path variable (C-8)
- Add smoke test suite
```
