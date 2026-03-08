import os
import tempfile
import pytest
import sqlite3
from backend.app import app
from backend.api.stories import init_db

@pytest.fixture
def client():
    app.config['TESTING'] = True

    # Create a temporary file to use as the database
    db_fd, db_path = tempfile.mkstemp()
    os.environ['COPERNICUS_DB_PATH'] = db_path
    
    # Ensure no auth required for these safety tests
    if 'COPERNICUS_API_KEY' in os.environ:
        old_key = os.environ['COPERNICUS_API_KEY']
        del os.environ['COPERNICUS_API_KEY']
    else:
        old_key = None

    with app.test_client() as client:
        # Initialize the database schema
        init_db()
        
        # Also initialize jules_sessions for agents tests
        conn = sqlite3.connect(os.environ['COPERNICUS_DB_PATH'])
        conn.execute('PRAGMA foreign_keys = ON')
        conn.execute('PRAGMA journal_mode = WAL')
        conn.execute('PRAGMA synchronous = NORMAL')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS jules_sessions (
                id TEXT PRIMARY KEY,
                story_id TEXT,
                last_search_context TEXT,
                started_at INTEGER
            )
        ''')
        conn.commit()
        conn.close()
        
        yield client

    os.close(db_fd)
    os.unlink(db_path)
    if old_key:
        os.environ['COPERNICUS_API_KEY'] = old_key

def test_sql_injection_update_story_title(client):
    """
    Test SQL injection in story update (title field).
    Attempt to close the UPDATE and start a new statement or alter the WHERE clause.
    """
    # Create a story first
    res = client.post('/api/stories', json={"title": "Original Title", "status": "PLANNING"})
    story_id = res.get_json()['data']['id']
    
    # Attempt injection in title
    injection_payload = "New Title', status='PWNED' WHERE id='non-existent' --"
    res = client.put(f'/api/stories/{story_id}', json={"title": injection_payload})
    
    # It should be treated as a literal string
    assert res.status_code == 200
    data = res.get_json()['data']
    assert data['title'] == injection_payload
    # Status should still be PLANNING, not PWNED
    assert data['status'] == "PLANNING"

def test_sql_injection_update_story_status(client):
    """
    Test SQL injection in story update (status field).
    """
    # Create a story first
    res = client.post('/api/stories', json={"title": "Test", "status": "PLANNING"})
    story_id = res.get_json()['data']['id']
    
    # Attempt injection in status
    injection_payload = "IN_PROGRESS', body_md='PWNED' --"
    res = client.put(f'/api/stories/{story_id}', json={"status": injection_payload})
    
    assert res.status_code == 200
    data = res.get_json()['data']
    assert data['status'] == injection_payload
    # body_md should NOT be PWNED (it should be empty string or null)
    assert data['body_md'] != "PWNED"

def test_sql_injection_handoff_session_id(client):
    """
    Test SQL injection in context handoff (session_id field).
    """
    # Attempt injection in session_id
    # The query is: SELECT last_search_context FROM jules_sessions WHERE id = ? LIMIT 1
    injection_payload = "123' OR '1'='1"
    res = client.post('/api/agents/context/handoff', json={"session_id": injection_payload})
    
    # Should return 200 but data['context'] should be None (unless a session with that literal ID exists)
    assert res.status_code == 200
    assert res.get_json()['data']['context'] is None

def test_sql_injection_handoff_story_id(client):
    """
    Test SQL injection in context handoff (story_id field).
    """
    # Attempt injection in story_id
    # The query is: SELECT last_search_context FROM jules_sessions WHERE story_id = ? ...
    injection_payload = "story-123' UNION SELECT 'injected-context' --"
    res = client.post('/api/agents/context/handoff', json={"story_id": injection_payload})
    
    assert res.status_code == 200
    assert res.get_json()['data']['context'] is None
