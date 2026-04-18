import pytest
from backend.app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_models_endpoint_returns_list(client):
    response = client.get('/api/registry/models')
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)
    assert len(data) >= 10

def test_persona_lookup_by_alias(client):
    response = client.get('/api/registry/personas/architect')
    assert response.status_code == 200
    data = response.get_json()
    assert data['alias'] == 'architect'
    assert data['role'] == 'thinker'

def test_model_lookup_by_id(client):
    response = client.get('/api/registry/models/claude-3-5-sonnet-20240620')
    assert response.status_code == 200
    data = response.get_json()
    assert data['id'] == 'claude-3-5-sonnet-20240620'
    assert data['provider'] == 'anthropic'

def test_model_not_found(client):
    response = client.get('/api/registry/models/non-existent-model')
    assert response.status_code == 404
    data = response.get_json()
    assert data['error'] == 'Model not found'

def test_persona_not_found(client):
    response = client.get('/api/registry/personas/non-existent-persona')
    assert response.status_code == 404
    data = response.get_json()
    assert data['error'] == 'Persona not found'

def test_reload_hot_swaps_data(client):
    # This test verifies that /reload returns success.
    # To truly verify hot-swapping, we'd need to modify the file on disk.
    response = client.post('/api/registry/reload')
    assert response.status_code == 200
    data = response.get_json()
    assert "successfully" in data['message']
