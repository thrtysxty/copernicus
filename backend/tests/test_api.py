import os
import tempfile
import pytest
from backend.app import app
from backend.api.stories import init_db

@pytest.fixture
def client():
    app.config['TESTING'] = True

    # Create a temporary file to use as the database
    db_fd, db_path = tempfile.mkstemp()
    os.environ['COPERNICUS_DB_PATH'] = db_path
    os.environ['COPERNICUS_SETTINGS_PATH'] = db_path + "_settings.json"

    # Ensure auth is disabled for tests unless specifically testing it
    if 'COPERNICUS_API_KEY' in os.environ:
        del os.environ['COPERNICUS_API_KEY']

    with app.test_client() as client:
        # Initialize the database schema
        init_db()
        yield client

    os.close(db_fd)
    os.unlink(db_path)
    if os.path.exists(os.environ['COPERNICUS_SETTINGS_PATH']):
        os.unlink(os.environ['COPERNICUS_SETTINGS_PATH'])

def test_health(client):
    response = client.get('/api/health')
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'ok'
    assert 'version' in data
    assert 'timestamp' in data

def test_stories_crud(client):
    # Initial list should be empty
    response = client.get('/api/stories')
    assert response.status_code == 200
    assert response.get_json()['data'] == []

    # Create a new story
    response = client.post('/api/stories', json={
        "title": "Test Story",
        "body_md": "This is a test",
        "status": "PLANNING"
    })
    assert response.status_code == 201
    data = response.get_json()['data']
    assert data['title'] == "Test Story"
    assert data['status'] == "PLANNING"
    story_id = data['id']

    # List should now contain one story
    response = client.get('/api/stories')
    assert response.status_code == 200
    assert len(response.get_json()['data']) == 1

    # Get specific story
    response = client.get(f'/api/stories/{story_id}')
    assert response.status_code == 200
    assert response.get_json()['data']['id'] == story_id

    # Update story
    response = client.put(f'/api/stories/{story_id}', json={
        "title": "Updated Test Story",
        "status": "IN_PROGRESS"
    })
    assert response.status_code == 200
    data = response.get_json()['data']
    assert data['title'] == "Updated Test Story"
    assert data['status'] == "IN_PROGRESS"

    # Delete story
    response = client.delete(f'/api/stories/{story_id}')
    assert response.status_code == 200

    # List should be empty again
    response = client.get('/api/stories')
    assert response.status_code == 200
    assert response.get_json()['data'] == []

def test_agents_api(client):
    response = client.get('/api/agents/status')
    assert response.status_code == 200
    assert response.get_json()['data']['sessions'] == []

    response = client.post('/api/agents/dispatch', json={"task": "do something"})
    assert response.status_code == 200
    assert response.get_json()['data']['queued'] is True

    response = client.post('/api/agents/123/stop')
    assert response.status_code == 200
    assert response.get_json()['data']['queued'] is True

def test_settings_api(client):
    response = client.get('/api/settings')
    assert response.status_code == 200
    assert response.get_json()['data'] == {}

    response = client.put('/api/settings', json={"theme": "dark"})
    assert response.status_code == 200
    assert response.get_json()['data']['theme'] == "dark"

    response = client.get('/api/settings')
    assert response.status_code == 200
    assert response.get_json()['data']['theme'] == "dark"

def test_auth_middleware(client):
    os.environ['COPERNICUS_API_KEY'] = 'test-key-123'

    # Should fail without auth key
    response = client.get('/api/stories')
    assert response.status_code == 401
    assert response.get_json()['error'] == "Unauthorized"

    # Should pass with correct auth key
    response = client.get('/api/stories', headers={'X-API-Key': 'test-key-123'})
    assert response.status_code == 200

    # Health route should still work without auth
    response = client.get('/api/health')
    assert response.status_code == 200

    del os.environ['COPERNICUS_API_KEY']
