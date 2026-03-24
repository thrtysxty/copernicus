import os
import sqlite3
import subprocess
import time
import json
import urllib.request
import tempfile
import sys
import pytest
import hashlib

@pytest.fixture
def recovery_env():
    # Setup temporary database
    fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(fd)

    # Initialize basic schema for test
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS model_calls (
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
            context_json TEXT,
            prompt_id TEXT,
            commit_sha TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS collector_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            received_at TEXT,
            payload_hash TEXT,
            written INTEGER DEFAULT 0,
            payload TEXT
        )
    """)
    conn.commit()
    conn.close()

    yield db_path

    # Cleanup
    if os.path.exists(db_path):
        os.remove(db_path)

def create_payload(session_id):
    return {
        "signal_type": "api_request",
        "data": {
            "session_id": session_id,
            "model_id": "test-model",
            "provider": "test",
            "tokens_in": 10,
            "tokens_out": 20,
            "cost_usd": 0.05
        }
    }

def test_recovery_on_startup(recovery_env):
    db_path = recovery_env

    # 1. Write unwritten payloads to collector_log
    payload1 = json.dumps(create_payload("sess-1"))
    payload2 = json.dumps(create_payload("sess-2"))

    hash1 = hashlib.sha256(payload1.encode('utf-8')).hexdigest()
    hash2 = hashlib.sha256(payload2.encode('utf-8')).hexdigest()

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO collector_log (received_at, payload_hash, written, payload)
        VALUES (?, ?, 0, ?)
    """, ("2023-01-01T00:00:00Z", hash1, payload1))

    cursor.execute("""
        INSERT INTO collector_log (received_at, payload_hash, written, payload)
        VALUES (?, ?, 0, ?)
    """, ("2023-01-01T00:00:01Z", hash2, payload2))

    conn.commit()
    conn.close()

    # 2. Start the collector subprocess
    env = os.environ.copy()
    env["COPERNICUS_DB_PATH"] = db_path

    script_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "collector", "sqlite_exporter.py")

    process = subprocess.Popen(
        [sys.executable, script_path],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    # 3. Wait for startup and recovery
    max_retries = 50
    started = False
    for _ in range(max_retries):
        try:
            req = urllib.request.Request("http://localhost:4318/recovery-status", method="GET")
            with urllib.request.urlopen(req) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8'))
                    assert data["pendingRows"] == 2
                    assert data["recovered"] == 2
                    started = True
                    break
        except Exception:
            time.sleep(0.1)

    if not started:
        process.kill()
        pytest.fail("Server did not start or recovery status failed")

    # Wait a bit for db writes to settle
    time.sleep(1)

    # 4. Verify data in model_calls
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("SELECT session_id FROM model_calls ORDER BY session_id")
    rows = cursor.fetchall()
    assert len(rows) == 2
    assert rows[0][0] == "sess-1"
    assert rows[1][0] == "sess-2"

    # 5. Verify collector_log is updated to written=1
    cursor.execute("SELECT written FROM collector_log ORDER BY id")
    logs = cursor.fetchall()
    assert len(logs) == 2
    assert logs[0][0] == 1
    assert logs[1][0] == 1

    conn.close()

    # 6. Stop collector
    process.terminate()
    process.wait(timeout=5)

    # 7. Test deduplication: try recovery again with the same hashes
    # We will manually set one to written=0, but the hash should prevent duplicate entries
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    # Insert new unwritten row with same hash
    cursor.execute("""
        INSERT INTO collector_log (received_at, payload_hash, written, payload)
        VALUES (?, ?, 0, ?)
    """, ("2023-01-01T00:00:02Z", hash1, payload1))
    conn.commit()
    conn.close()

    process2 = subprocess.Popen(
        [sys.executable, script_path],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    started = False
    for _ in range(max_retries):
        try:
            req = urllib.request.Request("http://localhost:4318/recovery-status", method="GET")
            with urllib.request.urlopen(req) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8'))
                    # pendingRows is 1, but recovered is 0 because it was deduplicated
                    assert data["pendingRows"] == 1
                    assert data["recovered"] == 0
                    started = True
                    break
        except Exception:
            time.sleep(0.1)

    if not started:
        process2.kill()
        pytest.fail("Server did not start or recovery status failed on pass 2")

    process2.terminate()
    process2.wait(timeout=5)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # model_calls should still only have 2 entries
    cursor.execute("SELECT session_id FROM model_calls ORDER BY session_id")
    rows = cursor.fetchall()
    assert len(rows) == 2

    # All collector_log entries should be written=1 now (dedup logic updates to 1)
    cursor.execute("SELECT written FROM collector_log")
    logs = cursor.fetchall()
    assert len(logs) == 3
    assert all(l[0] == 1 for l in logs)

    conn.close()
