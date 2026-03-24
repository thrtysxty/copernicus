import os
import sqlite3
import subprocess
import time
import json
import urllib.request
import tempfile
import sys
import pytest

@pytest.fixture
def collector_env():
    # Setup temporary database
    fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(fd)

    # Initialize basic schema for test
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE model_calls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            model_id TEXT NOT NULL,
            provider TEXT NOT NULL,
            tokens_in INTEGER NOT NULL DEFAULT 0,
            tokens_out INTEGER NOT NULL DEFAULT 0,
            cost_usd REAL NOT NULL DEFAULT 0,
            latency_ms INTEGER,
            reasoning TEXT,
            prompt_text TEXT,
            response_text TEXT,
            context_json TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            content TEXT NOT NULL,
            agent_id TEXT
        )
    """)
    conn.commit()
    conn.close()

    # Start the collector subprocess
    script_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "collector", "sqlite_exporter.py")
    env = os.environ.copy()
    env["COPERNICUS_DB_PATH"] = db_path

    proc = subprocess.Popen([sys.executable, script_path], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    # Wait for the server to start (max 3 seconds)
    started = False
    for _ in range(30):
        try:
            req = urllib.request.Request("http://localhost:4318", method="GET")
            urllib.request.urlopen(req, timeout=0.1)
            started = True
            break
        except urllib.error.HTTPError as e:
            if e.code == 501:  # Not Implemented (GET)
                started = True
                break
        except Exception:
            pass

        # Check if process exited early
        if proc.poll() is not None:
            break

        time.sleep(0.1)

    yield db_path, proc

    # Teardown
    proc.terminate()
    try:
        proc.wait(timeout=2)
    except subprocess.TimeoutExpired:
        proc.kill()

    os.remove(db_path)

def test_collector_api_request(collector_env):
    db_path, proc = collector_env

    assert proc.poll() is None, "Collector process failed to start"

    # POST synthetic OTLP payload
    payload = {
        "signal_type": "api_request",
        "data": {
            "session_id": "test_sess_1",
            "model_id": "claude-3-opus",
            "provider": "anthropic",
            "tokens_in": 100,
            "tokens_out": 50,
            "cost_usd": 0.001,
            "latency_ms": 1200,
            "reasoning": "some reasoning"
        }
    }

    req = urllib.request.Request("http://localhost:4318", data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'}, method="POST")
    response = urllib.request.urlopen(req)
    assert response.status == 200

    # Assert row exists in db
    time.sleep(0.5) # Allow tiny bit of time for DB write
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT session_id, model_id, provider, cost_usd, latency_ms FROM model_calls")
    rows = cursor.fetchall()
    conn.close()

    assert len(rows) == 1
    assert rows[0][0] == "test_sess_1"
    assert rows[0][1] == "claude-3-opus"
    assert rows[0][2] == "anthropic"
    assert rows[0][3] == 0.001
    assert rows[0][4] == 1200

def test_collector_event(collector_env):
    db_path, proc = collector_env

    assert proc.poll() is None, "Collector process failed to start"

    payload = {
        "signal_type": "active_time",
        "data": {
            "duration": 500,
            "agent_id": "test_agent"
        }
    }

    req = urllib.request.Request("http://localhost:4318", data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'}, method="POST")
    response = urllib.request.urlopen(req)
    assert response.status == 200

    time.sleep(0.5)
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT type, content, agent_id FROM events")
    rows = cursor.fetchall()
    conn.close()

    assert len(rows) == 1
    assert rows[0][0] == "active_time"
    assert "duration" in rows[0][1]
    assert rows[0][2] == "test_agent"
