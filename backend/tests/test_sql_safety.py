import pytest
from flask import Flask
import sqlite3
from backend.api.stories import stories_bp
from unittest.mock import patch, MagicMock

@pytest.fixture
def client():
    app = Flask(__name__)
    app.register_blueprint(stories_bp, url_prefix='/stories')
    app.config['TESTING'] = True
    # Mock require_auth to allow tests to pass without actual authentication
    with patch('backend.middleware.auth.require_auth', lambda f: f):
        yield app.test_client()

@pytest.fixture(autouse=True)
def mock_get_db():
    with patch('backend.api.stories.get_db_connection') as mock_get_db_conn_func:
        mock_conn = MagicMock(spec=sqlite3.Connection)
        mock_cursor = MagicMock(spec=sqlite3.Cursor)

        # Configure the mock connection's execute method to return the mock cursor
        mock_conn.execute.return_value = mock_cursor

        # Make get_db_connection return our configured mock_conn
        mock_get_db_conn_func.return_value = mock_conn

        yield mock_conn # Yield the mocked connection for assertions

def test_sql_injection_update_story_id(client, mock_get_db):
    # story_id in the URL path must be rejected before reaching the DB.
    # Characters outside [a-zA-Z0-9._:-] (e.g. quotes, spaces, semicolons) are invalid.
    sqli_payload = "123' OR 1=1; --"
    response = client.put(
        f'/stories/{sqli_payload}',
        json={"title": "Updated Title"},
        headers={'Content-Type': 'application/json'}
    )

    assert response.status_code == 422
    mock_get_db.execute.assert_not_called()

def test_sql_injection_update_title(client, mock_get_db):
    # Title containing SQL injection patterns must be rejected at the schema level.
    sqli_title = "Valid Title; DROP TABLE users; --"
    response = client.put(
        '/stories/123',
        json={"title": sqli_title},
        headers={'Content-Type': 'application/json'}
    )

    assert response.status_code == 422
    mock_get_db.execute.assert_not_called()

def test_sql_injection_create_story_id(client, mock_get_db):
    sqli_id = "new_story_id' OR 1=1; --"
    response = client.post(
        '/stories',
        json={"id": sqli_id, "title": "Test Story"},
        headers={'Content-Type': 'application/json'}
    )

    assert response.status_code == 422 # Pydantic validation for id fails
    # Verify that the execute command was NOT called at all, as validation happens before any DB interaction
    mock_get_db.execute.assert_not_called()
